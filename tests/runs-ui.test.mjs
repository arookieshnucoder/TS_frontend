import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Window } from 'happy-dom'
import { createTestServer } from './helpers/vite.mjs'

test('admin run timeline ignores stale sessions, expands safe fields, opens canvas and appends records', async () => {
  const window=new Window()
  window.document.write('<!doctype html><html><body></body></html>')
  for (const name of ['window','document','navigator','HTMLElement','Element','SVGElement','Node','Document','ShadowRoot','Event']) {
    Object.defineProperty(globalThis,name,{configurable:true,value:name==='window'?window:window[name]})
  }
  const {createApp,nextTick,ref,h}=await import('vue')
  const vite=await createTestServer({vue:true})
  const originalFetch=globalThis.fetch
  let app,releaseOld,openedCanvas,learning=false
  const id='100000000000000001',oldId='100000000000000000'
  const summary=(id,question)=>({id,sessionId:'b',requestId:'request',userMessageId:'q',question,status:learning?'pending':'failure',startedAt:new Date().toISOString(),eventCount:2,droppedEvents:0,durationMs:100,...(learning?{answerDurationMs:50}:{})})
  globalThis.fetch=async(url,options)=>{
    const path=String(url)
    if(path.includes('/sessions/a/')) return new Promise(resolve=>{releaseOld=()=>resolve(Response.json({data:{runs:[summary(id,'stale question')]}}))})
    if(path.includes('/sessions/empty/')) return Response.json({data:{runs:[]}})
    if(path.endsWith(`/runs/${id}`)) return Response.json({data:{...summary(id,'new question'),events:[
      {sequence:1,name:'agent.fallback',elapsedMs:0,timestamp:new Date().toISOString(),fields:{to:'backup'}},
      {sequence:2,name:'run.failure',elapsedMs:100,timestamp:new Date().toISOString(),fields:{result:'<script>danger()</script>',password:'[REDACTED]'}},
    ]}})
    return Response.json({data:{runs:[summary(path.includes('before=')?oldId:id,path.includes('before=')?'older question':'new question')],...(path.includes('before=')?{}:{nextCursor:oldId})}})
  }
  async function settle(predicate){for(let i=0;i<150;i++){await new Promise(resolve=>setTimeout(resolve,10));await nextTick();if(predicate())return}assert.fail('UI did not settle')}
  try{
    const {default:Timeline}=await vite.ssrLoadModule('/src/components/RunTimeline.vue')
    const {authKey}=await vite.ssrLoadModule('/src/composables/useAuth.ts')
    const sessionId=ref('a'),root=document.createElement('div');document.body.append(root)
    app=createApp({setup:()=>()=>h(Timeline,{sessionId:sessionId.value,updatedAt:0,pending:false,onOpenCanvas:id=>{openedCanvas=id}})});app.provide(authKey,{user:ref({role:'admin'})});app.mount(root)
    const timeline=root.querySelector('.run-timeline');timeline.open=true;timeline.dispatchEvent(new window.Event('toggle'))
    await settle(()=>!!releaseOld)
    sessionId.value='b';await nextTick();await settle(()=>root.querySelectorAll('.run-entry').length===1)
    releaseOld();await nextTick();assert.doesNotMatch(root.textContent,/stale question/)
    const button=text=>[...root.querySelectorAll('button')].find(b=>b.textContent===text)
    button('刷新记录').click();await settle(()=>root.querySelectorAll('.run-entry').length===1)
    const entry=root.querySelector('.run-entry');entry.open=true;entry.dispatchEvent(new window.Event('toggle'))
    await settle(()=>!!root.querySelector('.run-events'))
    assert.match(root.textContent,/切换备用模型 · backup/);assert.match(root.textContent,/本次回答失败/)
    assert.equal(root.querySelector('script'),null);assert.match(root.querySelector('pre').textContent,/backup/)
    button('在画布中查看').click();assert.equal(openedCanvas,id)
    button('加载更早记录').click();await settle(()=>root.querySelectorAll('.run-entry').length===2)
    assert.match(root.textContent,/older question/);assert.equal(window.localStorage.length,0)
    learning=true;button('刷新记录').click();await settle(()=>root.textContent.includes('已答复 · 整理经验中'))
    assert.equal(root.querySelector('.run-duration').textContent,'50 ms')
    sessionId.value='empty';await nextTick();await settle(()=>root.textContent.includes('还没有运行记录'))
    assert.equal(root.querySelectorAll('.run-entry').length,0)
  }finally{app?.unmount();await window.happyDOM.abort();globalThis.fetch=originalFetch;await vite.close()}
})
