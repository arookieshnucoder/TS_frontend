import { ref } from 'vue'
import { request } from './http'

// 管理员令牌仅保存在页面内存中，不写入浏览器存储或构建产物。
export const adminToken = ref('')
/** 管理接口统一附带当前令牌，并把调用方取消与管理请求超时合并。 */
export function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(130000)
  return request<T>(path, { ...options, signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
    headers: { ...Object.fromEntries(new Headers(options.headers)),
      ...(adminToken.value ? { Authorization: `Bearer ${adminToken.value}` } : {}) } })
}
