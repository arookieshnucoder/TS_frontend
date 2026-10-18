import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Window } from 'happy-dom'
import { createTestServer } from './helpers/vite.mjs'
import { waitForUI } from './helpers/ui.mjs'

// Expose the same media query objects for the entire component lifetime, including
// preference changes after mount. This catches effects that only check once.
function mediaPreferences(window) {
  const queries = new Map()
  const preferences = { reduced: false, coarse: false }
  const matches = query => {
    if (query.includes('prefers-reduced-motion')) return preferences.reduced
    if (query.includes('pointer: coarse') || query.includes('hover: none')) return preferences.coarse
    if (query.includes('pointer: fine') || query.includes('hover: hover')) return !preferences.coarse
    return false
  }
  window.matchMedia = query => {
    if (!queries.has(query)) {
      const target = new window.EventTarget()
      const listeners = new Set()
      const add = target.addEventListener.bind(target)
      const remove = target.removeEventListener.bind(target)
      target.media = query
      target.matches = matches(query)
      target.listeners = listeners
      target.addEventListener = (type, callback, options) => {
        if (type === 'change') listeners.add(callback)
        add(type, callback, options)
      }
      target.removeEventListener = (type, callback, options) => {
        if (type === 'change') listeners.delete(callback)
        remove(type, callback, options)
      }
      target.addListener = callback => target.addEventListener('change', callback)
      target.removeListener = callback => target.removeEventListener('change', callback)
      queries.set(query, target)
    }
    return queries.get(query)
  }
  return {
    set(values) {
      Object.assign(preferences, values)
      for (const [query, target] of queries) {
        const next = matches(query)
        if (target.matches === next) continue
        target.matches = next
        const event = new window.Event('change')
        Object.defineProperties(event, { matches: { value: next }, media: { value: query } })
        target.dispatchEvent(event)
      }
    },
    listenerCount: () => [...queries.values()].reduce((count, query) => count + query.listeners.size, 0),
  }
}

function trackGlobalListeners(target, types) {
  const active = new Map(types.map(type => [type, new Set()]))
  const add = target.addEventListener.bind(target)
  const remove = target.removeEventListener.bind(target)
  target.addEventListener = (type, callback, options) => {
    active.get(type)?.add(callback)
    if (options?.signal) options.signal.addEventListener('abort', () => active.get(type)?.delete(callback), { once: true })
    add(type, callback, options)
  }
  target.removeEventListener = (type, callback, options) => {
    active.get(type)?.delete(callback)
    remove(type, callback, options)
  }
  return () => [...active.values()].reduce((count, callbacks) => count + callbacks.size, 0)
}

test('subject experiences work offline, preserve independent work and release their interactive effects', async t => {
  const window = new Window({ url: 'http://localhost:5173' })
  window.document.write('<!doctype html><html><body></body></html>')
  const names = ['window', 'document', 'navigator', 'localStorage', 'HTMLElement', 'Element', 'SVGElement', 'Node', 'Document', 'ShadowRoot', 'Event']
  const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
  for (const name of names) {
    Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? window : window[name] })
  }
  // Vue's native Transition implementation reads these browser globals.
  for (const name of ['requestAnimationFrame', 'cancelAnimationFrame']) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, value: window[name].bind(window) })
  }
  const media = mediaPreferences(window)
  const windowListeners = trackGlobalListeners(window, ['pointermove', 'pointerdown', 'blur', 'keydown'])
  const documentListeners = trackGlobalListeners(document, ['visibilitychange'])
  const rootListeners = trackGlobalListeners(document.documentElement, ['pointerleave'])
  const { createApp, nextTick } = await import('vue')
  const vite = await createTestServer({ vue: true, chatMode: 'demo' })
  const originalFetch = globalThis.fetch
  const networkCalls = []
  globalThis.fetch = async (...args) => {
    networkCalls.push(args)
    throw new Error('This acceptance test is deliberately offline')
  }
  let app, root
  const mount = Component => {
    root = document.createElement('div')
    document.body.append(root)
    app = createApp(Component)
    app.mount(root)
    return root
  }
  const unmount = () => { app?.unmount(); app = undefined; root?.remove() }
  const wait = (predicate, label) => waitForUI(predicate, { root, label })
  const input = () => root.querySelector('textarea')
  const switchButton = label => [...root.querySelectorAll('.subject-switch button')].find(button => button.textContent.trim() === label)
  const typeDraft = async text => {
    input().value = text
    input().dispatchEvent(new window.Event('input', { bubbles: true }))
    await nextTick()
  }
  const switchTo = async (label, subject) => {
    switchButton(label).click()
    await wait(() => root.querySelector('.chat-app')?.dataset.subject === subject && !switchButton(label).disabled, `切换到${label}`)
    await nextTick()
  }
  const finishReply = async () => {
    await wait(() => root.querySelector('.stop-button'), '演示回复开始逐字显示')
    root.querySelector('.stop-button').click()
    await wait(() => !root.querySelector('.stop-button') && !switchButton('语文').disabled, '立即显示完整演示回复')
  }
  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.vue')
    await t.test('switching subjects retains drafts, separates history and never requests a backend', async child => {
      child.after(unmount)
      mount(App)
      await wait(() => switchButton('语文') && !switchButton('语文').disabled, '离线语文研习室就绪')
      assert.equal(root.querySelector('.chat-app').dataset.subject, 'chinese')
      assert.match(root.querySelector('.welcome').textContent, /一字一句/)
      assert.match(input().placeholder, /纸上/)
      assert.equal(switchButton('语文').getAttribute('aria-pressed'), 'true')
      assert.equal(switchButton('数学').getAttribute('aria-pressed'), 'false')
      for (const button of root.querySelectorAll('.subject-switch button')) {
        assert.equal(button.tagName, 'BUTTON', 'native buttons supply keyboard activation')
        assert.equal(button.type, 'button', 'switching must never submit the composer')
      }
      assert.equal(root.querySelector('.atmosphere').getAttribute('aria-hidden'), 'true')
      assert.equal(root.querySelector('.interaction-effects').getAttribute('aria-hidden'), 'true')
      const chineseDraft = '语文草稿：雨后的校园'
      const mathDraft = '数学草稿：解方程 x² - 5x + 6 = 0'
      await typeDraft(chineseDraft)
      await switchTo('数学', 'math')
      assert.match(root.querySelector('.welcome').textContent, /每一步/)
      assert.match(input().placeholder, /题目.*公式/)
      assert.equal(input().value, '')
      await typeDraft(mathDraft)
      await switchTo('语文', 'chinese')
      assert.equal(input().value, chineseDraft)
      await switchTo('数学', 'math')
      assert.equal(input().value, mathDraft)

      input().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }))
      input().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }))
      await nextTick()
      assert.equal(root.querySelectorAll('.user-bubble').length, 0, 'newline and IME confirmation do not send')
      input().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      await wait(() => root.querySelector('.stop-button'), '数学题发送')
      assert.equal(switchButton('语文').disabled, true, 'a pending answer cannot cross into the other subject')
      switchButton('语文').click()
      assert.equal(root.querySelector('.chat-app').dataset.subject, 'math')
      await finishReply()
      assert.equal(input().value, '')
      assert.match(root.querySelector('.messages').textContent, /本地演示/)
      assert.match(root.querySelector('.messages').textContent, /检验/)
      assert.equal(root.querySelector('.session-status').dataset.status, 'finished')

      await switchTo('语文', 'chinese')
      assert.equal(input().value, chineseDraft)
      assert.equal(root.querySelector('.messages'), null)
      root.querySelector('.suggestion-card').click()
      await finishReply()
      assert.equal(input().value, chineseDraft, 'a suggestion does not discard unrelated draft text')
      assert.match(root.querySelector('.messages').textContent, /定风波/)
      assert.match(root.querySelector('.assistant-body').textContent, /本地演示/)
      const poemExample = root.querySelector('.assistant-body').textContent
      assert.doesNotMatch(root.querySelector('.messages').textContent, /数学草稿/)

      await switchTo('数学', 'math')
      assert.equal(input().value, '')
      assert.match(root.querySelector('.messages').textContent, /数学草稿/)
      assert.doesNotMatch(root.querySelector('.messages').textContent, /定风波/)
      const search = root.querySelector('.search-box input')
      search.value = '数学草稿'
      search.dispatchEvent(new window.Event('input', { bubbles: true }))
      await nextTick()
      assert.equal(root.querySelectorAll('.session-item').length, 1)
      await switchTo('语文', 'chinese')
      assert.equal(search.value, '', 'one subject search cannot silently hide another subject history')
      assert.equal(root.querySelectorAll('.session-item').length, 1)
      assert.equal(input().value, chineseDraft)
      root.querySelector('.new-chat-button').click()
      await wait(() => root.querySelector('.welcome') && !switchButton('语文').disabled, '开启新语文对话')
      assert.equal(input().value, '')
      assert.equal(root.querySelectorAll('.session-item').length, 2)
      await switchTo('数学', 'math')
      assert.equal(root.querySelectorAll('.session-item').length, 1)
      assert.match(root.querySelector('.messages').textContent, /数学草稿/)
      assert.equal(networkCalls.length, 0, 'demo chat, timeline and MCP must all work without network access')
      assert.match(poemExample, /定风波|苏轼|莫听穿林/, 'a poem suggestion must receive its matching example, not an unrelated fallback')
      unmount()
      assert.equal(media.listenerCount(), 0)
      assert.equal(windowListeners() + documentListeners() + rootListeners(), 0)
    })

    await t.test('reloading restores each subject history and reduced motion shows answers immediately', async child => {
      child.after(unmount)
      media.set({ reduced: true })
      mount(App)
      await wait(() => root.querySelector('.messages') && !switchButton('数学').disabled, '恢复数学演示记录')
      assert.equal(root.querySelector('.chat-app').dataset.subject, 'math')
      assert.match(root.querySelector('.messages').textContent, /数学草稿/)
      await typeDraft('再看一次概率')
      root.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }))
      await wait(() => root.querySelectorAll('.user-bubble').length === 2 && !root.querySelector('.stop-button'), '减弱动态效果时立即显示回复')
      assert.equal(root.querySelector('.stream-cursor'), null)
      assert.equal(input().value, '')
      await switchTo('语文', 'chinese')
      assert.equal(root.querySelectorAll('.session-item').length, 2)
      assert.equal(networkCalls.length, 0)
      unmount()
      assert.equal(media.listenerCount(), 0)
      assert.equal(windowListeners() + documentListeners() + rootListeners(), 0)
    })

    await t.test('a collapsed mobile sidebar is removed from keyboard navigation and Escape returns focus', async child => {
      child.after(() => { unmount(); window.innerWidth = 1024 })
      window.innerWidth = 390
      media.set({ reduced: true, coarse: true })
      mount(App)
      await wait(() => switchButton('数学') && !switchButton('数学').disabled, '移动端界面就绪')
      const sidebar = root.querySelector('aside.sidebar')
      assert.equal(sidebar.hasAttribute('inert'), true, 'offscreen sidebar controls cannot receive Tab focus')
      root.querySelector('button[aria-label="展开侧边栏"]').click()
      await nextTick()
      assert.equal(sidebar.hasAttribute('inert'), false)
      root.querySelector('.search-box input').focus()
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await nextTick()
      assert.equal(sidebar.hasAttribute('inert'), true)
      assert.equal(document.activeElement, root.querySelector('button[aria-label="展开侧边栏"]'))
      unmount()
      window.innerWidth = 1024
      assert.equal(windowListeners() + documentListeners() + rootListeners(), 0)
    })

    await t.test('unavailable browser storage is explained and keeps both subjects usable in memory', async () => {
      media.set({ reduced: true, coarse: false })
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem() { throw new Error('Storage is unavailable') },
        setItem() { throw new Error('Storage is unavailable') },
      } })
      try {
        mount(App)
        await wait(() => !switchButton('语文').disabled, '存储不可用时语文仍可就绪')
        assert.ok([...root.querySelectorAll('[role="status"]')].some(element => /浏览器存储不可用.*本次页面/.test(element.textContent)))
        await typeDraft('存储不可用也能继续体验')
        root.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }))
        await wait(() => root.querySelector('.assistant-body') && !root.querySelector('.stop-button'), '内存模式仍可完成演示回答')
        assert.match(root.querySelector('.messages').textContent, /存储不可用也能继续体验/)
        await switchTo('数学', 'math')
        assert.equal(root.querySelector('.messages'), null)
        await switchTo('英语', 'english')
        assert.equal(root.querySelector('.messages'), null)
        assert.ok([...root.querySelectorAll('[role="status"]')].some(element => /浏览器存储不可用.*本次页面/.test(element.textContent)))
        await typeDraft('ENGLISH_MEMORY_ONLY: Please help with a reading question.')
        root.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }))
        await wait(() => root.querySelector('.assistant-body') && !root.querySelector('.stop-button'), '英语内存模式完成演示回答')
        assert.match(root.querySelector('.assistant-body').textContent, /英语|English/i)
        await switchTo('语文', 'chinese')
        assert.match(root.querySelector('.messages').textContent, /存储不可用也能继续体验/)
        assert.doesNotMatch(root.querySelector('.messages').textContent, /ENGLISH_MEMORY_ONLY/)
        await switchTo('英语', 'english')
        assert.match(root.querySelector('.messages').textContent, /ENGLISH_MEMORY_ONLY/)
        assert.equal(networkCalls.length, 0)
      } finally {
        unmount()
        Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: window.localStorage })
      }
      assert.equal(windowListeners() + documentListeners() + rootListeners(), 0)
    })

    await t.test('pointer effects respect changing preferences, do not intercept typing and are bounded and cleaned up', async () => {
      media.set({ reduced: false, coarse: false })
      const { default: Effects } = await vite.ssrLoadModule('/src/components/InteractionEffects.vue')
      mount(Effects)
      const target = document.createElement('button')
      target.textContent = '互动测试'
      document.body.append(target)
      const field = document.createElement('textarea')
      document.body.append(field)
      const pointer = (element, type, values = {}) => element.dispatchEvent(new window.PointerEvent(type, {
        bubbles: true, pointerType: 'mouse', button: 0, clientX: 80, clientY: 120, ...values,
      }))
      try {
        pointer(target, 'pointermove')
        await wait(() => root.querySelector('.cursor-halo.visible')?.style.transform.includes('80px'), '鼠标主题光晕跟随')
        pointer(target, 'pointerdown')
        await nextTick()
        assert.equal(root.querySelectorAll('.click-feedback').length, 1)
        assert.equal(root.querySelector('.click-feedback').style.left, '80px')
        pointer(field, 'pointerdown')
        target.disabled = true
        pointer(target, 'pointerdown')
        target.disabled = false
        await nextTick()
        assert.equal(root.querySelectorAll('.click-feedback').length, 1, 'typing fields and disabled actions do not emit decorative feedback')
        for (let i = 0; i < 20; i++) pointer(target, 'pointerdown')
        await nextTick()
        assert.ok(root.querySelectorAll('.click-feedback').length <= 8, 'rapid clicking cannot grow the decoration DOM without bound')
        media.set({ reduced: true })
        await nextTick()
        assert.equal(root.querySelector('.cursor-halo.visible'), null)
        assert.equal(root.querySelectorAll('.click-feedback').length, 0)
        pointer(target, 'pointermove')
        pointer(target, 'pointerdown')
        await nextTick()
        assert.equal(root.querySelector('.cursor-halo.visible'), null)
        assert.equal(root.querySelectorAll('.click-feedback').length, 0, 'reduced motion takes effect without reload')
        media.set({ reduced: false, coarse: true })
        pointer(target, 'pointermove')
        await nextTick()
        assert.equal(root.querySelector('.cursor-halo.visible'), null, 'a coarse pointer does not receive a mouse-following halo')
        pointer(target, 'pointerdown', { pointerType: 'touch' })
        await nextTick()
        assert.equal(root.querySelectorAll('.click-feedback').length, 1, 'touch retains lightweight tap feedback')
        await wait(() => !root.querySelector('.click-feedback'), '点击反馈自动回收')
        media.set({ coarse: false })
        pointer(target, 'pointermove')
        await wait(() => !!root.querySelector('.cursor-halo.visible'), '恢复普通鼠标反馈')
        document.documentElement.dispatchEvent(new window.PointerEvent('pointerleave'))
        await nextTick()
        assert.equal(root.querySelector('.cursor-halo.visible'), null)
        pointer(target, 'pointerdown')
        unmount()
        assert.equal(media.listenerCount(), 0, 'all media preference listeners are removed')
        assert.equal(windowListeners() + documentListeners() + rootListeners(), 0, 'all global effects and Escape handlers are removed')
      } finally { target.remove(); field.remove(); unmount() }
    })

    await t.test('the third subject is keyboard discoverable and preserves three independent drafts and histories across reload', async child => {
      child.after(unmount)
      window.localStorage.clear()
      media.set({ reduced: true, coarse: false })
      const { subjects } = await vite.ssrLoadModule('/src/config/subjects.ts')
      const grammarQuestion = subjects.english.suggestions[1].text
      const examples = {
        chinese: { label: '语文', draft: 'CHINESE_ONLY：一起读懂文字。' },
        math: { label: '数学', draft: 'MATH_ONLY：解方程 x² - 5x + 6 = 0' },
        english: { label: '英语', draft: grammarQuestion },
      }
      mount(App)
      await wait(() => !!switchButton('英语') && !switchButton('英语').disabled, '第三科学习入口就绪')
      const switches = [...root.querySelectorAll('.subject-switch button')]
      assert.deepEqual(switches.map(button => button.textContent.trim()), ['语文', '数学', '英语'])
      for (const button of switches) {
        assert.equal(button.tagName, 'BUTTON')
        assert.equal(button.type, 'button')
        assert.equal(button.tabIndex, 0, 'every subject remains in native sequential keyboard navigation')
      }
      for (const [key, example] of Object.entries(examples)) {
        await switchTo(example.label, key)
        await typeDraft(example.draft)
      }
      assert.match(root.querySelector('.welcome').textContent, /语境|English|context/i)
      assert.match(input().placeholder, /短文|阅读|选项/)
      assert.match(root.querySelector('.assistant-name').textContent, /言境/)
      assert.doesNotMatch(root.querySelector('.welcome').textContent, /听力|作文|口语陪练/)
      for (const key of ['chinese', 'english', 'math', 'english']) {
        await switchTo(examples[key].label, key)
        assert.equal(input().value, examples[key].draft, `${key} draft is restored independently`)
      }
      switchButton('语文').focus()
      await switchTo('语文', 'chinese')
      switchButton('英语').focus()
      await switchTo('英语', 'english')
      assert.equal(document.activeElement, switchButton('英语'))
      assert.equal(switchButton('英语').getAttribute('aria-pressed'), 'true')
      assert.equal(root.querySelectorAll('.subject-switch button[aria-pressed="true"]').length, 1)

      for (const key of ['english', 'chinese', 'math']) {
        await switchTo(examples[key].label, key)
        root.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }))
        await wait(() => root.querySelector('.assistant-body') && !root.querySelector('.stop-button') && input().value === '', `低动效下完成${examples[key].label}回复`)
        assert.equal(root.querySelector('.user-bubble').textContent, examples[key].draft)
        assert.equal(root.querySelectorAll('.session-item').length, 1)
        assert.match(root.querySelector('.assistant-body').textContent, /本地演示/)
      }
      await switchTo('英语', 'english')
      const answer = root.querySelector('.assistant-body').textContent
      assert.match(answer, /\bC\b[^\n]*had left/i)
      assert.match(answer, /过去完成时|past perfect/i)
      assert.doesNotMatch(answer, /这是语文 Agent|这是数学 Agent/)
      assert.doesNotMatch(root.querySelector('.messages').textContent, /CHINESE_ONLY|MATH_ONLY/)
      assert.equal(localStorage.getItem('songjian-subject'), 'english')
      for (const key of Object.keys(examples)) {
        const saved = JSON.parse(localStorage.getItem(`songjian.demo.v1.${key}`))
        assert.equal(saved.length, 1)
        assert.equal(saved[0].messages[0].content, examples[key].draft)
      }
      unmount()
      mount(App)
      await wait(() => root.querySelector('.chat-app')?.dataset.subject === 'english' && !!root.querySelector('.messages') && !switchButton('英语').disabled, '刷新直接恢复英语主题与记录')
      assert.equal(root.querySelector('.user-bubble').textContent, grammarQuestion)
      assert.equal(root.querySelectorAll('.session-item').length, 1)
      for (const key of ['chinese', 'math', 'english']) {
        await switchTo(examples[key].label, key)
        assert.equal(root.querySelector('.user-bubble').textContent, examples[key].draft)
        assert.equal(root.querySelectorAll('.session-item').length, 1)
      }
      assert.equal(networkCalls.length, 0)
      unmount()
      assert.equal(media.listenerCount(), 0)
      assert.equal(windowListeners() + documentListeners() + rootListeners(), 0)
    })

    await t.test('English streaming blocks every switch and its pointer effects still respect dynamic motion and touch preferences', async child => {
      child.after(unmount)
      media.set({ reduced: false, coarse: false })
      localStorage.setItem('songjian-subject', 'english')
      mount(App)
      await wait(() => !!switchButton('英语') && !switchButton('英语').disabled, '英语逐字演示就绪')
      const previousMessages = root.querySelectorAll('.user-bubble').length
      await typeDraft('Please help me read a new passage. Keep A. However and B. therefore unchanged.')
      root.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }))
      await wait(() => !!root.querySelector('.stop-button'), '英语回复开始逐字显示')
      for (const button of root.querySelectorAll('.subject-switch button')) {
        assert.equal(button.disabled, true)
        button.click()
      }
      assert.equal(root.querySelector('.chat-app').dataset.subject, 'english')
      await finishReply()
      assert.equal(root.querySelectorAll('.user-bubble').length, previousMessages + 1)
      assert.equal(input().value, '')
      assert.equal(root.querySelectorAll('.subject-switch button:disabled').length, 0)
      assert.match(root.querySelectorAll('.assistant-body')[previousMessages].textContent, /英语|English/i)
      assert.doesNotMatch(root.querySelectorAll('.assistant-body')[previousMessages].textContent, /这是语文 Agent|这是数学 Agent/)
      assert.equal(root.querySelector('.stream-cursor'), null)

      const pointer = (type, values = {}) => switchButton('英语').dispatchEvent(new window.PointerEvent(type, {
        bubbles: true, pointerType: 'mouse', button: 0, clientX: 110, clientY: 45, ...values,
      }))
      pointer('pointermove')
      pointer('pointerdown')
      await wait(() => !!root.querySelector('.cursor-halo.visible') && !!root.querySelector('.click-feedback'), '英语鼠标与点击反馈可用')
      media.set({ reduced: true })
      await nextTick()
      assert.equal(root.querySelector('.cursor-halo.visible'), null)
      assert.equal(root.querySelector('.click-feedback'), null)
      pointer('pointermove')
      pointer('pointerdown')
      await nextTick()
      assert.equal(root.querySelector('.click-feedback'), null)
      media.set({ reduced: false, coarse: true })
      pointer('pointermove')
      await nextTick()
      assert.equal(root.querySelector('.cursor-halo.visible'), null)
      pointer('pointerdown', { pointerType: 'touch' })
      await nextTick()
      assert.equal(root.querySelectorAll('.click-feedback').length, 1)
      assert.equal(networkCalls.length, 0)
      unmount()
      assert.equal(media.listenerCount(), 0)
      assert.equal(windowListeners() + documentListeners() + rootListeners(), 0)
    })
  } finally {
    unmount()
    globalThis.fetch = originalFetch
    await vite.close()
    await window.happyDOM.abort()
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  }
})
