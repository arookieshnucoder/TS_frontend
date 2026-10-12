import type { Message, SessionStatus, SessionError } from '../types/chat'
export interface SessionDto {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  modelRequestId: string | null
  messages: Message[]
  sessionStatus: SessionStatus
  sessionError: SessionError | null
}
export class ChatApiError extends Error {
  constructor(message: string, readonly httpStatusCode: number, readonly session?: SessionDto) {
    super(message)
  }
}
const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')
export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options, signal: options?.signal
        ? options.signal : AbortSignal.timeout(10000),
    })
  } catch { throw new Error('无法连接后端、请求已取消或连接超时，请检查网络后重试。') }
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new ChatApiError(body?.error?.message ?? `请求失败（HTTP ${response.status}）。`, response.status, body?.data)
  if (!body || typeof body !== 'object' || !('data' in body)) throw new Error('后端响应格式不正确。')
  return body.data as T
}
export const chatApi = {
  list: () => request<SessionDto[]>('/chat/sessions'),
  getById: (id: string) => request<SessionDto>(`/chat/sessions/${encodeURIComponent(id)}`),
  create: (title: string) => request<SessionDto>('/chat/sessions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
  }),
  send: (id: string, content: string, signal: AbortSignal) => request<SessionDto>(`/chat/sessions/${encodeURIComponent(id)}/messages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }), signal,
  }),
}
