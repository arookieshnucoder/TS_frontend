export interface SessionDto {
  id: string
  title: string
  createdAt: string
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: AbortSignal.timeout(10000),
    })
  } catch {
    throw new Error('无法连接后端或请求超时，请确认后端已启动后重试。')
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error?.message ?? `请求失败（${response.status}），请稍后重试。`)
  }
  if (!body || typeof body !== 'object' || !('data' in body)) throw new Error('后端响应格式不正确，请检查 API 地址。')
  return body.data as T
}

export const chatApi = {
  list: () => request<SessionDto[]>('/chat/sessions'),
  getById: (id: string) => request<SessionDto>(`/chat/sessions/${encodeURIComponent(id)}`),
  create: (title: string) => request<SessionDto>('/chat/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  }),
}
