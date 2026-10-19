import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { Window } from 'happy-dom'
import { createTestServer } from './helpers/vite.mjs'
import { waitForUI } from './helpers/ui.mjs'

test('SSO UI uses real HTTP: registration, mismatch, login errors, reload, role visibility, logout and expiry', async () => {
  const window = new Window()
  window.document.write('<!doctype html><html><body></body></html>')
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'SVGElement', 'Node', 'Document', 'ShadowRoot', 'Event']) {
    Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? window : window[name] })
  }
  const { createApp, nextTick } = await import('vue')
  const vite = await createTestServer({ vue: true })
  const originalFetch = globalThis.fetch
  let app, server, deps, cookie = '', chatRequests = 0, workflowRequests = 0, offline = false
  const root = document.createElement('div'); document.body.append(root)
  const wait = (predicate, label) => waitForUI(predicate, { root, label, timeoutMs: 6000 })
  async function input(id, value) {
    const element = root.querySelector(id); assert.ok(element, id)
    element.value = value; element.dispatchEvent(new window.Event('input')); await nextTick()
  }
  async function submit() { root.querySelector('.auth-form').dispatchEvent(new window.Event('submit', { cancelable: true })); await nextTick() }
  try {
    const { createApp: backendApp } = await vite.ssrLoadModule('../backend/src/app.ts')
    const { createDependencies } = await vite.ssrLoadModule('../backend/src/bootstrap/container.ts')
    const { loadConfig } = await vite.ssrLoadModule('../backend/src/config/env.ts')
    const { TestAuthStore } = await vite.ssrLoadModule('../backend/tests/auth-fixtures.ts')
    const { InMemoryChatSessionRepository } = await vite.ssrLoadModule('../backend/src/infrastructure/persistence/memory/in-memory-chat-session.repository.ts')
    const config = loadConfig({ NODE_ENV: 'test', AUTH_ENABLED: 'true', AGENT_TRACE_ENABLED: 'false' })
    deps = createDependencies({ authStore: new TestAuthStore(), chatSessionRepository: new InMemoryChatSessionRepository(),
      logger: { info() {}, error() {} }, agentHarness: { async run() { return { content: 'answer' } }, async titleFor(s) { return s.title } } }, config)
    server = backendApp(config, deps).listen(0, '127.0.0.1'); await once(server, 'listening')
    const origin = `http://127.0.0.1:${server.address().port}`
    globalThis.fetch = async (path, options = {}) => {
      if (offline) throw new Error('offline')
      if (String(path).includes('/chat/')) chatRequests++
      if (/workflows|observability/.test(String(path))) workflowRequests++
      assert.equal(options.credentials, 'include')
      const response = await originalFetch(new URL(path, origin), { ...options, headers: { ...options.headers, Cookie: cookie } })
      const setCookie = response.headers.get('set-cookie')
      if (setCookie) cookie = setCookie.split(';')[0]
      return response
    }
    const { default: AuthRoot } = await vite.ssrLoadModule('/src/AuthRoot.vue')
    const mount = () => { app = createApp(AuthRoot); app.mount(root) }
    mount()
    await wait(() => root.querySelector('.auth-form'), 'login screen')
    assert.equal(chatRequests, 0, 'workspace must not fetch private data before authentication')
    assert.equal(root.querySelector('#auth-email').maxLength, 64)
    root.querySelector('.auth-tabs button:last-child').click(); await nextTick()
    await input('#auth-email', 'admin@example.com'); await input('#auth-password', 'secure password'); await input('#auth-confirmation', 'different password')
    await submit(); await wait(() => root.textContent.includes('两次输入的密码不一致'), 'confirmation error')
    await input('#auth-confirmation', 'secure password'); await submit()
    await wait(() => root.querySelector('.chat-app'), 'registered workspace')
    assert.match(root.querySelector('.profile').textContent, /admin@example.com.*管理员/)
    assert.ok(root.querySelector('.mcp-hub'))
    assert.ok(root.querySelector('.workflow-entry'))
    assert.ok(cookie.startsWith('songjian_sso='))
    assert.equal(window.localStorage.length, 0, 'credentials and session tokens are not written to localStorage')
    app.unmount(); mount()
    await wait(() => root.querySelector('.chat-app'), 'session restored after page reload')
    root.querySelector('.account-logout').click(); await wait(() => root.querySelector('.auth-form'), 'logout')
    assert.equal(root.querySelector('#auth-password').value, '')
    await input('#auth-email', 'admin@example.com'); await input('#auth-password', 'wrong password'); await submit()
    await wait(() => root.textContent.includes('邮箱或密码错误'), 'wrong password error')
    await input('#auth-password', 'secure password'); await submit(); await wait(() => root.querySelector('.chat-app'), 'login')
    root.querySelector('.account-logout').click(); await wait(() => root.querySelector('.auth-form'), 'second logout')
    root.querySelector('.auth-tabs button:last-child').click(); await nextTick()
    await input('#auth-email', 'normal@example.com'); await input('#auth-password', 'secure password'); await input('#auth-confirmation', 'secure password'); await submit()
    await wait(() => root.querySelector('.chat-app'), 'ordinary user workspace')
    assert.equal(root.querySelector('.mcp-hub'), null)
    assert.equal(root.querySelector('.workflow-entry'), null)
    assert.equal(root.querySelector('.run-timeline'), null)
    assert.equal(workflowRequests,0,'ordinary workspace never requests workflow definitions or traces')
    assert.doesNotMatch(root.querySelector('.profile').textContent, /管理员/)
    cookie = 'songjian_sso=invalid'
    const { request } = await vite.ssrLoadModule('/src/api/chat.ts')
    await assert.rejects(request('/chat/sessions'), /请先登录/)
    await wait(() => root.querySelector('.auth-form') && root.textContent.includes('登录已过期'), 'expired session clears workspace')
    offline = true
    await input('#auth-email', 'normal@example.com'); await input('#auth-password', 'secure password'); await submit()
    await wait(() => root.textContent.includes('无法连接后端'), 'network failure is visible')
    assert.equal(root.querySelector('.auth-submit').disabled, false)
  } finally {
    app?.unmount(); globalThis.fetch = originalFetch
    if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
    await deps?.mcp.close(); await deps?.auth?.store.close()
    await vite.close(); await window.happyDOM.abort()
  }
})
