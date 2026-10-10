import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ChatSession, Message } from '../types/chat'
import { getMockReply } from '../data/mock'
import { chatApi, type SessionDto } from '../api/chat'

// Keep the previous offline demo history untouched.
const STORAGE_KEY = 'songjian-chat-api-v1'
const isMessage = (value: unknown): value is Message => {
  if (!value || typeof value !== 'object') return false
  const message = value as Message
  return typeof message.id === 'string' && ['user', 'assistant'].includes(message.role)
    && typeof message.content === 'string'
}
const isSession = (value: unknown): value is ChatSession => {
  if (!value || typeof value !== 'object') return false
  const session = value as ChatSession
  return typeof session.id === 'string' && typeof session.title === 'string'
    && typeof session.updatedAt === 'number' && Number.isFinite(session.updatedAt)
    && Array.isArray(session.messages) && session.messages.every(isMessage)
}

export function useChat() {
  const storageError = ref('')
  const apiError = ref('')
  const isLoading = ref(true)
  const isPending = ref(false)
  let disposed = false
  let initial: ChatSession[] = []
  let savedId = ''
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (!Array.isArray(parsed.sessions) || !parsed.sessions.every(isSession)) {
        throw new Error('Invalid saved sessions')
      }
      initial = parsed.sessions
      for (const session of initial) {
        for (const message of session.messages) {
          if (message.status === 'streaming') {
            message.status = 'stopped'
            message.content ||= '回复已中断，可以发送消息继续聊天。'
          }
        }
      }
      savedId = typeof parsed.activeId === 'string' ? parsed.activeId : ''
    }
  } catch {
    storageError.value = '本地消息暂时无法读取，将从后端加载会话列表。'
  }
  const sessions = ref<ChatSession[]>([])
  const activeId = ref('')
  // Messages remain local; the server determines which sessions exist.
  const cachedSessions = new Map(initial.map((session) => [session.id, session]))
  const activeSession = computed(() => sessions.value.find((session) => session.id === activeId.value))
  const generatingId = ref<string | null>(null)
  let timer: ReturnType<typeof setInterval> | undefined
  let saveTimer: ReturnType<typeof setTimeout> | undefined

  function persist() {
    try {
      for (const session of sessions.value) cachedSessions.set(session.id, session)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        sessions: [...cachedSessions.values()], activeId: activeId.value,
      }))
    } catch {
      storageError.value = '浏览器暂时无法保存对话，刷新后本次记录可能丢失。'
    }
  }
  watch([sessions, activeId], () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(persist, 250)
  }, { deep: true })

  function toSession(dto: SessionDto): ChatSession {
    const cached = sessions.value.find((session) => session.id === dto.id) ?? cachedSessions.get(dto.id)
    return {
      id: dto.id, title: dto.title,
      updatedAt: cached?.updatedAt ?? Date.parse(dto.createdAt),
      messages: cached?.messages ?? [],
    }
  }
  function reportError(error: unknown) {
    apiError.value = error instanceof Error ? error.message : '请求失败，请稍后重试。'
  }
  async function loadSessions() {
    if (isPending.value) return
    isLoading.value = true
    apiError.value = ''
    try {
      const data = await chatApi.list()
      if (disposed) return
      sessions.value = data.map(toSession).sort((a, b) => b.updatedAt - a.updatedAt)
      const preferredId = activeId.value || savedId
      activeId.value = sessions.value.some((session) => session.id === preferredId)
        ? preferredId : (sessions.value[0]?.id ?? '')
    } catch (error) {
      if (!disposed) reportError(error)
    } finally {
      if (!disposed) isLoading.value = false
    }
  }
  onMounted(loadSessions)

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
  async function selectSession(id: string): Promise<boolean> {
    if (isPending.value || isLoading.value) return false
    isPending.value = true
    apiError.value = ''
    try {
      const dto = await chatApi.getById(id)
      if (disposed) return false
      const index = sessions.value.findIndex((session) => session.id === id)
      if (index >= 0) sessions.value[index] = toSession(dto)
      activeId.value = id
      return true
    } catch (error) {
      reportError(error)
      return false
    } finally {
      isPending.value = false
    }
  }
  async function addSession(title: string): Promise<ChatSession> {
    const dto = await chatApi.create(title)
    const session = toSession(dto)
    if (!disposed) {
      sessions.value.unshift(session)
      activeId.value = session.id
      // Return the reactive proxy so streaming updates also render for the first message.
      return sessions.value[0]!
    }
    return session
  }
  async function createSession(): Promise<boolean> {
    if (isPending.value || isLoading.value) return false
    isPending.value = true
    apiError.value = ''
    try {
      await addSession('新对话')
      return !disposed
    } catch (error) {
      reportError(error)
      return false
    } finally {
      isPending.value = false
    }
  }
  async function sendMessage(text: string): Promise<boolean> {
    const content = text.trim()
    if (!content || isPending.value || isLoading.value) return false
    isPending.value = true
    apiError.value = ''
    let session = activeSession.value
    try {
      if (session) {
        // Detect sessions lost after a backend restart before adding local messages.
        await chatApi.getById(session.id)
      } else {
        session = await addSession(content.replace(/\s+/g, ' ').slice(0, 24))
      }
      if (disposed) return false
    } catch (error) {
      reportError(error)
      return false
    } finally {
      isPending.value = false
    }
    if (generatingId.value) stopGeneration()
    session.updatedAt = Date.now()
    session.messages.push({ id: crypto.randomUUID(), role: 'user', content })
    session.messages.push({ id: crypto.randomUUID(), role: 'assistant', content: '', status: 'streaming' })
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
    return true
  }
  window.addEventListener('pagehide', persist)
  onBeforeUnmount(() => {
    disposed = true
    stopGeneration()
    clearTimeout(saveTimer)
    window.removeEventListener('pagehide', persist)
  })
  return {
    sessions, activeId, activeSession, generatingId, storageError,
    apiError, isLoading, isPending, loadSessions,
    createSession, selectSession, sendMessage, stopGeneration,
  }
}
