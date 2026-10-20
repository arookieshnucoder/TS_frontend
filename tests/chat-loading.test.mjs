import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRenderer } from 'vue'
import { createTestServer } from './helpers/vite.mjs'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
const session = id => ({ id, title: id, updatedAt: new Date().toISOString(), sessionStatus: 'finished', sessionError: null, messages: [] })
const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
  parentNode: () => null, nextSibling: () => null,
})

for (const staleFails of [false, true]) {
  test(`an older session load cannot overwrite the latest load or its loading state (${staleFails ? 'error' : 'success'})`, async () => {
    const vite = await createTestServer()
    const first = deferred(), second = deferred()
    let app, state, calls = 0
    try {
      const { useChat } = await vite.ssrLoadModule('/src/composables/useChat.ts')
      app = renderer.createApp({ setup() {
        state = useChat({ list: () => ++calls === 1 ? first.promise : second.promise })
        return () => null
      } })
      app.mount({})
      const latest = state.loadSessions()
      if (staleFails) first.reject(new Error('stale request failed'))
      else first.resolve([session('old subject')])
      await new Promise(resolve => setImmediate(resolve))
      assert.equal(state.isLoading.value, true, 'the current load still owns the loading indicator')
      assert.equal(state.apiError.value, '')
      assert.deepEqual(state.sessions.value, [])
      second.resolve([session('current subject')])
      await latest
      assert.equal(state.activeId.value, 'current subject')
      assert.deepEqual(state.sessions.value.map(item => item.id), ['current subject'])
      assert.equal(state.isLoading.value, false)
    } finally {
      first.resolve([]); second.resolve([])
      app?.unmount()
      await vite.close()
    }
  })
}

test('a late successful load cannot replace an already completed newer load', async () => {
  const vite = await createTestServer()
  const first = deferred()
  let app, state, calls = 0
  try {
    const { useChat } = await vite.ssrLoadModule('/src/composables/useChat.ts')
    app = renderer.createApp({ setup() {
      state = useChat({ list: () => ++calls === 1 ? first.promise : Promise.resolve([session('latest')]) })
      return () => null
    } })
    app.mount({})
    await state.loadSessions()
    first.resolve([session('stale')])
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(state.activeId.value, 'latest')
    assert.deepEqual(state.sessions.value.map(item => item.id), ['latest'])
  } finally { first.resolve([]); app?.unmount(); await vite.close() }
})
