import { request } from './http'

export interface AuthUser {
  userId: string
  username: string
  role: 'admin' | 'user'
  createdAt: string
  loginAt: string | null
}
interface Session { user: AuthUser | null }
const submit = (action: string, body: unknown) => request<Session>(`/auth/${action}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})
export const authApi = {
  session: () => request<Session>('/auth/session'),
  login: (username: string, password: string) => submit('login', { username, password }),
  register: (username: string, password: string) => submit('register', { username, password }),
  logout: () => submit('logout', {}),
}
