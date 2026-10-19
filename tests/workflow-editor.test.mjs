import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestServer } from './helpers/vite.mjs'

test('workflow editor shares canonical validation and preserves editing invariants across undo, clone and deletion', async () => {
  const vite = await createTestServer()
  try {
    const { useWorkflowEditor } = await vite.ssrLoadModule('/src/composables/useWorkflowEditor.ts')
    const { workflowTemplate } = await vite.ssrLoadModule('../backend/src/modules/workflows/templates.ts')
    const editor = useWorkflowEditor(), original = workflowTemplate('math').graph
    editor.load(original); assert.equal(editor.dirty.value,false)
    editor.select('agent'); editor.duplicate()
    const copy=editor.selected.value;assert.ok(copy);assert.notEqual(copy.id,'agent')
    editor.updateData(copy.id,{...copy.data,config:{...copy.data.config,system:'changed'}})
    assert.notEqual(editor.graph.value.nodes.find(n=>n.id==='agent').data.config.system,'changed')
    assert.equal(editor.dirty.value,true)
    editor.undo();assert.notEqual(editor.graph.value.nodes.find(n=>n.id===copy.id).data.config.system,'changed')
    editor.undo();assert.equal(editor.graph.value.nodes.some(n=>n.id===copy.id),false)
    editor.redo();editor.select(copy.id);editor.remove()
    assert.equal(editor.graph.value.nodes.some(n=>n.id===copy.id),false)
    editor.select('tool');editor.remove()
    assert.equal(editor.graph.value.edges.some(e=>e.source==='tool'||e.target==='tool'),false)
    editor.select('start');editor.remove();assert.ok(editor.graph.value.nodes.some(n=>n.id==='start'))
    assert.equal(editor.connect({source:'protocol',target:'agent',sourceHandle:'out',targetHandle:'in'}),false)
    editor.load(original)
    const node=editor.add('tool',{x:300,y:400},{source:'condition',sourceHandle:'yes'})
    assert.ok(node);assert.ok(editor.graph.value.edges.some(e=>e.target===node.id))
    const count=editor.graph.value.nodes.length
    assert.equal(editor.add('start',{x:0,y:0}),undefined);assert.equal(editor.graph.value.nodes.length,count)
    editor.markSaved();assert.equal(editor.dirty.value,false)
    editor.load(original)
    const returning=original.edges.find(e=>e.target==='solve-loop'&&e.targetHandle==='continue')
    editor.selectedEdgeId.value=returning.id;editor.remove()
    assert.equal(editor.connect({source:returning.source,target:returning.target,sourceHandle:returning.sourceHandle,targetHandle:returning.targetHandle}),true)
    const added=editor.graph.value.edges.at(-1);assert.equal(added.targetHandle,'continue')
    editor.undo();assert.equal(editor.graph.value.edges.some(e=>e.id===added.id),false)
    editor.redo();assert.equal(editor.graph.value.edges.some(e=>e.id===added.id),true)
  } finally { await vite.close() }
})
