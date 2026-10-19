import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const backendDirectory = fileURLToPath(new URL('../../../backend/', import.meta.url))

// Check before starting Vite/HTTP/MCP so a stale CI checkout fails without leaking handles.
export async function checkBackend(directory = backendDirectory) {
  const required = [
    'src/bootstrap/container.ts',
    'src/modules/mcp/mcp.module.ts',
    'src/modules/observability/observability.module.ts',
    'src/modules/auth/auth.module.ts',
    'tests/auth-fixtures.ts',
    'tests/fixtures/mcp-server.mjs',
  ]
  const missing = (await Promise.all(required.map(async path => {
    try { await access(join(directory, path)); return null }
    catch (error) { if (error.code === 'ENOENT') return path; throw error }
  }))).filter(Boolean)
  if (missing.length) {
    throw new Error(`Incompatible integration backend at ${directory}. Missing: ${missing.join(', ')}. ` +
      'Use the latest backend default branch with SSO authentication, MCP Hub and run observability support; see .github/workflows/ci.yml.')
  }
  return { directory, fixture: join(directory, 'tests/fixtures/mcp-server.mjs') }
}
