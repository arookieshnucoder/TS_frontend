import ts from 'typescript'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { parse, compileScript } from '@vue/compiler-sfc'

test('MCP Hub imports a file through real HTTP, toggles permissions, calls MCP in chat, stops access and handles errors', async () => {
  const window = new Window()
  for (const name of ['window','document','navigator','HTMLElement','Element','SVGElement','Node','Document','ShadowRoot','Event']) {
    Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? window : window[name] })
  }
  window.matchMedia = () => ({ matches: true })
  const { createApp, nextTick } = await import('vue')
  const vite = await createServer({ configFile: false, ssr: { external: true }, plugins: [{
    name: 'vue-mcp-test', async transform(source, id) {
      if (!id.endsWith('.vue')) return
      const { descriptor } = parse(source, { filename: id })
      const compiled = compileScript(descriptor, { id, inlineTemplate: true })
      return { code: ts.transpileModule(compiled.content, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText }
    },
  }], server: { middlewareMode: true, hmr: { port: 0 } }, appType: 'custom' })
  const originalFetch = globalThis.fetch
  let app, server, dependencies
  const directory = await mkdtemp(join(tmpdir(), 'mcp-hub-ui-'))
  const fixture = fileURLToPath(new URL('../../backend/tests/fixtures/mcp-server.mjs', import.meta.url))
  let calledMcp = false
  async function settle(predicate = () => true) {
    for (let i=0; i<600; i++) { await new Promise(resolve=>setTimeout(resolve,15)); await nextTick(); if (predicate()) return }
    assert.fail('UI operation did not settle')
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
    const root=document.createElement('div'); document.body.append(root)
    app=createApp(App); app.mount(root)
    await settle(()=>!root.querySelector('.new-chat-button').disabled)
    const hub=root.querySelector('.mcp-hub')
    assert.equal(hub.open,false,'Hub starts collapsed')
    hub.open=true; hub.dispatchEvent(new window.Event('toggle'))
    await settle(()=>!!hub.querySelector('[role="alert"]'))
    assert.match(hub.textContent,/管理员令牌/)
    const token=hub.querySelector('input[aria-label="MCP 管理员令牌"]')
    token.value='ui-admin'; token.dispatchEvent(new window.Event('input')); await nextTick()
    const button=(text)=>[...hub.querySelectorAll('button')].find(b=>b.textContent===text)
    button('刷新').click(); await settle(()=>!!hub.querySelector('.hub-empty'))
    button('导入 MCP').click(); await nextTick(); button('JSON / 文件').click(); await nextTick()
    const json=hub.querySelector('textarea')
    json.value='{bad'; json.dispatchEvent(new window.Event('input')); await nextTick()
    hub.querySelector('form').dispatchEvent(new window.Event('submit',{cancelable:true})); await settle(()=>!!hub.querySelector('[role="alert"]'))
    assert.equal(hub.querySelectorAll('.hub-server').length,0)
    const file=hub.querySelector('input[type="file"]')
    const imported=new window.File([JSON.stringify({mcpServers:{mine:{name:'我的笔记',command:process.execPath,args:[fixture]}}})],'mcp.json',{type:'application/json'})
    Object.defineProperty(file,'files',{configurable:true,value:[imported]})
    file.dispatchEvent(new window.Event('change')); await settle(()=>hub.querySelectorAll('.hub-server').length===1)
    const switchButton=()=>hub.querySelector('[role="switch"]')
    assert.equal(switchButton().getAttribute('aria-checked'),'false')
    switchButton().click(); await settle(()=>hub.querySelector('.hub-status')?.textContent==='已连接')
    assert.equal(switchButton().getAttribute('aria-checked'),'true')
    assert.match(hub.querySelector('.hub-tools').textContent,/2 \/ 3 个工具可用/)
    const write=hub.querySelector('input[type="checkbox"]')
    write.click(); await settle(()=>hub.querySelector('.hub-tools')?.textContent.includes('3 / 3'))
    assert.equal(hub.querySelector('input[type="checkbox"]').checked,true)
    const draft=root.querySelector('.composer textarea')
    draft.value='搜索 TypeScript 笔记'; draft.dispatchEvent(new window.Event('input')); await nextTick()
    root.querySelector('.composer').dispatchEvent(new window.Event('submit',{cancelable:true}))
    await settle(()=>root.querySelector('.messages')?.textContent.includes('MCP 工具已提供笔记证据'))
    assert.equal(calledMcp,true)
    switchButton().click(); await settle(()=>hub.querySelector('.hub-status')?.textContent==='已停用')
    draft.value='再问一次'; draft.dispatchEvent(new window.Event('input')); await nextTick()
    root.querySelector('.composer').dispatchEvent(new window.Event('submit',{cancelable:true}))
    await settle(()=>root.querySelector('.messages')?.textContent.includes('已有工具仍然可用'))
    const realFetch=globalThis.fetch
    globalThis.fetch=async()=>{throw new Error('offline')}
    switchButton().click(); await settle(()=>!!hub.querySelector('[role="alert"]'))
    assert.equal(switchButton().getAttribute('aria-checked'),'false','failed save must not flip switch')
    assert.match(hub.querySelector('[role="alert"]').textContent,/无法连接/)
    globalThis.fetch=realFetch
    hub.open=false; hub.dispatchEvent(new window.Event('toggle')); await nextTick()
    assert.equal(hub.open,false)
  } finally {
    app?.unmount(); await window.happyDOM.abort(); await dependencies?.mcp.close()
    if (server) {server.closeAllConnections(); await new Promise(resolve=>server.close(resolve))}
    globalThis.fetch=originalFetch; await vite.close()
  }
})
