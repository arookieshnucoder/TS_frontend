import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { ChatSession, Message } from '../types/chat'
import { createMockSessions, getMockReply } from '../data/mock'

const STORAGE_KEY = 'songjian-chat-v1'
const isMessage = (value: unknown): value is Message => {
  if (!value || typeof value !== 'object') return false
  const message = value as Message
  return (
    typeof message.id === 'string' &&
    ['user', 'assistant'].includes(message.role) &&
    typeof message.content === 'string'
  )
}
const isSession = (value: unknown): value is ChatSession => {
  if (!value || typeof value !== 'object') return false
  const session = value as ChatSession
  return (
    typeof session.id === 'string' &&
    typeof session.title === 'string' &&
    typeof session.updatedAt === 'number' &&
    Number.isFinite(session.updatedAt) &&
    Array.isArray(session.messages) &&
    session.messages.every(isMessage)
  )
}

export function useChat() {
  const storageError = ref('')
  let initial = createMockSessions()
  let savedId = initial[0]!.id
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (
        !Array.isArray(parsed.sessions) ||
        !parsed.sessions.length ||
        !parsed.sessions.every(isSession)
      )
        throw new Error('Invalid saved sessions')
      initial = parsed.sessions
      for (const session of initial)
        for (const message of session.messages) {
          if (message.status === 'streaming') {
            message.status = 'stopped'
            message.content ||= '回复已中断，可以发送消息继续聊天。'
          }
        }
      savedId = initial.some((session) => session.id === parsed.activeId)
        ? parsed.activeId
        : initial[0]!.id
    }
  } catch {
    storageError.value = '本地记录暂时无法读取，已加载演示对话。'
  }
  const sessions = ref<ChatSession[]>(initial)
  const activeId = ref<string>(savedId)
  const activeSession = computed(() =>
    sessions.value.find((session) => session.id === activeId.value),
  )
  const generatingId = ref<string | null>(null)
  let timer: ReturnType<typeof setInterval> | undefined
  let saveTimer: ReturnType<typeof setTimeout> | undefined

  function persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ sessions: sessions.value, activeId: activeId.value }),
      )
    } catch {
      storageError.value = '浏览器暂时无法保存对话，刷新后本次记录可能丢失。'
    }
  }
  watch(
    [sessions, activeId],
    () => {
      clearTimeout(saveTimer)
      saveTimer = setTimeout(persist, 250)
    },
    { deep: true },
  )

  function stopGeneration() {
    clearInterval(timer)
    const session = sessions.value.find((item) => item.id === generatingId.value)
    const last = session?.messages.at(-1)
    if (last?.status === 'streaming') {
      last.status = 'stopped'
      last.content ||= '已停止生成。随时可以继续聊。'
    }
    generatingId.value = null
    persist()
  }
  function selectSession(id: string) {
    if (sessions.value.some((session) => session.id === id)) activeId.value = id
  }
  function createSession() {
    const empty = sessions.value.find((session) => !session.messages.length)
    if (empty) {
      activeId.value = empty.id
      return
    }
    const session: ChatSession = {
      id: crypto.randomUUID(),
      title: '新对话',
      messages: [],
      updatedAt: Date.now(),
    }
    sessions.value.unshift(session)
    activeId.value = session.id
  }
  function sendMessage(text: string) {
    const content = text.trim()
    const session = activeSession.value
    if (!content || !session) return
    if (generatingId.value) stopGeneration()
    if (!session.messages.length) session.title = content.replace(/\s+/g, ' ').slice(0, 24)
    session.updatedAt = Date.now()
    session.messages.push({ id: crypto.randomUUID(), role: 'user', content })
    session.messages.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      status: 'streaming',
    })
    const reply = session.messages.at(-1)!
    const answer = getMockReply(content)
    sessions.value.sort((a, b) => b.updatedAt - a.updatedAt)
    generatingId.value = session.id
    persist()
    let position = 0
    let ticks = 0
    timer = setInterval(() => {
      if (++ticks < 8) return
      position += 3
      reply.content = answer.slice(0, position)
      if (position >= answer.length) {
        clearInterval(timer)
        reply.status = 'complete'
        generatingId.value = null
        persist()
      }
    }, 24)
  }
  window.addEventListener('pagehide', persist)
  onBeforeUnmount(() => {
    stopGeneration()
    clearTimeout(saveTimer)
    window.removeEventListener('pagehide', persist)
  })
  return {
    sessions,
    activeId,
    activeSession,
    generatingId,
    storageError,
    createSession,
    selectSession,
    sendMessage,
    stopGeneration,
  }
}
