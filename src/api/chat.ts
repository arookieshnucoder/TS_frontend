import type { SessionDto } from '../types/chat'
export type { SessionDto } from '../types/chat'

/** 真实后端和本地演示都实现此接口，会话状态管理无需知道数据来自哪里。 */
export interface ChatApi {
  list(): Promise<SessionDto[]>
  getById(id: string): Promise<SessionDto>
  create(title: string): Promise<SessionDto>
  send(id: string, content: string, signal: AbortSignal): Promise<SessionDto>
}

/** HTTP 失败时保留后端返回的会话快照，供界面还原真实状态。 */
export class ChatApiError extends Error {
  constructor(message: string, readonly httpStatusCode: number, readonly session?: SessionDto) {
    super(message)
  }
}
const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')
/** 统一处理超时和响应信封；失败响应中的会话数据随错误一起传递。 */
export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options, signal: options?.signal ?? AbortSignal.timeout(10000),
    })
  } catch { throw new Error('无法连接后端、请求已取消或连接超时，请检查网络后重试。') }
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new ChatApiError(body?.error?.message ?? `请求失败（HTTP ${response.status}）。`, response.status, body?.data)
  if (!body || typeof body !== 'object' || !('data' in body)) throw new Error('后端响应格式不正确。')
  return body.data as T
}
/** 聊天 REST 接口，发送消息的取消信号由会话状态管理器控制。 */
export const chatApi: ChatApi = {
  list: () => request<SessionDto[]>('/chat/sessions'),
  getById: (id: string) => request<SessionDto>(`/chat/sessions/${encodeURIComponent(id)}`),
  create: (title: string) => request<SessionDto>('/chat/sessions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
  }),
  send: (id: string, content: string, signal: AbortSignal) => request<SessionDto>(`/chat/sessions/${encodeURIComponent(id)}/messages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }), signal,
  }),
}
