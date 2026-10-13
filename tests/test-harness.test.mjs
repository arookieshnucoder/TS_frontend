import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Window } from 'happy-dom'
import { waitForUI, cleanupResources } from './helpers/ui.mjs'

test('UI waits react to DOM changes and report the failing operation instead of silently polling', async t => {
  const window = new Window()
  t.after(() => window.happyDOM.abort())
  const root = window.document.body
  const ready = waitForUI(() => root.textContent === 'connected', { root, label: 'MCP连接', timeoutMs: 500 })
  root.textContent = 'connected'
  await ready
  const failed = waitForUI(() => false, { root, label: '发现工具', failure: () => root.textContent === 'error' ? 'HTTP 404' : '' })
  root.textContent = 'error'
  await assert.rejects(failed, /发现工具: HTTP 404/)
  await assert.rejects(waitForUI(() => false, { root, label: '加载记录', timeoutMs: 20 }), /加载记录: UI did not settle.*Current UI: error/)
})

test('all resources close when MCP cleanup rejects, and its error is still reported', async () => {
  const closed = []
  await assert.rejects(cleanupResources({
    MCP: () => { closed.push('MCP'); throw new Error('transport failed') },
    HTTP: async () => { closed.push('HTTP') },
    Vite: async () => { closed.push('Vite') },
  }), error => {
    assert.ok(error instanceof AggregateError)
    assert.equal(error.errors[0].message, 'Failed to close MCP')
    assert.equal(error.errors[0].cause.message, 'transport failed')
    return true
  })
  assert.deepEqual(closed, ['MCP', 'HTTP', 'Vite'])
})
