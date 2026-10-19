import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Window } from 'happy-dom'
import { createTestServer } from './helpers/vite.mjs'

test('node inspector commits typed values immediately and preserves unrelated config and event bindings', async () => {
  const window=new Window()
  window.document.write('<!doctype html><html><body></body></html>')
  for(const name of ['window','document','navigator','HTMLElement','Element','SVGElement','Node','Document','ShadowRoot','Event'])
    Object.defineProperty(globalThis,name,{configurable:true,value:name==='window'?window:window[name]})
  const {createApp,h,ref,nextTick}=await import('vue'),vite=await createTestServer({vue:true})
  let app
  try {
    const {default:Inspector}=await vite.ssrLoadModule('/src/components/workflows/NodeInspector.vue')
    const {createNode}=await vite.ssrLoadModule('/src/api/workflows.ts')
    const node=ref(createNode('tool','tool',{x:0,y:0}));node.value.data.bindings=[{event:'agent.tool',role:'finish'}]
    const root=document.createElement('div');document.body.append(root)
    app=createApp({setup:()=>()=>h(Inspector,{node:node.value,onUpdate:data=>{node.value={...node.value,data}}})});app.mount(root)
    const input=async(label,value)=>{const element=[...root.querySelectorAll('label')].find(e=>e.textContent.trim()===label)?.querySelector('input,textarea');assert.ok(element,label);element.value=value;element.dispatchEvent(new window.Event('input'));await nextTick()}
    await input('节点名称','计算工具');await input('工具名称','math_calculate');await input('参数契约','expression: string')
    assert.equal(node.value.data.label,'计算工具');assert.equal(node.value.data.config.name,'math_calculate');assert.equal(node.value.data.config.arguments,'expression: string')
    assert.equal(node.value.data.bindings[0].event,'agent.tool');assert.equal(node.value.data.config.result,'')
    const event=root.querySelector('[aria-label="事件名称"]');event.value='agent.tool.started';event.dispatchEvent(new window.Event('input'));await nextTick()
    assert.equal(node.value.data.bindings[0].event,'agent.tool.started');assert.equal(node.value.data.config.name,'math_calculate')
    node.value=createNode('loop','loop',{x:0,y:0});await nextTick()
    const operator=[...root.querySelectorAll('label')].find(e=>e.textContent.startsWith('继续条件 · 运算符')).querySelector('select')
    operator.value='less_or_equal';operator.dispatchEvent(new window.Event('change'));await nextTick()
    assert.equal(node.value.data.config.operator,'less_or_equal')
    assert.match(root.textContent,/下一轮.*提前退出/)
    node.value={...node.value,data:{...node.value.data,bindings:[{event:'agent.subagent.event',role:'iteration',field:'agent',value:'worker',nestedEvent:'agent.phase'}]}};await nextTick()
    const nested=root.querySelector('[aria-label="子任务内部事件"]');nested.value='agent.model.*';nested.dispatchEvent(new window.Event('input'));await nextTick()
    assert.equal(node.value.data.bindings[0].nestedEvent,'agent.model.*');assert.equal(node.value.data.bindings[0].role,'iteration')
  } finally {app?.unmount();await vite.close();await window.happyDOM.abort()}
})
