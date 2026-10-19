<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { VueFlow, useVueFlow, ConnectionMode, MarkerType, type Connection, type NodeDragEvent, type NodeMouseEvent, type EdgeMouseEvent, type FlowEvents } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import './workflow.css'
import WorkflowNode from './WorkflowNode.vue'
import NodeInspector from './NodeInspector.vue'
import { authKey } from '../../composables/useAuth'
import { useWorkflowEditor } from '../../composables/useWorkflowEditor'
import { workflowsApi, nodeDefinitions, definitionFor, graphIssues, graphStructureIssues, connectionIssue, isLoopReturn, loopBodyIds, observeNode, observeIterations, nodeStateLabels, createNode,
  type WorkflowDetail, type WorkflowListItem, type WorkflowGraph, type NodeType, type WorkflowVersion, type VersionSummary, type GraphIssue } from '../../api/workflows'
import { runsApi, type RunTrace, type RunSummary, type RunEvent } from '../../api/runs'

const props = defineProps<{ subject?: string; sessionId?: string; initialRunId?: string }>()
const emit = defineEmits<{ close: [] }>()
const auth = inject(authKey, undefined)
const isAdmin = computed(() => auth?.user.value?.role === 'admin')
const editor = useWorkflowEditor()
const { graph, selectedId, selectedEdgeId, selected, selectedEdge, notice, previous, next } = editor
const flow = useVueFlow({ id: `workbench-${crypto.randomUUID()}` })
const catalog = ref<WorkflowListItem[]>([]), current = ref<WorkflowDetail>(), history = ref<WorkflowVersion>(), versions = ref<VersionSummary[]>([])
const mode = ref<'definition' | 'run'>('definition'), search = ref(''), busy = ref(false), error = ref(''), message = ref('')
const baseline = ref(''), issues = ref<GraphIssue[]>([]), checkOpen = ref(false), runtimeOpen = ref(false), versionsOpen = ref(false)
const closeRequested = ref(false), importFile = ref<HTMLInputElement>(), canvas = ref<HTMLElement>()
const mobilePanel = ref<'library' | 'details' | null>(null)
const dialog = ref<HTMLElement>()
const drafts = new Map<string, { record: WorkflowDetail; graph: WorkflowGraph }>()
const session = ref(props.sessionId ?? ''), runs = ref<RunSummary[]>([]), trace = ref<RunTrace>(), runBusy = ref(false), cursor = ref<string>(), runError = ref('')
const runFilter = ref(''), followRun = ref(true)
const iterationIndex = ref(0), templateRequested = ref(false)
let generation = 0, runGeneration = 0, lifetime = new AbortController(), runLifetime = new AbortController(), timer: ReturnType<typeof setTimeout> | undefined
let disposed = false
const meta = () => JSON.stringify(current.value ? [current.value.title, current.value.description, current.value.subject] : [])
const changed = computed(() => !!current.value && (editor.dirty.value || baseline.value !== meta()))
const readOnly = computed(() => !current.value || mode.value === 'run' || !!history.value || busy.value)
const emptyGraph: WorkflowGraph = { schemaVersion: 1, nodes: [], edges: [] }
const visibleGraph = computed(() => mode.value === 'run' ? trace.value?.workflow?.graph ?? emptyGraph : history.value?.graph ?? graph.value)
const selectedNode = computed(() => visibleGraph.value.nodes.find(n => n.id === selectedId.value))
const visibleEdge = computed(() => visibleGraph.value.edges.find(e => e.id === selectedEdgeId.value))
const observations = computed(() => Object.fromEntries(visibleGraph.value.nodes.map(n => [n.id, trace.value ? observeNode(n, trace.value) : undefined])))
const loops = computed(() => visibleGraph.value.nodes.filter(n => n.type === 'loop'))
const loopIterationCounts = computed(() => Object.fromEntries(loops.value.map(n => [n.id, trace.value ? observeIterations(n, trace.value).length : 0])))
const iterations = computed(() => selectedNode.value && trace.value ? observeIterations(selectedNode.value, trace.value) : [])
const selectedBodyNodes = computed(() => selectedNode.value?.type === 'loop' ? visibleGraph.value.nodes.filter(n => loopBodyIds(visibleGraph.value, selectedNode.value!.id).has(n.id)) : [])
watch([selectedId, () => trace.value?.id], () => { iterationIndex.value = 0 })
const canvasNodes = computed(() => visibleGraph.value.nodes.map(n => ({ ...n, type: 'workflow', position: { ...n.position }, data: { ...n.data, nodeType: n.type }, selected: selectedId.value === n.id, draggable: !readOnly.value, connectable: !readOnly.value, deletable: false })))
const canvasEdges = computed(() => visibleGraph.value.edges.map(e => {
  const returning = isLoopReturn(visibleGraph.value, e)
  return { ...e, label: e.label || (returning ? e.targetHandle === 'continue' ? '↻ 下一轮' : '退出循环' : ''), type: 'smoothstep', selected: selectedEdgeId.value === e.id, markerEnd: MarkerType.ArrowClosed,
    animated: mode.value === 'run' && !returning && observations.value[e.source]?.state === 'running', style: { stroke: returning ? '#b77c42' : '#b6c0ba', strokeDasharray: returning ? '7 4' : undefined, strokeWidth: selectedEdgeId.value === e.id ? 2.4 : returning ? 2 : 1.5 } }
}))
// Vue Flow must restore nodes before resolving their edges. One elements update
// avoids independent node/edge watchers racing while a graph is replaced.
const canvasElements = computed(() => [...canvasNodes.value, ...canvasEdges.value])
const palette = computed(() => nodeDefinitions.filter(n => `${n.label} ${n.type} ${n.description}`.toLowerCase().includes(search.value.toLowerCase())))
const shownEvents = computed(() => {
  const events = selectedNode.value?.type === 'loop' && iterations.value.length
    ? (iterationIndex.value ? iterations.value[iterationIndex.value - 1]?.events ?? [] : [...new Map(iterations.value.flatMap(i => i.events).map(e => [e.sequence, e])).values()])
    : selectedNode.value && trace.value ? observeNode(selectedNode.value, trace.value).events : trace.value?.events ?? []
  return events.filter(e => `${e.name} ${JSON.stringify(e.fields)}`.toLowerCase().includes(runFilter.value.toLowerCase()))
})
const subjectLabels = { math: '数学', chinese: '语文', english: '英语', general: '通用' }
const runStatus: Record<string, string> = { pending: '进行中', success: '已完成', failure: '失败', cancelled: '已取消', timed_out: '超时', interrupted: '中断' }
const fail = (failure: unknown) => failure instanceof Error ? failure.message : '操作失败，请重试。'
const duration = (value?: number) => value === undefined ? '—' : value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(2)} s`
const eventTitle = (event: RunEvent) => event.name === 'agent.subagent.event' ? `${event.fields.agent} › ${event.fields.event}` : event.name
function eventSummary(event: RunEvent) {
  const f = event.fields
  return [f.model, f.tool, typeof f.step === 'number' ? `第 ${f.step + 1} 轮` : undefined,
    f.action === 'tools' ? `请求 ${f.toolCalls} 个工具` : f.action === 'answer' ? '答案就绪，退出求解循环' : undefined,
    f.verdict ? `判定 ${f.verdict}` : undefined, f.canRevise === true ? '允许修订后再次核验' : undefined,
    f.final === true ? '禁用工具的最终轮' : undefined].filter(v => v !== undefined && v !== '').join(' · ')
}
function stash() { if (current.value && changed.value) drafts.set(current.value.id, JSON.parse(JSON.stringify({ record: current.value, graph: graph.value }))) }
async function fit() { await nextTick(); await flow.fitView({ padding: 0.16, maxZoom: 0.9, duration: 250 }) }
async function readableView() {
  await nextTick()
  const first = visibleGraph.value.nodes.find(n => n.type === 'start') ?? visibleGraph.value.nodes[0]
  if (first && canvas.value) await flow.setViewport({ x: 35 - first.position.x * 0.8, y: Math.max(90, canvas.value.clientHeight / 2 - 60) - first.position.y * 0.8, zoom: 0.8 })
}
async function openWorkflow(id: string) {
  if (busy.value || !isAdmin.value) return
  stash(); const request = ++generation; lifetime.abort(); lifetime = new AbortController()
  busy.value = true; error.value = ''; message.value = ''; history.value = undefined; versionsOpen.value = false; mode.value = 'definition'; issues.value = []; templateRequested.value = false
  try {
    const value = await workflowsApi.get(id, lifetime.signal)
    if (disposed || request !== generation) return
    current.value = value; editor.load(value.graph); baseline.value = meta()
    const draft = drafts.get(id)
    if (draft) { current.value = { ...draft.record, runtime: value.runtime }; graph.value = draft.graph; message.value = '已恢复本次打开期间的未保存草稿。' }
    await readableView()
  } catch (failure) { if (request === generation && !disposed) error.value = fail(failure) }
  finally { if (request === generation) busy.value = false }
}
async function reloadCatalog() { catalog.value = await workflowsApi.list(lifetime.signal) }
async function initialize() {
  error.value = ''
  try { await reloadCatalog(); await openWorkflow(catalog.value.find(w => w.id === `subject-${props.subject}`)?.id ?? catalog.value[0]?.id ?? 'subject-math') }
  catch (failure) { if (!disposed) error.value = fail(failure) }
}
function retryLoad() { if (current.value) void openWorkflow(current.value.id); else void initialize() }
function toggleRuntime() { runtimeOpen.value = !runtimeOpen.value; if (runtimeOpen.value && window.innerWidth <= 820) mobilePanel.value = 'details' }
async function save() {
  if (!current.value || readOnly.value || !isAdmin.value) return false
  const structural = graphStructureIssues(graph.value)
  if (structural.length) { issues.value = structural; checkOpen.value = true; return false }
  busy.value = true; error.value = ''; message.value = ''
  try {
    const runtime = current.value.runtime
    current.value = { ...await workflowsApi.save({ ...current.value, graph: graph.value }), runtime }
    editor.markSaved(); baseline.value = meta(); drafts.delete(current.value.id); await reloadCatalog(); message.value = '草稿已保存。'; return true
  } catch (failure) { error.value = fail(failure); return false }
  finally { busy.value = false }
}
function validate() { issues.value = graphIssues(graph.value); checkOpen.value = true; message.value = issues.value.length ? '' : '校验通过，可以发布观测映射。' }
async function publish() {
  validate(); if (issues.value.length || !current.value || readOnly.value) return
  if (changed.value && !await save()) return
  busy.value = true; error.value = ''
  try { const runtime = current.value.runtime; current.value = { ...await workflowsApi.publish(current.value.id, current.value.revision), runtime }; await reloadCatalog(); message.value = current.value.id.startsWith('subject-') ? '映射版本已发布，将用于此学科后续运行的观测快照。' : '映射版本已发布，可用于历史查看与定义复用。' }
  catch (failure) { error.value = fail(failure) }
  finally { busy.value = false }
}
async function createWorkflow() {
  if (busy.value) return
  const start = createNode('start', crypto.randomUUID(), { x: 80, y: 120 }), end = createNode('end', crypto.randomUUID(), { x: 420, y: 120 })
  stash(); busy.value = true; error.value = ''
  try {
    const value = await workflowsApi.create({ id: '', title: '新的通用工作流', description: '描述现有阶段并绑定真实事件。', subject: 'general', revision: 1,
      graph: { schemaVersion: 1, nodes: [start, end], edges: [{ id: crypto.randomUUID(), source: start.id, target: end.id, sourceHandle: 'out', targetHandle: 'in', label: '' }] } })
    await reloadCatalog(); busy.value = false; await openWorkflow(value.id)
  } catch (failure) { error.value = fail(failure) }
  finally { busy.value = false }
}
async function loadTemplate() {
  if (!current.value || readOnly.value) return
  if (changed.value && !templateRequested.value) { templateRequested.value = true; return }
  templateRequested.value = false; busy.value = true; error.value = ''
  try {
    const template = await workflowsApi.template(current.value.subject, lifetime.signal)
    editor.checkpoint(); graph.value = template.graph; editor.clearSelection()
    message.value = '最新内置定义已载入草稿，保存并发布后用于后续运行；历史版本保持原样。'; await readableView()
  } catch (failure) { error.value = fail(failure) }
  finally { busy.value = false }
}
async function loadVersions() {
  if (!current.value || busy.value) return
  versionsOpen.value = !versionsOpen.value
  if (!versionsOpen.value) return
  try { versions.value = await workflowsApi.versions(current.value.id, lifetime.signal) } catch (failure) { error.value = fail(failure) }
}
async function showVersion(revision: number) {
  if (!current.value || busy.value) return
  busy.value = true; error.value = ''
  try { history.value = await workflowsApi.version(current.value.id, revision, lifetime.signal); editor.clearSelection(); versionsOpen.value = false; await fit() }
  catch (failure) { error.value = fail(failure) }
  finally { busy.value = false }
}
function backToDraft() { history.value = undefined; editor.clearSelection(); void fit() }
function selectNode(event: NodeMouseEvent) { editor.select(event.node.id); if (window.innerWidth <= 820) mobilePanel.value = 'details' }
function selectEdge(event: EdgeMouseEvent) { selectedEdgeId.value = event.edge.id; selectedId.value = ''; if (window.innerWidth <= 820) mobilePanel.value = 'details' }
function addNode(type: NodeType, event?: DragEvent) {
  if (readOnly.value) return
  const bounds = canvas.value?.getBoundingClientRect()
  const position = flow.screenToFlowCoordinate({ x: event?.clientX ?? (bounds ? bounds.x + bounds.width / 2 : 500), y: event?.clientY ?? (bounds ? bounds.y + bounds.height / 2 : 250) })
  editor.add(type, position)
}
function dragStart(event: DragEvent, type: string) { event.dataTransfer?.setData('application/songjian-workflow-node', type); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy' }
function drop(event: DragEvent) { const type = event.dataTransfer?.getData('application/songjian-workflow-node'); if (type && definitionFor(type)) addNode(type as NodeType, event) }
function dragOver(event: DragEvent) { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy' }
function nodeMove(event: NodeDragEvent) { if (!readOnly.value) for (const node of event.nodes) editor.move(node.id, node.position) }
function onConnect(connection: Connection) {
  if (readOnly.value) return
  connectionCompleted = true
  editor.connect({ source: connection.source, target: connection.target, sourceHandle: connection.sourceHandle ?? '', targetHandle: connection.targetHandle ?? '' })
}
function validConnection(connection: Connection) {
  // Vue Flow also validates persisted edges on hydration, including read-only
  // history. Only newly drawn connections should be checked for duplicates.
  if ('id' in connection && visibleGraph.value.edges.some(edge => edge.id === connection.id)) return true
  return !readOnly.value && !connectionIssue(graph.value, { ...connection, sourceHandle: connection.sourceHandle ?? '', targetHandle: connection.targetHandle ?? '' })
}
let connectionCompleted = false, connectionFrom: { source: string; sourceHandle: string; x: number; y: number } | undefined
const nextMenu = ref<{ x: number; y: number; position: { x: number; y: number }; source: string; sourceHandle: string }>()
function connectStart(params: FlowEvents['connectStart']) {
  connectionCompleted = false; nextMenu.value = undefined
  connectionFrom = params.handleType === 'source' && params.nodeId && params.handleId && params.event && 'clientX' in params.event
    ? { source: params.nodeId, sourceHandle: params.handleId, x: params.event.clientX, y: params.event.clientY } : undefined
}
function connectEnd(event?: MouseEvent) {
  const from = connectionFrom; connectionFrom = undefined
  if (!from || connectionCompleted || readOnly.value || !event || Math.hypot(event.clientX - from.x, event.clientY - from.y) < 8 || !(event.target instanceof Element) || !event.target.closest('.vue-flow__pane')) return
  const bounds = canvas.value!.getBoundingClientRect()
  nextMenu.value = { x: Math.max(8, Math.min(event.clientX - bounds.x, bounds.width - 210)), y: Math.max(8, Math.min(event.clientY - bounds.y, bounds.height - 320)), position: flow.screenToFlowCoordinate({ x: event.clientX, y: event.clientY }), source: from.source, sourceHandle: from.sourceHandle }
}
function addNext(type: NodeType) { const menu = nextMenu.value; if (!menu) return; editor.add(type, menu.position, menu); nextMenu.value = undefined }
function changeEdge(event: Event) { if (!selectedEdge.value || readOnly.value) return; editor.checkpoint(); selectedEdge.value.label = (event.target as HTMLInputElement).value }
function exportGraph() {
  const source = mode.value === 'run' ? trace.value?.workflow : history.value ?? (current.value ? { ...current.value, graph: graph.value } : undefined)
  if (!source) return
  const { id, title, description, subject, revision, graph: value } = source
  const url = URL.createObjectURL(new Blob([JSON.stringify({ id, title, description, subject, revision, graph: value }, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = `workflow-${id}-r${revision}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 0)
}
async function importGraph(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]; input.value = ''
  if (!file || !current.value || readOnly.value) return
  try {
    if (file.size > 700000) throw new Error('导入文件超过 700 KB。')
    const value = JSON.parse(await file.text())
    const errors = graphStructureIssues(value?.graph)
    if (errors.length) throw new Error(errors[0]!.message)
    editor.checkpoint(); graph.value = value.graph; editor.clearSelection(); message.value = '图数据已导入当前草稿，保存后生效。'; await fit()
  } catch (failure) { error.value = fail(failure) }
}
function locate(id: string) {
  editor.select(id); const node = visibleGraph.value.nodes.find(n => n.id === id)
  if (node) void flow.setCenter(node.position.x + 115, node.position.y + 60, { zoom: 0.9, duration: 250 })
}
async function focusLoop(id: string) {
  editor.select(id)
  if (window.innerWidth <= 820) mobilePanel.value = 'details'
  await nextTick(); await flow.fitView({ nodes: [id, ...loopBodyIds(visibleGraph.value, id)], padding: 0.15, maxZoom: 0.9, duration: 250 })
}
function locateEvent(event: RunEvent) { const node = visibleGraph.value.nodes.find(n => trace.value && observeNode(n, trace.value).events.some(e => e.sequence === event.sequence)); if (node) locate(node.id) }
function stopTimer() { clearTimeout(timer); timer = undefined }
let resizeFrame = 0
function resized() { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(() => { if (mode.value === 'definition') void readableView(); else void fit() }) }
async function loadRuns(older = false) {
  if (!session.value.trim() || runBusy.value || !isAdmin.value) return
  runBusy.value = true; runError.value = ''; const request = runGeneration
  try {
    const result = await runsApi.list(session.value.trim(), older ? cursor.value : undefined, runLifetime.signal)
    if (request !== runGeneration || disposed) return
    runs.value = older ? [...runs.value, ...result.runs.filter(r => !runs.value.some(old => old.id === r.id))] : result.runs; cursor.value = result.nextCursor
    if (!trace.value && result.runs.length) await loadTrace(props.initialRunId && result.runs.some(r => r.id === props.initialRunId) ? props.initialRunId : result.runs[0]!.id)
  } catch (failure) { if (request === runGeneration && !disposed) runError.value = fail(failure) }
  finally { if (request === runGeneration) runBusy.value = false }
}
async function loadTrace(id: string, refresh = false) {
  const request = ++traceGeneration, runRequest = runGeneration; runError.value = ''; stopTimer()
  try {
    const result = await runsApi.get(session.value.trim(), id, runLifetime.signal)
    if (disposed || request !== traceGeneration || runRequest !== runGeneration) return
    trace.value = result
    runs.value = runs.value.map(run => run.id === result.id ? { ...run, status: result.status, durationMs: result.durationMs, eventCount: result.events.length, droppedEvents: result.droppedEvents } : run)
    if (!refresh) { editor.clearSelection(); await fit() }
    scheduleRun()
  } catch (failure) { if (request === traceGeneration && runRequest === runGeneration && !disposed) runError.value = fail(failure) }
}
let traceGeneration = 0
function scheduleRun() { stopTimer(); if (mode.value === 'run' && followRun.value && trace.value?.status === 'pending' && !disposed) timer = setTimeout(() => { if (trace.value) void loadTrace(trace.value.id, true) }, 2000) }
function resetRuns() { runGeneration++; traceGeneration++; runLifetime.abort(); runLifetime = new AbortController(); stopTimer(); runs.value = []; trace.value = undefined; cursor.value = undefined; runBusy.value = false; runError.value = '' }
function queryRuns() { resetRuns(); void loadRuns() }
watch(mode, value => { nextMenu.value = undefined; versionsOpen.value = false; editor.clearSelection(); if (value === 'run') { history.value = undefined; if (!runs.value.length) void loadRuns(); scheduleRun() } else stopTimer(); void fit() })
watch(followRun, scheduleRun)
watch(() => props.sessionId, value => { session.value = value ?? ''; resetRuns(); if (mode.value === 'run') void loadRuns() })
function close() { if (busy.value) return; if (changed.value || drafts.size) closeRequested.value = true; else emit('close') }
async function saveAndClose() { if (await save()) { closeRequested.value = false; if (drafts.size) message.value = '其他流程仍有未保存草稿，请切回保存或选择放弃全部。'; else emit('close') } }
function unload(event: BeforeUnloadEvent) { if (changed.value || drafts.size) event.preventDefault() }
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { if (nextMenu.value) nextMenu.value = undefined; else if (mobilePanel.value) mobilePanel.value = null; else close(); return }
  if (event.key === 'Tab' && dialog.value) {
    const elements = [...dialog.value.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(e => e.getClientRects().length)
    if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements.at(-1)?.focus() }
    else if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0]?.focus() }
  }
  if (readOnly.value || (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable]'))) return
  const modifier = event.ctrlKey || event.metaKey
  if (modifier && event.key.toLowerCase() === 's') { event.preventDefault(); void save() }
  else if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) editor.redo(); else editor.undo() }
  else if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); editor.redo() }
  else if (modifier && event.key.toLowerCase() === 'd') { event.preventDefault(); editor.duplicate() }
  else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); editor.remove() }
}
onMounted(async () => {
  if (!isAdmin.value) return
  dialog.value?.focus()
  window.addEventListener('keydown', keydown); window.addEventListener('beforeunload', unload); window.addEventListener('resize', resized)
  await initialize(); if (props.initialRunId) mode.value = 'run'
})
onBeforeUnmount(() => { disposed = true; generation++; runGeneration++; traceGeneration++; lifetime.abort(); runLifetime.abort(); stopTimer(); cancelAnimationFrame(resizeFrame); drafts.clear(); window.removeEventListener('keydown', keydown); window.removeEventListener('beforeunload', unload); window.removeEventListener('resize', resized) })
</script>

<template>
  <section v-if="isAdmin" ref="dialog" tabindex="-1" class="wf-workbench" role="dialog" aria-modal="true" aria-label="管理员工作流工作台">
    <header class="wf-header">
      <div class="wf-brand"><span>⌘</span><div><strong>工作流工作台</strong><small>ADMIN WORKSPACE</small></div><i>仅管理员</i></div>
      <nav class="wf-tabs" aria-label="工作台模式"><button :class="{ active: mode === 'definition' }" @click="mode = 'definition'">流程定义</button><button :class="{ active: mode === 'run' }" @click="mode = 'run'">运行观测</button></nav>
      <button class="wf-close" aria-label="关闭工作流工作台" @click="close">×</button>
    </header>
    <div class="wf-toolbar">
      <select v-if="mode === 'definition'" aria-label="选择工作流" :value="current?.id" :disabled="busy" @change="openWorkflow(($event.target as HTMLSelectElement).value)"><option v-for="w in catalog" :key="w.id" :value="w.id">{{ w.title }}{{ drafts.has(w.id) ? ' *' : '' }}</option></select>
      <strong v-else>{{ trace?.workflow?.title ?? '运行记录' }}</strong>
      <span v-if="current && mode === 'definition'" class="wf-revision">{{ history ? `历史 r${history.revision}` : `草稿 r${current.revision}` }}<b v-if="changed"> · 未保存</b><span v-else> · 已保存</span></span>
      <span v-else-if="trace?.workflow" class="wf-revision">运行映射 r{{ trace.workflow.revision }} · 只读</span>
      <div class="wf-panel-switch"><button @click="mobilePanel = mobilePanel === 'library' ? null : 'library'">{{ mode === 'run' ? '运行列表' : '节点库' }}</button><button @click="mobilePanel = mobilePanel === 'details' ? null : 'details'">{{ mode === 'run' ? '日志' : '属性' }}</button></div>
      <div class="wf-toolbar-actions">
        <button :disabled="busy" @click="createWorkflow">＋ 新建通用流程</button><button :disabled="!current || busy" @click="exportGraph">导出</button>
        <template v-if="mode === 'definition' && !history"><button :disabled="busy" @click="importFile?.click()">导入</button><button :disabled="readOnly" @click="loadTemplate">最新内置定义</button><button :disabled="busy" @click="validate">校验</button><button :disabled="busy" @click="loadVersions">版本</button><button :disabled="!current || busy" @click="save">保存草稿</button><button class="wf-primary" :disabled="!current || busy" @click="publish">发布观测映射</button></template>
        <button v-if="history" class="wf-primary" @click="backToDraft">返回草稿</button>
      </div>
      <input ref="importFile" type="file" accept="application/json,.json" hidden @change="importGraph" />
    </div>
    <div class="wf-boundary"><span>◉</span> 画布描述现有 agent / harness。编辑与发布用于流程说明和日志映射；实际执行顺序、提示词和预算由后端管理。<button @click="toggleRuntime">{{ runtimeOpen ? '收起' : '查看' }}实际配置</button></div>
    <div v-if="error || runError || notice" class="wf-alert" role="alert">{{ error || runError || notice }}<button v-if="error && !changed" :disabled="busy" @click="retryLoad">重新载入</button></div>
    <div v-if="message" class="wf-message" role="status">{{ message }}</div>
    <div v-if="templateRequested" class="wf-confirm"><span>当前有未保存修改，载入内置定义会替换画布草稿。</span><button @click="loadTemplate">替换当前草稿</button><button @click="templateRequested = false">继续编辑</button></div>
    <div v-if="closeRequested" class="wf-confirm"><span>当前或其他流程有未保存草稿。</span><button :disabled="busy || mode !== 'definition' || !!history" @click="saveAndClose">保存当前并关闭</button><button @click="emit('close')">放弃全部并关闭</button><button @click="closeRequested = false">继续编辑</button></div>
    <div v-if="history" class="wf-history-banner">正在查看不可变发布版本 r{{ history.revision }} · {{ history.publishedBy }} · {{ new Date(history.publishedAt).toLocaleString('zh-CN') }}</div>
    <div v-if="versionsOpen" class="wf-version-list"><p>发布版本（最多显示最近 100 个）</p><button v-for="version in versions" :key="version.revision" @click="showVersion(version.revision)">r{{ version.revision }} · {{ version.title }} · {{ new Date(version.publishedAt).toLocaleString('zh-CN') }}</button><p v-if="!versions.length">还没有发布版本。</p></div>
    <div class="wf-body" :class="{ 'wf-show-library': mobilePanel === 'library', 'wf-show-details': mobilePanel === 'details' }">
      <aside class="wf-library">
        <button class="wf-mobile-close" @click="mobilePanel = null">收起面板 ×</button>
        <template v-if="mode === 'definition'">
          <div class="wf-library-heading"><h3>节点库</h3><span>{{ nodeDefinitions.length }} 种</span></div><input v-model="search" aria-label="搜索节点" placeholder="搜索节点类型…" />
          <p class="wf-help">拖入画布或点击添加</p>
          <button v-for="definition in palette" :key="definition.type" class="wf-palette-node" :draggable="!readOnly" :disabled="readOnly" @dragstart="dragStart($event, definition.type)" @click="addNode(definition.type as NodeType)"><span :style="{ color: definition.color }">{{ definition.icon }}</span><div><strong>{{ definition.label }}</strong><small>{{ definition.description }}</small></div><b>⠿</b></button>
          <div class="wf-library-footer"><strong>同一套节点，三科学科</strong><p>类型和属性由公共协议定义，学科差异保存在流程数据中。</p><small>Ctrl Z 撤销 · Ctrl D 复制<br />Delete 删除 · Ctrl S 保存</small></div>
        </template>
        <template v-else>
          <div class="wf-library-heading"><h3>运行记录</h3><span>{{ runs.length }}</span></div>
          <form class="wf-session-query" @submit.prevent="queryRuns"><label>会话 ID<input v-model="session" aria-label="查询运行的会话 ID" placeholder="选择对话后自动填入" /></label><button :disabled="runBusy || !session.trim()">查询记录</button></form>
          <label class="wf-follow"><input v-model="followRun" type="checkbox" /> 自动刷新进行中的运行</label>
          <p v-if="runBusy" class="wf-help">正在读取真实记录…</p><p v-else-if="!runs.length" class="wf-help">此会话暂无运行记录。</p>
          <button v-for="run in runs" :key="run.id" class="wf-run-item" :class="{ active: trace?.id === run.id }" @click="loadTrace(run.id)"><strong>{{ run.question }}</strong><span>{{ runStatus[run.status] }} · {{ duration(run.durationMs) }}</span><small>{{ new Date(run.startedAt).toLocaleString('zh-CN') }}</small></button>
          <button v-if="cursor" :disabled="runBusy" @click="loadRuns(true)">加载更早记录</button>
        </template>
      </aside>
      <main ref="canvas" class="wf-canvas" @drop.prevent="drop" @dragover="dragOver">
        <nav v-if="loops.length" class="wf-loop-navigation" aria-label="定位内部循环"><span>内部控制流</span><button v-for="loop in loops" :key="loop.id" @click="focusLoop(loop.id)">↻ {{ loop.data.label }}</button><button @click="fit">查看全图</button></nav>
        <VueFlow :id="flow.id" :model-value="canvasElements" :connection-mode="ConnectionMode.Strict" :is-valid-connection="validConnection" :nodes-draggable="!readOnly" :nodes-connectable="!readOnly" :edges-updatable="false" :delete-key-code="null" :min-zoom="0.15" :max-zoom="1.8" :snap-to-grid="true" :snap-grid="[20, 20]" :multi-selection-key-code="null" :selection-key-code="null" @connect="onConnect" @connect-start="connectStart" @connect-end="connectEnd" @node-click="selectNode" @edge-click="selectEdge" @node-drag-start="editor.checkpoint" @node-drag-stop="nodeMove" @pane-click="editor.clearSelection" @nodes-initialized="mode === 'run' ? fit() : undefined">
          <template #node-workflow="nodeProps"><WorkflowNode :type="nodeProps.data.nodeType" :data="nodeProps.data" :selected="nodeProps.selected" :connectable="!readOnly" :observation="mode === 'run' ? observations[nodeProps.id] : undefined" :iteration-count="mode === 'run' ? loopIterationCounts[nodeProps.id] : undefined" /></template>
          <Background pattern-color="#d2dad3" :gap="20" :size="1" /><Controls :show-interactive="false" position="bottom-left" /><MiniMap :pannable="true" :zoomable="true" position="bottom-right" />
        </VueFlow>
        <div class="wf-canvas-caption"><span>{{ mode === 'run' ? '真实运行回放' : history ? '历史版本 · 只读' : '通用流程画布' }}</span><small>{{ visibleGraph.nodes.length }} 个节点 · {{ visibleGraph.edges.length }} 条连线</small></div>
        <div v-if="mode === 'definition' && !history" class="wf-edit-tools"><button aria-label="撤销" :disabled="!previous.length || readOnly" @click="editor.undo">↶</button><button aria-label="重做" :disabled="!next.length || readOnly" @click="editor.redo">↷</button><button :disabled="!selected || selected.type === 'start' || readOnly" @click="editor.duplicate">复制节点</button><button :disabled="(!selected && !selectedEdge) || readOnly" @click="editor.remove">删除</button><button @click="fit">适应视图</button></div>
        <div v-if="nextMenu && !readOnly" class="wf-next-menu" :style="{ left: `${nextMenu.x}px`, top: `${nextMenu.y}px` }"><header>连接下一步<button aria-label="取消添加下一步" @click="nextMenu = undefined">×</button></header><button v-for="definition in nodeDefinitions.filter(n => n.inputs.length)" :key="definition.type" @click="addNext(definition.type as NodeType)">{{ definition.icon }} {{ definition.label }}</button></div>
        <div v-if="mode === 'run' && !trace?.workflow" class="wf-no-snapshot"><strong>{{ trace ? '此历史运行未保存画布快照' : '选择一次运行查看真实轨迹' }}</strong><p>{{ trace ? '可以查看右侧原始事件；不会用当前流程覆盖历史。' : '从当前对话或指定会话 ID 读取日志。' }}</p></div>
        <div v-if="mode === 'run' && trace?.workflow" class="wf-trace-caption">r{{ trace.workflow.revision }} · {{ trace.workflow.title }} · {{ runStatus[trace.status] }}<span v-if="trace.droppedEvents"> · {{ trace.droppedEvents }} 个事件超出上限，部分阶段可能未观测</span></div>
      </main>
      <aside class="wf-details">
        <button class="wf-mobile-close" @click="mobilePanel = null">收起面板 ×</button>
        <template v-if="mode === 'definition'">
          <div v-if="runtimeOpen" class="wf-runtime"><h3>实际运行配置 · 只读</h3><p>来自后端当前配置。历史图版本只保存定义。</p><dl><dt>主解题模型</dt><dd>{{ current?.runtime?.solverModel }}</dd><dt>独立复核模型</dt><dd>{{ current?.runtime?.reviewerModel }} · {{ current?.runtime?.reviewEnabled ? '已启用' : '未启用' }}</dd><dt>上下文 / 工具轮次</dt><dd>{{ current?.runtime?.maxInputTokens }} / {{ current?.runtime?.maxToolSteps }}</dd><dt>修订上限 / 超时</dt><dd>{{ current?.runtime?.maxRevisions }} / {{ current?.runtime?.timeoutMs }}ms</dd></dl><details><summary>查看实际系统提示词</summary><pre>{{ current?.runtime?.instructions }}</pre></details></div>
          <div v-if="checkOpen" class="wf-checklist"><header><h3>流程校验</h3><button aria-label="关闭校验" @click="checkOpen = false">×</button></header><p v-if="!issues.length">✓ 当前图校验通过</p><button v-for="(issue, index) in issues" :key="index" @click="issue.nodeId && locate(issue.nodeId)">{{ issue.message }}</button></div>
          <NodeInspector v-if="selectedNode" :node="selectedNode" :readonly="readOnly" :runtime="current?.runtime" :body-nodes="selectedBodyNodes" @locate="locate" @update="editor.updateData(selectedNode!.id, $event)" />
          <section v-else-if="visibleEdge" class="wf-inspector"><h3>连线定义</h3><p>{{ visibleEdge.source }} → {{ visibleEdge.target }}</p><p>{{ visibleEdge.sourceHandle }} → {{ visibleEdge.targetHandle }}</p><label>连线说明<input :value="visibleEdge.label" :disabled="readOnly" maxlength="200" @input="changeEdge" /></label><button :disabled="readOnly" @click="editor.remove">删除连线</button></section>
          <section v-else-if="current" class="wf-inspector"><div class="wf-section-heading"><h3>流程属性</h3></div><fieldset :disabled="readOnly"><label>名称<input :value="history?.title ?? current.title" maxlength="100" @input="current.title = ($event.target as HTMLInputElement).value" /></label><label>说明<textarea :value="history?.description ?? current.description" rows="4" maxlength="3000" @input="current.description = ($event.target as HTMLTextAreaElement).value" /></label><label>分类<select :value="history?.subject ?? current.subject" :disabled="current.id.startsWith('subject-')" @change="current.subject = ($event.target as HTMLSelectElement).value as typeof current.subject"><option v-for="(label, key) in subjectLabels" :key="key" :value="key">{{ label }}</option></select></label></fieldset><p class="wf-help">当前发布 r{{ current.publishedRevision ?? '—' }}。内置学科流程用于自动绑定后续运行；通用流程可复用、导出和维护定义。</p><div class="wf-empty-detail"><span>⌖</span><h3>选择一个节点</h3><p>编辑阶段属性、输入输出和事件绑定。拖动节点调整布局，从右侧端口拖出连线。</p></div></section>
        </template>
        <template v-else>
          <div class="wf-log-heading"><h3>{{ selectedNode ? selectedNode.data.label : '完整运行事件' }}</h3><button v-if="selectedNode" @click="editor.clearSelection">全部事件</button></div>
          <div v-if="selectedNode && trace" class="wf-observation">{{ nodeStateLabels[observeNode(selectedNode, trace).state] }} · {{ observeNode(selectedNode, trace).count }} 次 · {{ duration(observeNode(selectedNode, trace).durationMs) }}</div>
          <div v-if="selectedNode?.type === 'loop'" class="wf-iteration-panel"><label>实际轮次<select v-model="iterationIndex" aria-label="选择循环轮次"><option :value="0">全部 {{ iterations.length }} 轮</option><option v-for="iteration in iterations" :key="iteration.index" :value="iteration.index">{{ iteration.label }} · {{ duration(iteration.durationMs) }}{{ iteration.completed ? '' : ' · 进行中' }}</option></select></label><p>{{ selectedNode.data.config.variable }} {{ selectedNode.data.config.operator }} {{ selectedNode.data.config.value }}</p><p>提前退出：{{ selectedNode.data.config.exit }}</p><p>达到上限：{{ selectedNode.data.config.onLimit }}</p><p v-if="!iterations.length">此运行没有记录该循环轮次；不从其他模型调用推算。</p></div>
          <p class="wf-log-note">只有匹配到的真实事件会点亮节点。“未观测”可能是可选步骤或未记录，不代表已成功跳过。</p>
          <div v-if="runtimeOpen && trace?.workflow" class="wf-runtime"><h3>运行时配置快照</h3><pre>{{ JSON.stringify(trace.workflow.runtime, null, 2) }}</pre></div>
          <input v-model="runFilter" class="wf-event-search" aria-label="筛选运行事件" placeholder="搜索事件和记录字段…" />
          <ol class="wf-events"><li v-for="event in shownEvents" :key="event.sequence"><button class="wf-event-title" @click="locateEvent(event)"><span>{{ eventTitle(event) }}</span><time>+{{ duration(event.elapsedMs) }}</time></button><p v-if="eventSummary(event)" class="wf-event-summary">{{ eventSummary(event) }}</p><small>#{{ event.sequence }} · {{ new Date(event.timestamp).toLocaleTimeString('zh-CN') }}</small><details><summary>输入 / 输出与事件字段</summary><pre>{{ JSON.stringify(event.fields, null, 2) }}</pre></details></li></ol>
          <p v-if="trace && !shownEvents.length" class="wf-help">此节点或筛选条件没有匹配的真实事件。</p>
        </template>
      </aside>
    </div>
    <footer class="wf-statusbar"><span>● PostgreSQL 流程定义 · {{ busy ? '处理中…' : readOnly ? '只读浏览' : '可编辑草稿' }}</span><span>{{ mode === 'run' ? `运行 ${trace?.id ?? '—'} · 连线表示控制关系，执行以事件为准` : '循环：in 进入 · continue 下一轮 · break 提前退出 · body / done / limit' }}</span></footer>
  </section>
</template>
