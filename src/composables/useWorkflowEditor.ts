import { computed, ref, toRaw } from 'vue'
import { connectionIssue, createNode, graphStructureIssues, type NodeType, type WorkflowEdge, type WorkflowGraph, type WorkflowNode } from '../api/workflows'

export function useWorkflowEditor() {
  const graph = ref<WorkflowGraph>({ schemaVersion: 1, nodes: [], edges: [] })
  const selectedId = ref(''), selectedEdgeId = ref(''), notice = ref('')
  const previous = ref<string[]>([]), next = ref<string[]>([])
  const saved = ref('')
  const serialized = () => JSON.stringify(graph.value)
  const dirty = computed(() => serialized() !== saved.value)
  const selected = computed(() => graph.value.nodes.find(n => n.id === selectedId.value))
  const selectedEdge = computed(() => graph.value.edges.find(e => e.id === selectedEdgeId.value))
  function markSaved() { saved.value = serialized() }
  function load(value: WorkflowGraph) {
    const issues = graphStructureIssues(value)
    if (issues.length) throw new Error(issues[0]!.message)
    graph.value = structuredClone(toRaw(value)); previous.value = []; next.value = []
    selectedId.value = ''; selectedEdgeId.value = ''; notice.value = ''; markSaved()
  }
  function checkpoint() {
    const value = serialized()
    if (previous.value.at(-1) !== value) previous.value = [...previous.value.slice(-49), value]
    next.value = []
  }
  function undo() { const value = previous.value.pop(); if (!value) return; next.value.push(serialized()); graph.value = JSON.parse(value); clearSelection() }
  function redo() { const value = next.value.pop(); if (!value) return; previous.value.push(serialized()); graph.value = JSON.parse(value); clearSelection() }
  function clearSelection() { selectedId.value = ''; selectedEdgeId.value = '' }
  function select(id: string) { selectedId.value = id; selectedEdgeId.value = '' }
  function add(type: NodeType, position: { x: number; y: number }, from?: { source: string; sourceHandle: string }): WorkflowNode | undefined {
    if (graph.value.nodes.length >= 150) { notice.value = '最多允许 150 个节点。'; return }
    if (type === 'start' && graph.value.nodes.some(n => n.type === 'start')) { notice.value = '画布已有开始节点。'; return }
    const node = createNode(type, crypto.randomUUID(), position)
    const edge = from ? { id: crypto.randomUUID(), ...from, target: node.id, targetHandle: 'in', label: '' } : undefined
    if (edge) {
      const issue = connectionIssue({ ...graph.value, nodes: [...graph.value.nodes, node] }, edge)
      if (issue) { notice.value = issue; return }
    }
    checkpoint(); graph.value.nodes.push(node); if (edge) graph.value.edges.push(edge)
    notice.value = ''; select(node.id); return node
  }
  function connect(edge: Omit<WorkflowEdge, 'id' | 'label'>) {
    const issue = connectionIssue(graph.value, edge)
    if (issue) { notice.value = issue; return false }
    checkpoint(); graph.value.edges.push({ ...edge, id: crypto.randomUUID(), label: '' }); notice.value = ''; return true
  }
  function updateData(id: string, data: WorkflowNode['data']) {
    const node = graph.value.nodes.find(n => n.id === id); if (!node) return
    checkpoint(); node.data = JSON.parse(JSON.stringify(data))
  }
  function move(id: string, position: { x: number; y: number }) { const node = graph.value.nodes.find(n => n.id === id); if (node) node.position = { ...position } }
  function remove() {
    const node = selected.value
    if (node?.type === 'start') { notice.value = '开始节点保留；可编辑其属性和位置。'; return }
    if (!node && !selectedEdgeId.value) return
    checkpoint()
    if (node) { graph.value.nodes = graph.value.nodes.filter(n => n.id !== node.id); graph.value.edges = graph.value.edges.filter(e => e.source !== node.id && e.target !== node.id) }
    else graph.value.edges = graph.value.edges.filter(e => e.id !== selectedEdgeId.value)
    clearSelection()
  }
  function duplicate() {
    const node = selected.value; if (!node || node.type === 'start') return
    if (graph.value.nodes.length >= 150) { notice.value = '最多允许 150 个节点。'; return }
    checkpoint(); const copy = JSON.parse(JSON.stringify(node)) as WorkflowNode
    copy.id = crypto.randomUUID(); copy.position = { x: node.position.x + 40, y: node.position.y + 160 }; copy.data.label = `${node.data.label} 副本`.slice(0, 100)
    graph.value.nodes.push(copy); select(copy.id)
  }
  return { graph, selectedId, selectedEdgeId, selected, selectedEdge, notice, previous, next, dirty, load, checkpoint, markSaved, undo, redo, clearSelection, select, add, connect, updateData, move, remove, duplicate }
}
