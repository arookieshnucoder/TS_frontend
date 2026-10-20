import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRenderer } from 'vue'
import { createTestServer } from './helpers/vite.mjs'

test('a complete reviewed HTTP reply is fully readable within a short entrance animation', async () => {
  const vite = await createTestServer()
  const renderer = createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
    parentNode: () => null, nextSibling: () => null,
  })
  const content = '已完成计算与独立核验。👨‍👩‍👧‍👦'.repeat(300)
  const session = { id: 'session', title: 'new', updatedAt: new Date().toISOString(), sessionStatus: 'finished', sessionError: null, messages: [] }
  let app, state
  try {
    const { useChat } = await vite.ssrLoadModule('/src/composables/useChat.ts')
    app = renderer.createApp({ setup() {
      state = useChat({ async list() { return [session] }, async send() { return { ...session, messages: [{ id: 'a', role: 'assistant', content }] } } })
      return () => null
    } })
    app.mount({})
    while (state.isLoading.value) await new Promise(resolve => setImmediate(resolve))
    const started = performance.now()
    assert.equal(await state.sendMessage('new question'), true)
    assert.ok(performance.now() - started < 1600, 'complete HTTP answers must not incur seconds of artificial playback')
    assert.equal(state.activeSession.value.messages.at(-1).content, content)
    assert.equal(state.activeSession.value.messages.at(-1).status, 'complete')
    assert.equal(state.isPending.value, false)
  } finally { app?.unmount(); await vite.close() }
})
