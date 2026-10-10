import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { createRenderer, nextTick, watch } from 'vue'

// Exercise the real composable and HTTP client against an isolated backend.
test('server sessions, local messages, failed requests, and backend reset', async () => {
  const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' })
  const originalFetch = globalThis.fetch
  const storage = new Map([['songjian-chat-v1', 'old demo history']])
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  }
  globalThis.window = new EventTarget()
  const renderer = createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
    parentNode: () => null, nextSibling: () => null,
  })
  let server
  let app
  try {
    const { createApp } = await vite.ssrLoadModule('../backend/src/app.ts')
    const config = { port: 0, frontendOrigin: 'http://localhost:5173', nodeEnv: 'test', shutdownTimeoutMs: 1000 }
    async function startBackend() {
      server = createApp(config).listen(0, '127.0.0.1')
      await new Promise((resolve) => server.once('listening', resolve))
      const origin = `http://127.0.0.1:${server.address().port}`
      globalThis.fetch = (path, options) => originalFetch(new URL(path, origin), options)
    }
    await startBackend()
    const { useChat } = await vite.ssrLoadModule('/src/composables/useChat.ts')
    async function mount() {
      let state
      app = renderer.createApp({ setup() { state = useChat(); return () => null } })
      app.mount({})
      for (let i = 0; i < 200 && state.isLoading.value; i++) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      assert.equal(state.isLoading.value, false)
      assert.equal(state.apiError.value, '')
      return state
    }
    let state = await mount()
    assert.equal(state.sessions.value.length, 0, 'no mock sessions injected')
    assert.equal(await state.sendMessage('联调测试'), true, 'empty-state send creates a server session')
    let streamed = ''
    const stopWatch = watch(() => state.activeSession.value?.messages.at(-1)?.content, (value) => { streamed = value })
    await new Promise((resolve) => setTimeout(resolve, 350))
    assert.ok(streamed.length > 0, 'first-session streaming remains reactive')
    stopWatch()
    state.stopGeneration()
    const id = state.activeId.value
    assert.ok(id)
    assert.equal(state.activeSession.value.title, '联调测试')
    assert.equal(state.activeSession.value.messages[0].content, '联调测试')
    await nextTick()
    app.unmount()
    state = await mount()
    assert.equal(state.activeId.value, id)
    assert.equal(state.activeSession.value.messages[0].content, '联调测试', 'messages restored locally')
    const creating = state.createSession()
    assert.equal(await state.createSession(), false, 'duplicate clicks are ignored while pending')
    assert.equal(await creating, true)
    assert.equal(state.sessions.value.length, 2)
    assert.equal(await state.selectSession(id), true)
    const beforeMessages = state.activeSession.value.messages.length
    const workingFetch = globalThis.fetch
    globalThis.fetch = async () => { throw new Error('offline') }
    assert.equal(await state.sendMessage('失败时不能追加'), false)
    assert.equal(state.activeSession.value.messages.length, beforeMessages)
    assert.equal(await state.createSession(), false)
    assert.equal(state.sessions.value.length, 2)
    assert.ok(state.apiError.value.includes('无法连接'))
    globalThis.fetch = workingFetch
    assert.equal(await state.selectSession('missing-session'), false)
    assert.equal(state.activeId.value, id, 'failed selection preserves active session')
    await new Promise((resolve) => server.close(resolve))
    await startBackend()
    assert.equal(await state.sendMessage('旧会话'), false, 'backend reset invalidates old session')
    await state.loadSessions()
    assert.equal(state.sessions.value.length, 0)
    assert.equal(state.activeId.value, '')
    assert.equal(storage.get('songjian-chat-v1'), 'old demo history', 'legacy cache remains untouched')
  } finally {
    app?.unmount()
    if (server?.listening) await new Promise((resolve) => server.close(resolve))
    await vite.close()
    globalThis.fetch = originalFetch
    delete globalThis.localStorage
    delete globalThis.window
  }
})
