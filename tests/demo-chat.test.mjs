import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestServer } from './helpers/vite.mjs'

test('demo transport persists separate subjects, labels examples, and never requires a network', async () => {
  const vite = await createTestServer()
  const values = new Map()
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const originalFetch = globalThis.fetch
  let requests = 0, warnings = 0
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  globalThis.fetch = async () => { requests++; throw new Error('Demo must work offline') }
  try {
    const { createDemoChatApi } = await vite.ssrLoadModule('/src/api/demo-chat.ts')
    const { subjects } = await vite.ssrLoadModule('/src/config/subjects.ts')
    const subject = { value: 'chinese' }
    const api = createDemoChatApi(subject, () => warnings++)
    const chinese = await api.create('新对话')
    const reply = await api.send(chinese.id, '赏析杜甫《春望》', new AbortController().signal)
    assert.equal(reply.messages.length, 2)
    assert.match(reply.messages[1].content, /本地演示.*预设学习示例/)
    assert.match(reply.messages[1].content, /情景交融/)
    // DTO consumers can mutate their copy without corrupting the saved conversation.
    reply.messages.length = 0
    assert.equal((await api.getById(chinese.id)).messages.length, 2)
    subject.value = 'math'
    assert.deepEqual(await api.list(), [])
    await assert.rejects(api.getById(chinese.id), /不存在/)
    const math = await api.create('新对话')
    const solved = await api.send(math.id, '解方程 x² - 5x + 6 = 0，并检验答案', new AbortController().signal)
    assert.match(solved.messages[1].content, /x=2/)
    assert.match(solved.messages[1].content, /x=3/)
    const fallback = await api.send(math.id, '计算 987 × 613', new AbortController().signal)
    assert.match(fallback.messages.at(-1).content, /暂时不能求解任意题目/)
    const restored = createDemoChatApi(subject, () => warnings++)
    assert.equal((await restored.list())[0].messages.length, 4)
    subject.value = 'chinese'
    assert.equal((await restored.list())[0].id, chinese.id)
    const expectedReplies = {
      chinese: [/苏轼的《定风波/, /观察|散步的路线/, /刘禹锡.*陋室铭/, /反复/],
      math: [/x=2/, /最小值 −3/, /sqrt\{7\}/, /frac\{1\}\{3\}/],
      english: [/\bC\b[^\n]*little brother/i, /\bC\b[^\n]*had left/i, /\bA\b[^\n]*However/, /\bB\b[^\n]*(?:Unwilling|hesitant)/i],
    }
    let verifiedCards = 0
    for (const key of ['chinese', 'math', 'english']) {
      subject.value = key
      const exampleSession = await api.create('题卡验收')
      assert.equal(subjects[key].suggestions.length, 4)
      for (const [index, card] of subjects[key].suggestions.entries()) {
        const result = await api.send(exampleSession.id, card.text, new AbortController().signal)
        assert.match(result.messages.at(-1).content, expectedReplies[key][index], `${key}: ${card.title}`)
        assert.doesNotMatch(result.messages.at(-1).content, /暂时不能/)
        assert.equal(result.messages.at(-2).content, card.text, 'passage and option capitalization are preserved')
        verifiedCards++
      }
    }
    assert.equal(verifiedCards, 12, 'all three subjects retain four working cards')
    const englishId = (await api.list())[0].id
    const expectedEnglishEvidence = [/原文|依据/, /过去完成时|past perfect/i, /转折/, /不情愿|犹豫/]
    for (const [index, card] of subjects.english.suggestions.entries()) {
      for (const variant of [card.text.toUpperCase(), card.text.toLowerCase().replace(/\n/g, '\n  \n')]) {
        const result = await api.send(englishId, variant, new AbortController().signal)
        assert.equal(result.messages.at(-2).content, variant, 'matching does not alter the submitted English capitalization or spacing')
        assert.match(result.messages.at(-1).content, expectedReplies.english[index], `English option stays correct when casing changes: ${card.title}`)
        assert.match(result.messages.at(-1).content, expectedEnglishEvidence[index], `English answer explains its evidence: ${card.title}`)
        assert.doesNotMatch(result.messages.at(-1).content, /暂时不能|这是语文 Agent|这是数学 Agent/)
      }
    }
    for (const question of ['Please help me understand a new passage.', '作文开头：春望', '解方程 x² - 5x + 6 = 0']) {
      const result = await api.send(englishId, question, new AbortController().signal)
      const answer = result.messages.at(-1).content
      assert.match(answer, /英语|English/i, 'an unrecognized English request stays in the English agent')
      assert.doesNotMatch(answer, /这是语文 Agent|这是数学 Agent|情景交融|x=2/)
      assert.match(answer, /本地演示/)
    }
    const englishRestored = createDemoChatApi(subject, () => warnings++)
    assert.equal((await englishRestored.list())[0].id, englishId)
    await assert.rejects(englishRestored.getById(chinese.id), /不存在/)
    assert.equal(requests, 0)
    assert.equal(warnings, 0)
  } finally {
    globalThis.fetch = originalFetch
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage)
    else delete globalThis.localStorage
    await vite.close()
  }
})

test('demo storage failures retain the in-memory session and aborted sends preserve history', async () => {
  const vite = await createTestServer()
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  let warnings = 0
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => '{broken json',
    setItem: () => { throw new Error('QuotaExceededError') },
  } })
  try {
    const { createDemoChatApi } = await vite.ssrLoadModule('/src/api/demo-chat.ts')
    const api = createDemoChatApi({ value: 'chinese' }, () => warnings++)
    assert.deepEqual(await api.list(), [])
    const session = await api.create('新对话')
    const controller = new AbortController()
    controller.abort()
    await assert.rejects(api.send(session.id, '不应保存', controller.signal))
    assert.deepEqual((await api.getById(session.id)).messages, [])
    await api.send(session.id, '作文开头', new AbortController().signal)
    assert.equal((await api.list())[0].messages.length, 2)
    assert.ok(warnings >= 2)
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage)
    else delete globalThis.localStorage
    await vite.close()
  }
})
