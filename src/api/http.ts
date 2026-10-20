import type { SessionDto } from '../types/chat'

/** 保留失败响应中的会话快照，供聊天界面恢复状态；旧名称兼容现有调用方。 */
export class ChatApiError extends Error {
  constructor(message: string, readonly httpStatusCode: number, readonly session?: SessionDto) {
    super(message)
  }
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')
/** HTTP 传输与具体业务 API 分离，统一处理取消、认证事件和响应信封。 */
export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options, credentials: 'include', signal: options?.signal ?? AbortSignal.timeout(10000),
      headers: { ...Object.fromEntries(new Headers(options?.headers)),
        ...(!['GET', 'HEAD'].includes(options?.method?.toUpperCase() ?? 'GET') ? { 'X-Requested-With': 'XMLHttpRequest' } : {}) },
    })
  } catch { throw new Error('无法连接后端、请求已取消或连接超时，请检查网络后重试。') }
  const body = await response.json().catch(() => null)
  if (response.status === 401 && body?.error?.code === 'AUTH_REQUIRED' && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('songjian-auth-required'))
  }
  if (!response.ok) throw new ChatApiError(body?.error?.message ?? `请求失败（HTTP ${response.status}）。`, response.status, body?.data)
  if (!body || typeof body !== 'object' || !('data' in body)) throw new Error('后端响应格式不正确。')
  return body.data as T
}
