export type SessionStatus = 'pending' | 'finished' | 'failure'
export interface SessionError { code: string; message: string; httpStatusCode: number }
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  status?: 'streaming' | 'complete' | 'stopped'
}

export interface ChatSession {
  id: string
  title: string
  updatedAt: number
  sessionStatus: SessionStatus
  sessionError: SessionError | null
  messages: Message[]
}
