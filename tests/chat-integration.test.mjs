import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import { createRenderer, watch } from 'vue'

test('real HTTP sessions and messages restore after backend restart; failures, duplicate sends and cancellation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'chat-frontend-'))
  const vite = await createServer({ configFile: false, ssr: { external: true }, server: { middlewareMode: true, hmr: { port: 0 } }, appType: 'custom' })
  const originalFetch = globalThis.fetch
  const renderer = createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
    parentNode: () => null, nextSibling: () => null,
  })
  let server, app, fail = false, delay = false
  const contexts = []
  try {
    const { createApp } = await vite.ssrLoadModule('../backend/src/app.ts')
    const { loadConfig } = await vite.ssrLoadModule('../backend/src/config/env.ts')
    const { createDependencies } = await vite.ssrLoadModule('../backend/src/bootstrap/container.ts')
    const config = loadConfig({ NODE_ENV: 'test', SESSION_DATA_DIR: directory })
    const model = { async reply(messages, signal) {
      if (messages[0]?.content.startsWith("Generate a session title")) return "前后端对话功能联调测试"
      contexts.push(messages)
      if (fail) throw new Error('provider failure')
      if (delay) await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 2000)
        signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')) }, { once: true })
      })
      return '后端模型回复'
    } }
    async function stopBackend() {
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
    }
    async function startBackend() {
      server = createApp(config, createDependencies({ chatModel: model, logger: { info() {}, error() {} } }, config)).listen(0, '127.0.0.1')
      await new Promise(resolve => server.once('listening', resolve))
      const origin = `http://127.0.0.1:${server.address().port}`
      globalThis.fetch = (path, options) => originalFetch(new URL(path, origin), options)
    }
    await startBackend()
    const { useChat } = await vite.ssrLoadModule('/src/composables/useChat.ts')
    async function mount() {
      let state
      app = renderer.createApp({ setup() { state = useChat(); return () => null } })
      app.mount({})
      for (let i = 0; i < 200 && state.isLoading.value; i++) await new Promise(resolve => setTimeout(resolve, 10))
      assert.equal(state.isLoading.value, false)
      assert.equal(state.apiError.value, '')
      return state
    }
    let state = await mount()
    assert.equal(state.sessions.value.length, 0)
    const statuses = []
    const unwatch = watch(() => state.activeSession.value?.sessionStatus, status => statuses.push(status), { flush: 'sync' })
    assert.equal(await state.sendMessage('联调测试'), true)
    unwatch()
    assert.ok(statuses.includes('pending'))
    assert.equal(statuses.at(-1), 'finished')
    const id = state.activeId.value
    assert.equal(state.activeSession.value.messages[1].content, '后端模型回复')
    app.unmount()
    await stopBackend(); await startBackend()
    state = await mount()
    assert.equal(state.activeId.value, id)
    assert.equal(state.activeSession.value.messages.length, 2, 'history restored without localStorage')
    assert.equal(await state.sendMessage('第二轮'), true)
    assert.match(contexts[1].map(m => m.content).join('\n'), /联调测试/)
    assert.equal(contexts[1].at(-1).content, '第二轮')
    assert.equal(state.activeSession.value.title, '前后端对话功能联调测试')
    const creating = state.createSession()
    assert.equal(await state.createSession(), false)
    assert.equal(await creating, true)
    assert.equal(state.sessions.value.length, 2)
    assert.equal(await state.selectSession(id), true)
    assert.equal(await state.selectSession('missing'), false)
    assert.equal(state.activeId.value, id)
    const before = JSON.stringify(state.activeSession.value.messages)
    const workingFetch = globalThis.fetch
    globalThis.fetch = async () => { throw new Error('offline') }
    assert.equal(await state.sendMessage('联调测试'), false)
    assert.equal(JSON.stringify(state.activeSession.value.messages), before)
    assert.match(state.apiError.value, /无法连接/)
    assert.equal(await state.createSession(), false)
    assert.equal(state.sessions.value.length, 2)
    globalThis.fetch = workingFetch
    fail = true
    assert.equal(await state.sendMessage('模型失败'), false)
    assert.equal(state.activeSession.value.sessionStatus, 'failure')
    assert.equal(state.activeSession.value.sessionError.httpStatusCode, 400)
    assert.equal(JSON.stringify(state.activeSession.value.messages), before)
    fail = false; delay = true
    const sending = state.sendMessage('停止')
    assert.equal(state.pendingSessionId.value, id)
    assert.equal(await state.sendMessage('停止'), false)
    assert.equal(await state.selectSession(id), false)
    assert.equal(await state.createSession(), false)
    state.stopGeneration()
    assert.equal(await sending, false)
    assert.equal(state.pendingSessionId.value, null)
    assert.equal(state.isPending.value, false)
    assert.equal(JSON.stringify(state.activeSession.value.messages), before)
    await new Promise(resolve => setTimeout(resolve, 100))
    await state.loadSessions()
    assert.equal(JSON.stringify(state.activeSession.value.messages), before)
    assert.equal(await state.sendMessage('x'.repeat(12001)), false)
  } finally {
    app?.unmount()
    if (server?.listening) {
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
    }
    await vite.close()
    globalThis.fetch = originalFetch
    // Keep test artifacts: repository policy forbids batch deletion.
  }
})
