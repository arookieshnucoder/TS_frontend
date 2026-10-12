import { adminRequest } from './management'

export interface McpServer {
  id: string
  name: string
  transport: 'stdio' | 'http' | 'sse'
  enabled: boolean
  allowMutations: boolean
  status: 'disabled' | 'disconnected' | 'connecting' | 'connected' | 'error'
  error?: string
  tools: { name: string; description: string; readonly: boolean; available: boolean }[]
}
const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
export const mcpApi = {
  list: (signal?: AbortSignal) => adminRequest<McpServer[]>('/mcp/servers', { signal }),
  import: (value: unknown, signal?: AbortSignal) => adminRequest<McpServer[]>('/mcp/servers/import', { method: 'POST', ...json(value), signal }),
  update: (id: string, value: { enabled?: boolean; allowMutations?: boolean }, signal?: AbortSignal) =>
    adminRequest<McpServer[]>(`/mcp/servers/${encodeURIComponent(id)}`, { method: 'PATCH', ...json(value), signal }),
  test: (id: string, signal?: AbortSignal) => adminRequest<McpServer>(`/mcp/servers/${encodeURIComponent(id)}/test`, { method: 'POST', ...json({}), signal }),
}
