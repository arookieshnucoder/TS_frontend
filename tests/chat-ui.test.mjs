import ts from 'typescript'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { parse, compileScript } from '@vue/compiler-sfc'

test('sidebar renders server history, searches and selects; form sends and renders replies and errors', async () => {
  const window = new Window()
  for (const name of ['window','document','navigator','HTMLElement','Element','SVGElement','Node','Document','ShadowRoot','Event']) {
    Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? window : window[name] })
  }
  const { createApp, nextTick } = await import('vue')
  const vite = await createServer({ configFile: false, ssr: { external: true }, plugins: [{
    name: 'vue-dom-test',
    async transform(source, id) {
      if (!id.endsWith('.vue')) return
      const { descriptor } = parse(source, { filename: id })
      const compiled = compileScript(descriptor, { id, inlineTemplate: true })
      return { code: ts.transpileModule(compiled.content, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText }
    },
  }], server: { middlewareMode: true, hmr: { port: 0 } }, appType: 'custom' })
  const originalFetch = globalThis.fetch
  let fail = false
  const reply = '这是一段逐字显示的模型回答，包含组合表情 👨‍👩‍👧‍👦 和代码。'.repeat(5)
  const sessions = [{ id:'server-1',title:'服务端历史',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    sessionStatus:'finished',sessionError:null,modelRequestId:null,messages:[{id:'u1',role:'user',content:'历史问题'},{id:'a1',role:'assistant',content:'历史回答'}] }]
  globalThis.fetch = async (path, options) => {
    if (fail) throw new Error('offline')
    if (options?.method === 'POST') {
      const { content } = JSON.parse(options.body)
      sessions[0].messages.push({id:'u2',role:'user',content},{id:'a2',role:'assistant',content:reply})
      return Response.json({data:sessions[0]})
    }
    return Response.json({data: String(path).endsWith('/sessions') ? sessions : sessions[0]})
  }
  let app
  async function settle() { await new Promise(resolve=>setTimeout(resolve,30)); await nextTick() }
  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.vue')
    const root = document.createElement('div')
    document.body.append(root)
    app = createApp(App); app.mount(root)
    await settle()
    assert.equal(root.querySelectorAll('.session-item').length,1)
    assert.match(root.querySelector('.session-item').textContent,/服务端历史/)
    assert.match(root.querySelector('.messages').textContent,/历史回答/)
    const search = root.querySelector('.search-box input')
    search.value='不存在'; search.dispatchEvent(new window.Event('input')); await nextTick()
    assert.equal(root.querySelectorAll('.session-item').length,0)
    search.value=''; search.dispatchEvent(new window.Event('input')); await nextTick()
    root.querySelector('.session-item').click(); await settle()
    const input = root.querySelector('textarea')
    input.value='新问题'; input.dispatchEvent(new window.Event('input')); await nextTick()
    root.querySelector('form').dispatchEvent(new window.Event('submit',{cancelable:true})); await settle()
    const displayed = root.querySelectorAll('.assistant-body .message-content')[1].textContent
    assert.ok(displayed.length > 0 && displayed.length < reply.length, 'new reply is revealed incrementally')
    assert.ok(root.querySelector('.stream-cursor'))
    assert.ok(root.querySelector('button[aria-label="显示完整回复"]'))
    root.querySelector('button[aria-label="显示完整回复"]').click(); await settle()
    assert.ok(root.querySelectorAll('.assistant-body .message-content')[1].textContent.includes(reply))
    assert.equal(root.querySelector('.stream-cursor'), null)
    assert.equal(input.value,'')
    assert.equal(root.querySelector('.session-status').dataset.status, 'finished')
    fail=true
    input.value='保留草稿'; input.dispatchEvent(new window.Event('input')); await nextTick()
    root.querySelector('form').dispatchEvent(new window.Event('submit',{cancelable:true})); await settle()
    assert.equal(input.value,'保留草稿')
    assert.equal(root.querySelector('.session-status').dataset.status, 'failure')
    assert.ok(root.querySelector('.session-failure'))
    assert.ok([...root.querySelectorAll('[role="alert"]')].some(el=>el.textContent.includes('无法连接')))
    assert.doesNotMatch(root.querySelector('.messages').textContent,/保留草稿/)
  } finally {
    await window.happyDOM.abort()
    app?.unmount()
    globalThis.fetch=originalFetch
    await vite.close()
    window.happyDOM.abort()
  }
})
