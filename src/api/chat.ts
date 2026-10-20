import type { SessionDto } from '../types/chat'
import { request } from './http'
export type { SessionDto } from '../types/chat'
// Keep the existing public imports usable while other APIs depend on the transport directly.
export { ChatApiError, request } from './http'

/** 真实后端和本地演示都实现此接口，会话状态管理无需知道数据来自哪里。 */
export interface ChatApi {
  list(): Promise<SessionDto[]>
  getById(id: string): Promise<SessionDto>
  create(title: string): Promise<SessionDto>
  send(id: string, content: string, signal: AbortSignal): Promise<SessionDto>
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
