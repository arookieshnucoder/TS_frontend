import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestServer } from './helpers/vite.mjs'

test('REST client uses HTTP 200/400 and carries the failed session without stream parsing',async()=>{
  const vite=await createTestServer()
  const original=globalThis.fetch
  const session={id:'1',title:'test',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    messages:[{id:'2',role:'assistant',content:'中文返回内容'}],sessionStatus:'finished',sessionError:null,modelRequestId:'3'}
  try {
    const {chatApi,ChatApiError}=await vite.ssrLoadModule('/src/api/chat.ts')
    globalThis.fetch=async(_path,options)=>{
      assert.equal(options.headers.Accept,undefined)
      return Response.json({data:session,httpStatusCode:200})
    }
    assert.equal((await chatApi.send('1','hello',new AbortController().signal)).messages[0].content,'中文返回内容')
    const failed={...session,messages:[],sessionStatus:'failure',sessionError:{code:'MODEL_REQUEST_FAILED',message:'模型未正确返回',httpStatusCode:400}}
    globalThis.fetch=async()=>Response.json({data:failed,error:failed.sessionError,httpStatusCode:400},{status:400})
    await assert.rejects(chatApi.send('1','hello',new AbortController().signal),error=>{
      assert.ok(error instanceof ChatApiError)
      assert.equal(error.httpStatusCode,400)
      assert.equal(error.session.sessionStatus,'failure')
      return true
    })
  } finally {globalThis.fetch=original;await vite.close()}
})
