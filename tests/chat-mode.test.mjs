import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestServer } from './helpers/vite.mjs'

test('invalid chat mode fails explicitly before any demo or network session is created', async () => {
  const vite = await createTestServer({ chatMode: 'bakcend' })
  try {
    const { useAgentChat } = await vite.ssrLoadModule('/src/composables/useAgentChat.ts')
    assert.throws(() => useAgentChat({ value: 'chinese' }), /VITE_CHAT_MODE.*demo.*backend/)
  } finally {
    await vite.close()
  }
})
