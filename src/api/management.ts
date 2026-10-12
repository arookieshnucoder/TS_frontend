import { ref } from 'vue'
import { request } from './chat'

// Kept only in memory. Never put administrator credentials in localStorage or bundles.
export const adminToken = ref('')
export function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(130000)
  return request<T>(path, { ...options, signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
    headers: { ...Object.fromEntries(new Headers(options.headers)),
      ...(adminToken.value ? { Authorization: `Bearer ${adminToken.value}` } : {}) } })
}
