import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Window } from 'happy-dom'
import { createTestServer } from './helpers/vite.mjs'

test('learning replies render headings, emphasis, lists and formulas while keeping raw HTML inert', async () => {
  const window = new Window()
  window.document.write('<!doctype html><html><body></body></html>')
  const names = ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'SVGElement', 'Node', 'Document', 'ShadowRoot', 'Event']
  const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
  for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? window : window[name] })
  const vite = await createTestServer({ vue: true })
  let app
  try {
    const { createApp, nextTick, ref, h } = await import('vue')
    const { default: MessageContent } = await vite.ssrLoadModule('/src/components/MessageContent.vue')
    const content = ref('> 本地演示\n\n### 配方的思路\n\n先看 **顶点**，再检查 `x=2`。\n\n1. 配方 $y=(x-2)^2-3$\n2. 得到最小值\n\n- 保留条件\n- 检验答案\n\n<img src=x onerror=alert(1)><script>alert(1)</script>\n\n```html\n<img src=x onerror=alert(1)>\n```')
    const root = window.document.createElement('div')
    window.document.body.append(root)
    app = createApp({ setup: () => () => h(MessageContent, { content: content.value }) })
    app.mount(root)
    assert.equal(root.querySelector('h3').textContent, '配方的思路')
    assert.equal(root.querySelector('blockquote').textContent, '本地演示')
    assert.equal(root.querySelector('strong').textContent, '顶点')
    assert.equal(root.querySelector('.inline-code').textContent, 'x=2')
    assert.equal(root.querySelectorAll('ol li').length, 2)
    assert.equal(root.querySelectorAll('ul li').length, 2)
    assert.ok(root.querySelector('.katex'))
    assert.equal(root.querySelectorAll('img, script, iframe, a').length, 0)
    assert.match(root.querySelector('pre code').textContent, /<img src=x onerror=alert\(1\)>/)
    content.value = '**解为 $x=2$**，代码 `$x=3$` 保持原样。'
    await nextTick()
    assert.ok(root.querySelector('strong .katex'))
    assert.equal(root.querySelector('.inline-code').textContent, '$x=3$')
    assert.equal(root.querySelectorAll('.katex').length, 1)
    content.value = '尚未完成 **加粗 $x^2'
    await nextTick()
    assert.match(root.textContent, /尚未完成 \*\*加粗 \$x\^2/)
    assert.equal(root.querySelector('strong'), null)
  } finally {
    app?.unmount()
    await vite.close()
    await window.happyDOM.abort()
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  }
})
