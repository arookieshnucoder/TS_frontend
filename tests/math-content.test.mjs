import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestServer } from './helpers/vite.mjs'

test('math formulas render locally, unsafe commands cannot inject HTML, incomplete input remains readable', async () => {
  const vite = await createTestServer()
  try {
    const { mathSegments } = await vite.ssrLoadModule('/src/utils/math-content.ts')
    const segments = mathSegments('解得 $x=\\frac{1}{2}$，检验：$$x^2=\\frac14$$')
    assert.equal(segments.filter(s => s.type === 'math').length, 2)
    assert.match(segments.find(s => s.type === 'math').html, /katex/)
    assert.equal(segments.filter(s => s.type === 'math')[1].display, true)
    assert.deepEqual(mathSegments('尚未完成 $x^2'), [{ type: 'text', text: '尚未完成 $x^2' }])
    assert.deepEqual(mathSegments('<img src=x onerror=alert(1)>'), [{ type: 'text', text: '<img src=x onerror=alert(1)>' }])
    const unsafe = mathSegments('$\\href{javascript:alert(1)}{点此}$')[0].html
    assert.doesNotMatch(unsafe, /href="javascript:|<script|<img/)
    assert.deepEqual(mathSegments('$' + 'x'.repeat(4001) + '$')[0].type, 'text')
  } finally { await vite.close() }
})
