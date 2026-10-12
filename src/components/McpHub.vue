<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { mcpApi, type McpServer } from '../api/mcp'
import { adminToken } from '../api/management'

const servers = ref<McpServer[]>([])
const loaded = ref(false)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const importOpen = ref(false)
const mode = ref<'form' | 'json'>('form')
const json = ref('')
const form = ref({ id: '', name: '', transport: 'http', command: '', args: '', cwd: '', url: '' })
const enabledCount = computed(() => servers.value.filter(s => s.enabled).length)
const statusLabels = { disabled: '已停用', disconnected: '待连接', connecting: '连接中', connected: '已连接', error: '连接异常' }
const lifetime = new AbortController()
let disposed = false
onBeforeUnmount(() => { disposed = true; lifetime.abort() })
async function act(operation: () => Promise<void>) {
  if (busy.value) return
  busy.value = true; error.value = ''; notice.value = ''
  try { await operation() } catch (e) { if (!disposed) error.value = e instanceof Error ? e.message : 'MCP 操作失败，请重试。' }
  finally { if (!disposed) busy.value = false }
}
async function load() {
  await act(async () => { servers.value = await mcpApi.list(lifetime.signal); loaded.value = true })
}
function onToggle(event: Event) {
  if ((event.currentTarget as HTMLDetailsElement).open && !loaded.value) void load()
}
async function submit(value?: unknown) {
  await act(async () => {
    const current = form.value
    const config = value ?? (mode.value === 'json' ? JSON.parse(json.value) : {
      id: current.id, name: current.name || current.id, transport: current.transport,
      ...(current.transport === 'stdio' ? { command: current.command, args: current.args ? current.args.split(/\r?\n/) : [], ...(current.cwd ? { cwd: current.cwd } : {}) } : { url: current.url }),
    })
    servers.value = await mcpApi.import(config, lifetime.signal)
    loaded.value = true; importOpen.value = false; json.value = ''
    notice.value = '配置已保存，开启开关后供 Agent 使用。'
  })
}
async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    if (file.size > 1024 * 1024) throw new Error('JSON 文件不能超过 1 MB。')
    await submit(JSON.parse(await file.text()))
  } catch (e) { error.value = e instanceof Error ? e.message : '文件格式错误。' }
  finally { input.value = '' }
}
async function test(server: McpServer) {
  const updated = await mcpApi.test(server.id, lifetime.signal)
  servers.value = servers.value.map(s => s.id === updated.id ? updated : s)
  notice.value = updated.status === 'connected' ? `${server.name} 连接正常。` : ''
}
async function toggle(server: McpServer, field: 'enabled' | 'allowMutations') {
  await act(async () => {
    servers.value = await mcpApi.update(server.id, { [field]: !server[field] }, lifetime.signal)
    const updated = servers.value.find(s => s.id === server.id)
    if (updated?.enabled) await test(updated)
  })
}
function changePermission(server: McpServer, event: Event) {
  // Restore the server state until the backend accepts the change.
  ;(event.target as HTMLInputElement).checked = server.allowMutations
  void toggle(server, 'allowMutations')
}
</script>

<template>
  <details class="mcp-hub" @toggle="onToggle">
    <summary><span class="hub-symbol">◇</span> MCP Hub <span class="hub-count">{{ enabledCount }} 已启用</span></summary>
    <div class="hub-body" :aria-busy="busy">
      <p class="hub-help">连接工具，按需调用。配置在下一次回答时生效；停用会关闭连接。</p>
      <details class="hub-auth">
        <summary>远程管理认证</summary>
        <label>管理员令牌<input v-model="adminToken" type="password" autocomplete="off" aria-label="MCP 管理员令牌" placeholder="本机未配置令牌时可留空" /></label>
        <p class="hub-help">令牌仅保留在当前页面内存中。</p>
      </details>
      <div class="hub-toolbar">
        <button type="button" :disabled="busy" @click="load">刷新</button>
        <button type="button" :disabled="busy" :aria-expanded="importOpen" @click="importOpen = !importOpen">{{ importOpen ? '收起导入' : '导入 MCP' }}</button>
      </div>
      <p v-if="error" class="hub-error" role="alert">{{ error }}</p>
      <p v-if="notice" class="hub-notice" role="status">{{ notice }}</p>
      <p v-if="busy" class="hub-help" role="status">正在处理…</p>
      <div v-if="importOpen" class="hub-import">
        <div class="hub-tabs" aria-label="导入方式">
          <button type="button" :aria-pressed="mode === 'form'" @click="mode = 'form'">填写配置</button>
          <button type="button" :aria-pressed="mode === 'json'" @click="mode = 'json'">JSON / 文件</button>
        </div>
        <form @submit.prevent="submit()">
          <template v-if="mode === 'form'">
            <label>服务 ID<input v-model="form.id" required maxlength="40" pattern="[a-zA-Z][a-zA-Z0-9_-]*" aria-label="MCP 服务 ID" placeholder="my-tools" /></label>
            <label>显示名称<input v-model="form.name" maxlength="80" aria-label="MCP 显示名称" placeholder="我的工具" /></label>
            <label>连接方式<select v-model="form.transport" aria-label="MCP 连接方式"><option value="http">Streamable HTTP</option><option value="stdio">本地进程 (stdio)</option><option value="sse">旧版 SSE</option></select></label>
            <template v-if="form.transport === 'stdio'">
              <label>程序<input v-model="form.command" required aria-label="MCP 程序" placeholder="node 或可执行文件完整路径" /></label>
              <label>参数（每行一个）<textarea v-model="form.args" aria-label="MCP 参数" rows="3" placeholder="D:/mcp/server.mjs" /></label>
              <label>工作目录（可选）<input v-model="form.cwd" aria-label="MCP 工作目录" /></label>
              <p class="hub-help">程序在后端主机运行，具有后端账户权限。仅连接你信任的服务。</p>
            </template>
            <label v-else>服务地址<input v-model="form.url" type="url" required aria-label="MCP 服务地址" placeholder="http://localhost:3001/mcp" /></label>
          </template>
          <template v-else>
            <label>JSON 配置<textarea v-model="json" required rows="7" aria-label="MCP JSON 配置" placeholder='{"mcpServers":{"my-tools":{"command":"node","args":["server.mjs"]}}}' /></label>
            <label class="hub-file">或选择 JSON 文件<input type="file" accept=".json,application/json" aria-label="导入 MCP JSON 文件" :disabled="busy" @change="importFile" /></label>
            <p class="hub-help">支持单个配置与 mcpServers。env / headers 可引用后端环境变量，例如 ${MY_TOKEN}。</p>
          </template>
          <button type="submit" class="hub-primary" :disabled="busy">保存配置</button>
        </form>
      </div>
      <p v-if="loaded && !servers.length" class="hub-empty">还没有连接工具。导入一个 MCP 开始使用。</p>
      <article v-for="server in servers" :key="server.id" class="hub-server">
        <div class="hub-server-heading">
          <strong>{{ server.name }}</strong>
          <button type="button" role="switch" :aria-checked="server.enabled" :aria-label="`启用 ${server.name}`" :disabled="busy" class="hub-switch" @click="toggle(server, 'enabled')"><span /></button>
        </div>
        <p class="hub-meta"><span class="hub-status" :data-status="server.status">{{ statusLabels[server.status] }}</span> · {{ server.transport }} · {{ server.id }}</p>
        <p v-if="server.error" class="hub-error">{{ server.error }}</p>
        <div class="hub-server-actions">
          <button type="button" :disabled="busy || !server.enabled" @click="act(() => test(server))">测试连接</button>
          <label class="hub-write"><input type="checkbox" :checked="server.allowMutations" :disabled="busy" :aria-label="`允许 ${server.name} 修改数据`" @change="changePermission(server, $event)" />允许修改数据</label>
        </div>
        <details v-if="server.tools.length" class="hub-tools">
          <summary>{{ server.tools.filter(t => t.available).length }} / {{ server.tools.length }} 个工具可用</summary>
          <ul><li v-for="tool in server.tools" :key="tool.name"><strong>{{ tool.name }}</strong><span>{{ tool.readonly ? '只读' : '可修改' }} · {{ tool.available ? '可用' : '未开放' }}</span><p v-if="tool.description">{{ tool.description }}</p></li></ul>
        </details>
      </article>
    </div>
  </details>
</template>

<style scoped>
.mcp-hub { flex: 0 0 auto; border-top: 1px solid #dfe4d7; border-bottom: 1px solid #dfe4d7; margin-top: 10px; font-size: 12px; }
.mcp-hub > summary { display: flex; align-items: center; gap: 8px; padding: 14px 5px; cursor: pointer; list-style: none; font-weight: 650; color: #355b45; }
.mcp-hub > summary::after { content: '+'; margin-left: auto; }
.mcp-hub[open] > summary::after { content: '−'; }
.hub-symbol { font-size: 19px; }
.hub-count { font-size: 10px; font-weight: 400; color: #7a8774; }
.hub-body { max-height: min(45dvh, max(130px, calc(100dvh - 420px))); overflow-y: auto; padding: 0 5px 14px; overflow-wrap: anywhere; }
.hub-help, .hub-empty { color: #7d8877; font-size: 11px; line-height: 1.6; margin: 4px 0 10px; }
.hub-auth { font-size: 11px; margin-bottom: 12px; }
summary { cursor: pointer; }
summary:focus-visible { outline: 2px solid #589d7c; outline-offset: 2px; }
.hub-toolbar, .hub-tabs, .hub-server-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.hub-toolbar { justify-content: space-between; margin: 10px 0; }
button { padding: 6px 9px; border-radius: 6px; background: #e2e9dc; font-size: 11px; }
button:hover { background: #d5e1ce; }
button:disabled { opacity: .5; }
.hub-primary, .hub-tabs [aria-pressed="true"] { background: #29634f; color: white; }
.hub-import { padding: 10px; background: #f9faf6; border: 1px solid #dce3d6; border-radius: 8px; margin-bottom: 12px; }
form, label:not(.hub-write) { display: grid; gap: 6px; }
label:not(.hub-write) { margin: 10px 0; }
input:not([type="checkbox"]), select, textarea { width: 100%; min-width: 0; padding: 7px; border: 1px solid #d7dfd0; border-radius: 5px; background: white; font: inherit; color: #354332; }
textarea { resize: vertical; }
.hub-file input { font-size: 10px; }
.hub-error { color: #a34738; font-size: 11px; line-height: 1.5; }
.hub-notice { color: #29634f; font-size: 11px; line-height: 1.5; }
.hub-server { border: 1px solid #dce3d6; border-radius: 9px; padding: 10px; margin-top: 9px; background: #f7f9f3; }
.hub-server-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.hub-server-heading strong { overflow-wrap: anywhere; min-width: 0; }
.hub-switch { width: 30px; height: 18px; border-radius: 12px; background: #b8c2b0; padding: 2px; flex-shrink: 0; }
.hub-switch span { display: block; width: 14px; height: 14px; background: white; border-radius: 50%; transition: transform .15s; }
.hub-switch[aria-checked="true"] { background: #29634f; }
.hub-switch[aria-checked="true"] span { transform: translateX(12px); }
.hub-meta { color: #86907e; font-size: 10px; margin: 7px 0; }
.hub-status[data-status="connected"] { color: #29634f; }
.hub-status[data-status="error"] { color: #a34738; }
.hub-write { display: flex; gap: 3px; align-items: center; font-size: 10px; }
.hub-tools { margin-top: 10px; font-size: 10px; }
.hub-tools ul { list-style: none; padding: 0; margin-bottom: 0; }
.hub-tools li { border-top: 1px solid #e3e8de; padding: 8px 0; }
.hub-tools li span { display: block; color: #829077; margin-top: 3px; }
.hub-tools li p { color: #7d8877; margin-bottom: 0; line-height: 1.5; }
</style>
