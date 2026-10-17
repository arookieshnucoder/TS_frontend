import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ChatSession, Message } from '../types/chat'
import { chatApi, ChatApiError, type SessionDto } from '../api/chat'

export function useChat(api: typeof chatApi = chatApi) {
  const sessions = ref<ChatSession[]>([])
  const activeId = ref('')
  const apiError = ref('')
  const isLoading = ref(true)
  const isPending = ref(false)
  const isTyping = ref(false)
  const pendingSessionId = ref<string | null>(null)
  const activeSession = computed(() => sessions.value.find(session => session.id === activeId.value))
  let disposed = false
  let generation: AbortController | undefined
  let finishTyping: (() => void) | undefined
  function revealReply(message: Message): Promise<void> {
    if (!message.content || (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      return Promise.resolve()
    }
    const fullContent = message.content
    // Keep emoji, combining marks and joined characters intact while revealing text.
    const characters = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(fullContent), part => part.segment)
    const rate = Math.max(80 / 1000, characters.length / 8000)
    const started = performance.now()
    message.content = ''
    message.status = 'streaming'
    isTyping.value = true
    return new Promise(resolve => {
      let timer: ReturnType<typeof setTimeout> | undefined
      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        clearTimeout(timer)
        if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibilityChange)
        message.content = fullContent
        message.status = 'complete'
        isTyping.value = false
        finishTyping = undefined
        resolve()
      }
      const onVisibilityChange = () => { if (document.hidden) finish() }
      const tick = () => {
        const count = Math.min(characters.length, Math.max(1, Math.floor((performance.now() - started) * rate)))
        if (count === characters.length) { finish(); return }
        message.content = characters.slice(0, count).join('')
        timer = setTimeout(tick, 16)
      }
      finishTyping = finish
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onVisibilityChange)
        if (document.hidden) { finish(); return }
      }
      timer = setTimeout(tick, 16)
    })
  }
  const toSession = (dto: SessionDto): ChatSession => ({
    id: dto.id, title: dto.title, updatedAt: Date.parse(dto.updatedAt),
    sessionStatus: dto.sessionStatus, sessionError: dto.sessionError,
    messages: dto.messages.map(message => ({ ...message, status: 'complete' })),
  })
  function reportError(error: unknown) {
    if (!disposed) apiError.value = error instanceof Error ? error.message : '请求失败，请稍后重试。'
  }
  function replaceSession(dto: SessionDto) {
    const index = sessions.value.findIndex(session => session.id === dto.id)
    if (index >= 0) sessions.value[index] = toSession(dto)
    else sessions.value.push(toSession(dto))
    sessions.value.sort((a, b) => b.updatedAt - a.updatedAt)
  }
  async function loadSessions() {
    if (isPending.value || pendingSessionId.value) return
    isLoading.value = true
    apiError.value = ''
    try {
      const data = await api.list()
      if (disposed) return
      sessions.value = data.map(toSession).sort((a, b) => b.updatedAt - a.updatedAt)
      if (!sessions.value.some(session => session.id === activeId.value)) activeId.value = sessions.value[0]?.id ?? ''
    } catch (error) { reportError(error) }
    finally { if (!disposed) isLoading.value = false }
  }
  onMounted(loadSessions)
  async function selectSession(id: string): Promise<boolean> {
    if (isPending.value || isLoading.value || pendingSessionId.value) return false
    isPending.value = true
    apiError.value = ''
    try {
      const dto = await api.getById(id)
      if (disposed) return false
      replaceSession(dto)
      activeId.value = id
      return true
    } catch (error) { reportError(error); return false }
    finally { isPending.value = false }
  }
  async function addSession(title: string) {
    const dto = await api.create(title)
    if (!disposed) { replaceSession(dto); activeId.value = dto.id }
    return dto.id
  }
  async function createSession(): Promise<boolean> {
    if (isPending.value || isLoading.value || pendingSessionId.value) return false
    isPending.value = true
    apiError.value = ''
    try { await addSession('新对话'); return !disposed }
    catch (error) { reportError(error); return false }
    finally { isPending.value = false }
  }
  async function sendMessage(text: string): Promise<boolean> {
    const content = text.trim()
    if (!content || isPending.value || isLoading.value || pendingSessionId.value) return false
    if (content.length > 12000) { apiError.value = '消息不能超过 12000 个字符。'; return false }
    isPending.value = true
    apiError.value = ''
    const controller = new AbortController()
    generation = controller
    let session: ChatSession | undefined
    let originalMessages: ChatSession['messages'] = []
    try {
      const id = activeId.value || await addSession('新对话')
      if (disposed) return false
      session = sessions.value.find(item => item.id === id)!
      originalMessages = [...session.messages]
      session.sessionStatus = 'pending'
      session.sessionError = null
      session.messages.push({ id: crypto.randomUUID(), role: 'user', content },
        { id: crypto.randomUUID(), role: 'assistant', content: '', status: 'streaming' })
      pendingSessionId.value = id
      const dto = await api.send(id, content, controller.signal)
      if (disposed || controller.signal.aborted) return false
      replaceSession(dto)
      const reply = sessions.value.find(item => item.id === id)?.messages.at(-1)
      if (reply?.role === 'assistant') await revealReply(reply)
      return !disposed
    } catch (error) {
      if (error instanceof ChatApiError && error.session) replaceSession(error.session)
      else {
        const current = sessions.value.find(item => item.id === session?.id)
        if (current) {
          current.messages = originalMessages
          current.sessionStatus = 'failure'
          current.sessionError = null
        }
      }
      reportError(error)
      return false
    } finally {
      // Remove optimistic messages on failure or cancellation; the composer keeps the draft.
      if (session && sessions.value.includes(session)) session.messages = originalMessages
      generation = undefined
      pendingSessionId.value = null
      isPending.value = false
    }
  }
  function stopGeneration() {
    if (finishTyping) finishTyping()
    else generation?.abort()
  }
  onBeforeUnmount(() => { disposed = true; stopGeneration() })
  return { sessions, activeId, activeSession, pendingSessionId, apiError, isLoading, isPending, isTyping,
    loadSessions, createSession, selectSession, sendMessage, stopGeneration }
}
