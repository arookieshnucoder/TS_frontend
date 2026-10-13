import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Window } from 'happy-dom'
import { createTestServer } from './helpers/vite.mjs'
import { checkBackend } from './helpers/backend.mjs'
import { waitForUI, cleanupResources } from './helpers/ui.mjs'

test('MCP Hub imports a file through real HTTP, toggles permissions, calls MCP in chat, stops access and handles errors', async t => {
  const { fixture } = await checkBackend()
  const window = new Window()
  window.document.write('<!doctype html><html><body></body></html>')
  for (const name of ['window','document','navigator','HTMLElement','Element','SVGElement','Node','Document','ShadowRoot','Event']) {
    Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? window : window[name] })
  }
  window.matchMedia = () => ({ matches: true })
  const { createApp, nextTick } = await import('vue')
  const vite = await createTestServer({ vue: true })
  const originalFetch = globalThis.fetch
  let app, server, dependencies, root
  t.after(async () => {
    globalThis.fetch = originalFetch
    await cleanupResources({
      app: () => app?.unmount(),
      DOM: () => window.happyDOM.abort(),
      MCP: () => dependencies?.mcp?.close(),
      HTTP: async () => {
        if (!server) return
        server.closeAllConnections()
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
      },
      Vite: () => vite.close(),
    })
  })
  const directory = await mkdtemp(join(tmpdir(), 'mcp-hub-ui-'))
  let calledMcp = false
  async function settle(predicate, label, options = {}) {
    await nextTick()
    await waitForUI(predicate, { root, label, ...options })
  }
  try {
    const backend = await vite.ssrLoadModule('../backend/src/app.ts')
    const { loadConfig } = await vite.ssrLoadModule('../backend/src/config/env.ts')
    const { createDependencies } = await vite.ssrLoadModule('../backend/src/bootstrap/container.ts')
    const config = loadConfig({ NODE_ENV:'test', SESSION_DATA_DIR:join(directory,'sessions'), MCP_CONFIG_FILE:join(directory,'mcp.json'), MCP_ADMIN_TOKEN:'ui-admin', AGENT_WORKSPACE_ENABLED:'false' })
    dependencies = createDependencies({ logger:{info(){},error(){}}, agentModel:{ async turn(messages,tools) {
      if (messages[0]?.content.startsWith('Generate')) return { content:'前后端工具接入功能验证',toolCalls:[] }
      assert.ok(tools.some(t=>t.name==='search_session_memory'), 'original tools remain available')
      const tool = tools.find(t=>t.description.startsWith('[MCP mine/lookup]'))
      if (tool && !messages.some(m=>m.role==='tool')) return {content:'',toolCalls:[{id:'mcp-call',name:tool.name,arguments:{query:'TypeScript'}}]}
      if (tool) { calledMcp=true; assert.match(messages.at(-1).content,/evidence:TypeScript/) }
      return {content:tool ? 'MCP 工具已提供笔记证据' : '已有工具仍然可用',toolCalls:[]}
    } } },config)
    server = backend.createApp(config,dependencies).listen(0,'127.0.0.1')
    await new Promise(resolve=>server.once('listening',resolve))
    const base=`http://127.0.0.1:${server.address().port}`
    globalThis.fetch=(url,options)=>originalFetch(new URL(url,base),options)
    const { default: App } = await vite.ssrLoadModule('/src/App.vue')
    root=document.createElement('div'); document.body.append(root)
    app=createApp(App); app.mount(root)
    await settle(()=>!root.querySelector('.new-chat-button').disabled, '加载会话')
    const hub=root.querySelector('.mcp-hub')
    assert.equal(hub.open,false,'Hub starts collapsed')
    hub.open=true; hub.dispatchEvent(new window.Event('toggle'))
    await settle(()=>!!hub.querySelector('[role="alert"]'), '未认证时显示管理错误')
    assert.match(hub.textContent,/管理员令牌/)
    const token=hub.querySelector('input[aria-label="MCP 管理员令牌"]')
    token.value='ui-admin'; token.dispatchEvent(new window.Event('input')); await nextTick()
    const button=(text)=>[...hub.querySelectorAll('button')].find(b=>b.textContent===text)
    button('刷新').click(); await settle(()=>!!hub.querySelector('.hub-empty'), '认证后读取空MCP目录')
    button('导入 MCP').click(); await nextTick(); button('JSON / 文件').click(); await nextTick()
    const json=hub.querySelector('textarea')
    json.value='{bad'; json.dispatchEvent(new window.Event('input')); await nextTick()
    hub.querySelector('form').dispatchEvent(new window.Event('submit',{cancelable:true})); await settle(()=>!!hub.querySelector('[role="alert"]'), '拒绝无效JSON')
    assert.equal(hub.querySelectorAll('.hub-server').length,0)
    const file=hub.querySelector('input[type="file"]')
    const imported=new window.File([JSON.stringify({mcpServers:{mine:{name:'我的笔记',command:process.execPath,args:[fixture]}}})],'mcp.json',{type:'application/json'})
    Object.defineProperty(file,'files',{configurable:true,value:[imported]})
    file.dispatchEvent(new window.Event('change')); await settle(()=>hub.querySelectorAll('.hub-server').length===1, '文件导入MCP')
    const switchButton=()=>hub.querySelector('[role="switch"]')
    assert.equal(switchButton().getAttribute('aria-checked'),'false')
    const connectionFailure = () => hub.querySelector('[role="alert"]')?.textContent ||
      (hub.querySelector('.hub-status')?.dataset.status === 'error' ? hub.querySelector('.hub-error')?.textContent || 'MCP连接失败' : '')
    switchButton().click(); await settle(()=>hub.querySelector('.hub-status')?.textContent==='已连接', '启用MCP并发现工具', { timeoutMs: 5000, failure: connectionFailure })
    assert.equal(switchButton().getAttribute('aria-checked'),'true')
    assert.match(hub.querySelector('.hub-tools').textContent,/2 \/ 3 个工具可用/)
    const write=hub.querySelector('input[type="checkbox"]')
    write.click(); await settle(()=>hub.querySelector('.hub-tools')?.textContent.includes('3 / 3'), '开放写入权限并重新发现工具', { timeoutMs: 5000, failure: connectionFailure })
    assert.equal(hub.querySelector('input[type="checkbox"]').checked,true)
    const draft=root.querySelector('.composer textarea')
    draft.value='搜索 TypeScript 笔记'; draft.dispatchEvent(new window.Event('input')); await nextTick()
    root.querySelector('.composer').dispatchEvent(new window.Event('submit',{cancelable:true}))
    await settle(()=>root.querySelector('.messages')?.textContent.includes('MCP 工具已提供笔记证据'), '聊天使用真实MCP证据')
    assert.equal(calledMcp,true)
    const timeline=root.querySelector('.run-timeline')
    assert.equal(timeline.open,false,'process records start collapsed')
    timeline.open=true; timeline.dispatchEvent(new window.Event('toggle'))
    await settle(()=>timeline.querySelectorAll('.run-entry').length===1, '加载运行记录')
    const runEntry=timeline.querySelector('.run-entry'); runEntry.open=true; runEntry.dispatchEvent(new window.Event('toggle'))
    await settle(()=>timeline.querySelector('.run-events')?.textContent.includes('调用工具 · mine / lookup'), '展开MCP调用轨迹')
    assert.match(timeline.querySelector('.run-events').textContent,/MCP 已连接 · mine/)
    assert.match(timeline.querySelector('.run-events').textContent,/本次回答已完成/)
    assert.match(timeline.querySelector('.run-events').textContent,/evidence:TypeScript/)
    assert.ok(timeline.querySelector('.trace-export'))
    switchButton().click(); await settle(()=>hub.querySelector('.hub-status')?.textContent==='已停用', '停用MCP')
    draft.value='再问一次'; draft.dispatchEvent(new window.Event('input')); await nextTick()
    root.querySelector('.composer').dispatchEvent(new window.Event('submit',{cancelable:true}))
    await settle(()=>root.querySelector('.messages')?.textContent.includes('已有工具仍然可用'), '停用后继续聊天')
    await settle(()=>timeline.querySelectorAll('.run-entry').length===2, '追加第二条运行记录')
    const realFetch=globalThis.fetch
    globalThis.fetch=async()=>{throw new Error('offline')}
    switchButton().click(); await settle(()=>!!hub.querySelector('[role="alert"]'), '网络错误保持开关状态')
    assert.equal(switchButton().getAttribute('aria-checked'),'false','failed save must not flip switch')
    assert.match(hub.querySelector('[role="alert"]').textContent,/无法连接/)
    globalThis.fetch=realFetch
    hub.open=false; hub.dispatchEvent(new window.Event('toggle')); await nextTick()
    assert.equal(hub.open,false)
  } finally { globalThis.fetch = originalFetch }
})
