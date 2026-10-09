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
  messages: Message[]
}
