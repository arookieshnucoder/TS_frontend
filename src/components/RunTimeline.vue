<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { runsApi, type RunSummary, type RunTrace, type RunEvent } from '../api/runs'
import { adminToken } from '../api/management'

const props = defineProps<{ sessionId: string; updatedAt: number; pending: boolean }>()
const open = ref(false)
const runs = ref<RunSummary[]>([])
const traces = ref<Record<string, RunTrace>>({})
const loadingDetails = ref<Record<string, boolean>>({})
const cursor = ref<string>()
const busy = ref(false)
const error = ref('')
const showAuth = ref(false)
const statusLabels = { pending: '进行中', success: '已完成', failure: '失败', cancelled: '已取消', timed_out: '已超时', interrupted: '运行中断' }
let generation = 0
let lifetime = new AbortController()
let timer: ReturnType<typeof setTimeout> | undefined
let disposed = false
const expanded = new Set<string>()
function stopTimer() { clearTimeout(timer); timer = undefined }
function schedule() {
  stopTimer()
  if (!disposed && open.value && (props.pending || runs.value.some(r => r.status === 'pending'))) {
    timer = setTimeout(() => { void load() }, 2000)
  }
}
function fail(e: unknown) { error.value = e instanceof Error ? e.message : '运行记录加载失败。' }
async function load(older = false) {
  if (busy.value || disposed) return
  const current = generation, sessionId = props.sessionId
  busy.value = true; error.value = ''
  try {
    const result = await runsApi.list(sessionId, older ? cursor.value : undefined, lifetime.signal)
    if (disposed || current !== generation) return
    runs.value = older ? [...runs.value, ...result.runs.filter(r => !runs.value.some(existing => existing.id === r.id))] : result.runs
    cursor.value = result.nextCursor
    await Promise.all([...expanded].map(id => loadTrace(id)))
  } catch (e) { if (!disposed && current === generation) fail(e) }
  finally { if (current === generation && !disposed) { busy.value = false; schedule() } }
}
async function loadTrace(id: string) {
  if (loadingDetails.value[id]) return
  const current = generation, sessionId = props.sessionId
  loadingDetails.value[id] = true
  try {
    const trace = await runsApi.get(sessionId, id, lifetime.signal)
    if (!disposed && current === generation) traces.value[id] = trace
  } catch (e) { if (!disposed && current === generation) fail(e) }
  finally { if (current === generation) loadingDetails.value[id] = false }
}
function toggle(event: Event) {
  open.value = (event.currentTarget as HTMLDetailsElement).open
  if (open.value) void load(); else stopTimer()
}
function toggleRun(run: RunSummary, event: Event) {
  if ((event.currentTarget as HTMLDetailsElement).open) { expanded.add(run.id); void loadTrace(run.id) }
  else expanded.delete(run.id)
}
watch(() => props.sessionId, () => {
  generation++; lifetime.abort(); lifetime = new AbortController(); stopTimer()
  runs.value = []; traces.value = {}; expanded.clear(); loadingDetails.value = {}; busy.value = false; cursor.value = undefined; error.value = ''
  if (open.value) void load()
})
watch(() => [props.updatedAt, props.pending], () => { if (open.value) void load() })
onBeforeUnmount(() => { disposed = true; generation++; lifetime.abort(); stopTimer() })
function duration(ms?: number) { return ms === undefined ? '—' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s` }
function time(value: string) { return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
function label(event: RunEvent): string {
  const f = event.fields
  const source = f.source as { serverId?: string; toolName?: string } | undefined
  const tool = source?.toolName ? `${source.serverId} / ${source.toolName}` : String(f.tool ?? '')
  if (event.name === 'agent.phase') return f.phase === 'observe' ? '汇总工具结果' : f.phase === 'answer' ? '生成最终回答' : `第 ${Number(f.step) + 1} 轮决策`
  if (event.name === 'agent.tool.started') return `调用工具 · ${tool}`
  if (event.name === 'agent.tool') return `工具${f.status === 'success' ? '完成' : f.status === 'cancelled' ? '已取消' : '失败'} · ${tool}`
  if (event.name === 'agent.model.started') return `模型请求 · ${f.model} · 第 ${f.attempt} 次`
  if (event.name === 'agent.model.completed') return `模型返回 · ${f.toolCalls} 个工具调用`
  if (event.name === 'agent.model.failed') return `模型请求失败 · ${f.code}`
  if (event.name === 'agent.retry') return `重试${f.operation === 'tool' ? '工具' : '模型'} · 等待 ${f.delayMs} ms`
  if (event.name === 'agent.fallback') return `切换备用模型 · ${f.to}`
  if (event.name.startsWith('mcp.discovery.')) return `MCP ${event.name.endsWith('completed') ? '已连接' : event.name.endsWith('failed') ? '不可用' : '连接中'} · ${f.serverId}`
  const labels: Record<string, string> = {
    'run.started': '收到问题', 'session.pending': '会话进入处理状态', 'tools.discovery.started': '准备可用工具', 'tools.discovery.completed': '工具准备完成',
    'agent.started': '启动 Agent', 'agent.context': '构建上下文', 'context.compressed': '压缩历史上下文',
    'agent.tools.selected': '按上下文预算选择 MCP 工具',
    'agent.completed': 'Agent 执行完成', 'agent.failed': 'Agent 执行失败', 'answer.ready': '回答就绪',
    'math.ingested': '规范化题目并保存向量', 'math.retrieval': '检索相似题与解法', 'math.native_verified': '程序数学核验完成',
    'title.started': '处理会话标题', 'title.completed': '标题处理完成', 'title.failed': '标题未更新，回答已保存', 'session.saved': '保存会话结果', 'session.failed': '记录请求失败',
    'run.success': '本次回答已完成', 'run.failure': '本次回答失败', 'run.cancelled': '用户已取消', 'run.timed_out': '总时间预算已耗尽', 'run.interrupted': '后端重启，运行中断',
  }
  return labels[event.name] ?? event.name
}
function exportTrace(run: RunTrace) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `agent-run-${run.id}.json`; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
</script>

<template>
  <details class="run-timeline" @toggle="toggle">
    <summary><span>执行流程</span><small>每个问题的运行记录</small></summary>
    <div class="timeline-body" :aria-busy="busy">
      <div class="timeline-toolbar">
        <span>记录工具、模型与恢复过程</span>
        <button type="button" :disabled="busy" @click="load()">刷新记录</button>
        <button type="button" :aria-expanded="showAuth" @click="showAuth = !showAuth">管理认证</button>
      </div>
      <label v-if="showAuth" class="timeline-auth">管理员令牌<input v-model="adminToken" type="password" autocomplete="off" aria-label="运行记录管理员令牌" placeholder="与 MCP Hub 共用，仅保存在内存中" /></label>
      <p v-if="error" class="timeline-error" role="alert">{{ error }}</p>
      <p v-if="busy" class="timeline-empty" role="status">正在加载运行记录…</p>
      <p v-if="!busy && !runs.length && !error" class="timeline-empty">还没有运行记录。新问题的处理过程会保存在这里。</p>
      <details v-for="run in runs" :key="`${sessionId}-${run.id}`" class="run-entry" @toggle="toggleRun(run, $event)">
        <summary>
          <span class="run-dot" :data-status="run.status" />
          <span class="run-question">{{ run.question }}</span>
          <span class="run-status">{{ statusLabels[run.status] }}</span>
          <span class="run-duration">{{ duration(run.durationMs) }}</span>
        </summary>
        <div class="run-detail">
          <p class="run-meta">{{ time(run.startedAt) }} · {{ run.eventCount }} 个事件<br />运行 {{ run.id }} · 请求 {{ run.requestId }}</p>
          <p v-if="loadingDetails[run.id]" class="timeline-empty" role="status">加载详情…</p>
          <template v-if="traces[run.id]">
            <button type="button" class="trace-export" @click="exportTrace(traces[run.id]!)">导出 JSON</button>
            <ol class="run-events">
              <li v-for="event in traces[run.id]!.events" :key="event.sequence">
                <div class="event-heading"><span>{{ label(event) }}</span><time>+{{ duration(event.elapsedMs) }}</time></div>
                <span v-if="typeof event.fields.durationMs === 'number'" class="event-duration">耗时 {{ duration(event.fields.durationMs) }}</span>
                <details v-if="Object.keys(event.fields).length" class="event-fields"><summary>查看记录</summary><pre>{{ JSON.stringify(event.fields, null, 2) }}</pre></details>
              </li>
            </ol>
            <p v-if="traces[run.id]!.droppedEvents" class="timeline-empty">超出记录上限，省略 {{ traces[run.id]!.droppedEvents }} 个事件；结束状态已保留。</p>
          </template>
        </div>
      </details>
      <button v-if="cursor" type="button" class="older-runs" :disabled="busy" @click="load(true)">加载更早记录</button>
    </div>
  </details>
</template>

<style scoped>
.run-timeline { flex-shrink: 0; width: min(760px, calc(100% - 48px)); margin: 16px auto 28px; border: 1px solid #e2e7dd; border-radius: 10px; background: #f9fbf6; color: #5d6b57; font-size: 12px; }
.run-timeline > summary { padding: 12px 16px; cursor: pointer; font-weight: 600; }
.run-timeline > summary small { font-size: 10px; font-weight: 400; color: #93a08b; margin-left: 12px; }
summary:focus-visible { outline: 2px solid #589d7c; }
.timeline-body { padding: 0 16px 14px; }
.timeline-toolbar { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; padding-bottom: 9px; font-size: 10px; }
.timeline-toolbar > span { margin-right: auto; color: #8c9a83; }
button { padding: 6px 9px; border-radius: 5px; background: #e8eee2; font-size: 10px; }
button:hover { background: #dce8d4; }
button:disabled { opacity: .5; }
.timeline-auth { display: grid; gap: 6px; margin: 8px 0; font-size: 11px; }
.timeline-auth input { border: 1px solid #d7dfd0; border-radius: 5px; background: white; padding: 8px; font: inherit; min-width: 0; width: 100%; }
.timeline-error { color: #a34738; line-height: 1.5; }
.timeline-empty { color: #8b9882; font-size: 11px; line-height: 1.6; }
.run-entry { border-top: 1px solid #e3e9de; }
.run-entry > summary { display: flex; list-style: none; align-items: center; gap: 8px; padding: 12px 0; cursor: pointer; }
.run-question { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.run-status, .run-duration { font-size: 10px; color: #8b9981; white-space: nowrap; }
.run-dot { width: 6px; height: 6px; background: #93a58b; border-radius: 50%; flex-shrink: 0; }
.run-dot[data-status="success"] { background: #3a8864; }
.run-dot[data-status="failure"], .run-dot[data-status="timed_out"] { background: #b36f55; }
.run-dot[data-status="pending"] { background: #bdab48; }
.run-detail { padding: 0 6px 10px 14px; }
.run-meta { color: #93a08b; font-size: 10px; overflow-wrap: anywhere; line-height: 1.6; margin: 0 0 10px; }
.run-events { list-style: none; padding: 0 0 0 14px; margin: 15px 0 0; border-left: 1px solid #d7e0d0; }
.run-events li { position: relative; padding: 0 0 15px; }
.run-events li::before { content: ''; position: absolute; width: 5px; height: 5px; left: -17px; top: 5px; background: #95b18b; border-radius: 50%; }
.event-heading { display: flex; align-items: start; justify-content: space-between; gap: 10px; font-size: 11px; overflow-wrap: anywhere; }
.event-heading time { color: #98a48f; font-size: 10px; white-space: nowrap; }
.event-duration { font-size: 10px; color: #8f9c85; }
.event-fields { margin-top: 5px; font-size: 10px; color: #8b9a80; }
.event-fields summary { cursor: pointer; }
.event-fields pre { padding: 10px; border: 1px solid #e0e7da; border-radius: 6px; background: #fff; color: #5c6c51; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 10px; max-height: 240px; overflow-y: auto; }
.older-runs { margin-top: 10px; }
@media (max-width: 760px) { .run-timeline { width: calc(100% - 24px); } .timeline-body { padding: 0 10px 10px; } .run-duration { display: none; } }
</style>
