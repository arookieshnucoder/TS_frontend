import { ref, type InjectionKey } from 'vue'
import { authApi, type AuthUser } from '../api/auth'
import { ChatApiError } from '../api/chat'
import { adminToken } from '../api/management'

/** Only public identity lives in memory. The browser owns the HttpOnly session cookie. */
export function useAuth() {
  const user = ref<AuthUser | null>(null)
  const ready = ref(false)
  const busy = ref(false)
  const error = ref('')
  async function perform(operation: () => Promise<{ user: AuthUser | null }>) {
    if (busy.value) return false
    busy.value = true; error.value = ''
    try { user.value = (await operation()).user; return true }
    catch (failure) {
      error.value = failure instanceof ChatApiError && failure.httpStatusCode >= 500 ? '登录服务暂时不可用，请稍后重试。'
        : failure instanceof Error ? failure.message : '登录服务暂时不可用，请重试。'
      return false
    }
    finally { busy.value = false }
  }
  async function initialize() { await perform(authApi.session); ready.value = true }
  function expire() { user.value = null; adminToken.value = ''; error.value = '登录已过期，请重新登录。' }
  return { user, ready, busy, error, initialize, expire,
    submit: (mode: 'login' | 'register', username: string, password: string) => perform(() => authApi[mode](username, password)),
    logout: async () => { if (await perform(authApi.logout)) adminToken.value = '' },
  }
}
export type AuthState = ReturnType<typeof useAuth>
export const authKey: InjectionKey<AuthState> = Symbol('authentication')
