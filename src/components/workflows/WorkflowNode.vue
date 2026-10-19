<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { definitionFor, portLabel, nodeStateLabels, type NodeType, type WorkflowNode, type NodeObservation } from '../../api/workflows'
const props = defineProps<{ type: NodeType; data: WorkflowNode['data']; selected?: boolean; connectable?: boolean; observation?: NodeObservation; iterationCount?: number }>()
const definition = computed(() => definitionFor(props.type)!)
const operator = computed(() => ({ less_than: '<', less_or_equal: '≤', equals: '=', not_equals: '≠', greater_than: '>' } as Record<string, string>)[props.data.config.operator ?? ''] ?? props.data.config.operator)
const portTop = (index: number, length: number) => length > 1 ? `${(length === 2 ? 35 : 20) + index * (length === 2 ? 35 : 30)}%` : '50%'
</script>

<template>
  <article class="wf-node" :class="[{ selected, note: type === 'note', 'wf-loop-node': type === 'loop' }, observation?.state]" :style="{ '--node-color': definition.color }">
    <Handle v-for="(port, index) in definition.inputs" :id="port" :key="port" type="target" :position="Position.Left" :connectable="connectable" :connectable-start="false" :title="portLabel(type, port)" :style="{ top: portTop(index, definition.inputs.length) }" />
    <header><span class="wf-node-icon">{{ definition.icon }}</span><strong>{{ data.label }}</strong><small>{{ definition.label }}</small></header>
    <p v-if="type === 'note'">{{ data.config.text || '添加说明…' }}</p>
    <p v-else>{{ data.description || definition.description }}</p>
    <div v-if="type === 'loop' || type === 'condition'" class="wf-node-rule"><code>{{ data.config.variable || '待定义变量' }} {{ operator }} {{ data.config.value || '?' }}</code><small v-if="type === 'loop'">次数上限：{{ data.config.maxIterations || '未定义' }}</small></div>
    <div v-else-if="type === 'delegate'" class="wf-node-rule"><code>{{ data.config.agent || '待选择注册子任务' }}</code><small>宿主显式委派 · 独立权限</small></div>
    <div v-else-if="type === 'model'" class="wf-node-rule"><code>{{ data.config.model }}</code></div>
    <footer v-if="observation"><span class="wf-state-dot" />{{ nodeStateLabels[observation.state] }}<span v-if="iterationCount">· {{ iterationCount }} 轮</span><span v-else-if="observation.count">· {{ observation.count }} 次</span><span v-if="observation.durationMs !== undefined">· {{ (observation.durationMs / 1000).toFixed(2) }}s</span></footer>
    <footer v-else-if="data.bindings.length"><span class="wf-binding-dot" />{{ data.bindings.length }} 项事件绑定</footer>
    <footer v-else-if="type !== 'note'">尚未绑定运行事件</footer>
    <template v-if="type === 'loop'"><span v-for="(port, index) in definition.inputs" :key="`label-in-${port}`" class="wf-port-label wf-port-in" :style="{ top: portTop(index, definition.inputs.length) }">{{ portLabel(type, port) }}</span></template>
    <span v-for="(port, index) in definition.outputs.length > 1 ? definition.outputs : []" :key="`label-out-${port}`" class="wf-port-label wf-port-out" :style="{ top: portTop(index, definition.outputs.length) }">{{ portLabel(type, port) }}</span>
    <Handle v-for="(port, index) in definition.outputs" :id="port" :key="port" type="source" :position="Position.Right" :connectable="connectable" :connectable-end="false" :title="portLabel(type, port)" :style="{ top: portTop(index, definition.outputs.length) }" />
  </article>
</template>
