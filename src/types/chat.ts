/** 后端会话状态；与仅用于界面动画的消息 status 分开。 */
export type SessionStatus = 'pending' | 'finished' | 'failure'
/** 后端公开的错误信息，用于展示本次请求失败原因。 */
export interface SessionError { code: string; message: string; httpStatusCode: number }
/** 服务端保存的消息字段，不包含前端逐字显示的临时状态。 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

/** 会话 HTTP 响应，日期使用 ISO 字符串；真实接口和演示接口共用此结构。 */
export interface SessionDto {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  modelRequestId: string | null
  sessionStatus: SessionStatus
  sessionError: SessionError | null
  messages: ChatMessage[]
}

/** 界面消息增加逐字显示状态，收到完整后端响应后才播放动画。 */
export interface Message extends ChatMessage { status?: 'streaming' | 'complete' }

/** 界面会话复用响应字段，只转换排序时间和消息展示状态。 */
export interface ChatSession extends Omit<SessionDto, 'createdAt' | 'modelRequestId' | 'updatedAt' | 'messages'> {
  updatedAt: number
  messages: Message[]
}
