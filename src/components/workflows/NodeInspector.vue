<script setup lang="ts">
import { computed } from 'vue'
import { definitionFor, portLabel, type WorkflowNode, type EventBinding, type RuntimeSnapshot } from '../../api/workflows'
const props = defineProps<{ node: WorkflowNode; readonly?: boolean; runtime?: Partial<RuntimeSnapshot>; bodyNodes?: WorkflowNode[] }>()
const emit = defineEmits<{ update: [data: WorkflowNode['data']]; locate: [id: string] }>()
const definition = computed(() => definitionFor(props.node.type)!)
const actualLimit = computed(() => props.runtime?.[props.node.data.config.maxIterations?.slice(8) as keyof RuntimeSnapshot])
// Commit on input so saving or switching selection cannot drop the focused field.
function change(key: 'label' | 'description' | 'inputs' | 'outputs', event: Event) { emit('update', { ...props.node.data, [key]: (event.target as HTMLInputElement).value }) }
function config(key: string, event: Event) { emit('update', { ...props.node.data, config: { ...props.node.data.config, [key]: (event.target as HTMLInputElement).value } }) }
function binding(index: number, key: keyof EventBinding, event: Event) {
  const bindings = props.node.data.bindings.map(b => ({ ...b })), value = (event.target as HTMLInputElement).value
  const item = bindings[index]!
  if (key === 'role') item.role = value as EventBinding['role']
  else if (key === 'event') { item.event = value; if (value !== 'agent.subagent.event') delete item.nestedEvent }
  else if (key === 'nestedEvent') { if (value) item.nestedEvent = value; else delete item.nestedEvent }
  else { item[key] = value; if (!item.field && !item.value) { delete item.field; delete item.value } }
  emit('update', { ...props.node.data, bindings })
}
function addBinding() { emit('update', { ...props.node.data, bindings: [...props.node.data.bindings, { event: 'agent.context', role: 'activity' }] }) }
function removeBinding(index: number) { emit('update', { ...props.node.data, bindings: props.node.data.bindings.filter((_, i) => i !== index) }) }
</script>

<template>
  <section class="wf-inspector">
    <div class="wf-section-heading"><span :style="{ color: definition.color }">{{ definition.icon }}</span><h3>{{ definition.label }}</h3><code>{{ node.id }}</code></div>
    <button type="button" class="wf-focus-node" @click="emit('locate', node.id)">居中查看此节点</button>
    <div v-if="node.type === 'loop'" class="wf-loop-guide"><strong>进入 → 判断 → 循环体 → 下一轮</strong><p>答案就绪从 break 提前退出；达到次数上限走 limit。只有 continue / break 接收本循环体返回。</p><p v-if="node.data.config.maxIterations?.startsWith('runtime.')">当前上限：{{ actualLimit ?? '查看运行时快照' }}</p></div>
    <div v-if="node.type === 'loop' && bodyNodes?.length" class="wf-loop-steps"><strong>循环内节点 · 点击查看具体属性</strong><button v-for="step in bodyNodes" :key="step.id" type="button" @click="emit('locate', step.id)"><span>{{ definitionFor(step.type)?.icon }}</span>{{ step.data.label }}</button><p>提前退出：{{ node.data.config.exit }}</p><p>超限路径：{{ node.data.config.onLimit }}</p></div>
    <div class="wf-port-contract"><span>输入：{{ definition.inputs.map(p => portLabel(node.type, p)).join(' / ') || '无' }}</span><span>输出：{{ definition.outputs.map(p => portLabel(node.type, p)).join(' / ') || '无' }}</span></div>
    <fieldset :disabled="readonly">
      <label>节点名称<input :value="node.data.label" maxlength="100" @input="change('label', $event)" /></label>
      <label>节点说明<textarea :value="node.data.description" rows="2" maxlength="3000" @input="change('description', $event)" /></label>
      <h4>定义属性</h4><p class="wf-help">用于描述现有执行阶段；修改这里不改变实际运行参数。</p>
      <label v-for="f in definition.fields" :key="f.key">{{ f.label }}<select v-if="f.options" :value="node.data.config[f.key] ?? f.default" @change="config(f.key, $event)"><option v-for="option in f.options" :key="option" :value="option">{{ option }}</option></select><textarea v-else-if="f.multiline" :value="node.data.config[f.key] ?? f.default" rows="3" maxlength="12000" @input="config(f.key, $event)" /><input v-else :value="node.data.config[f.key] ?? f.default" maxlength="12000" @input="config(f.key, $event)" /><small v-if="f.help" class="wf-help">{{ f.help }}</small></label>
      <template v-if="node.type !== 'note'">
        <label>输入说明<textarea :value="node.data.inputs" rows="2" @input="change('inputs', $event)" /></label>
        <label>输出说明<textarea :value="node.data.outputs" rows="2" @input="change('outputs', $event)" /></label>
        <h4>真实事件绑定</h4><p class="wf-help">事件名精确匹配，或使用末尾 .* 匹配前缀。筛选字段和值需成对填写。</p>
        <div v-for="(b, index) in node.data.bindings" :key="index" class="wf-binding">
          <div><input aria-label="事件名称" :value="b.event" @input="binding(index, 'event', $event)" /><select aria-label="事件作用" :value="b.role" @change="binding(index, 'role', $event)"><option value="start">开始</option><option value="finish">完成</option><option value="activity">过程</option><option value="iteration">轮次</option><option value="error">错误</option></select><button type="button" aria-label="删除事件绑定" @click="removeBinding(index)">×</button></div>
          <div v-if="b.event === 'agent.subagent.event'"><input aria-label="子任务内部事件" placeholder="内部事件，如 agent.model.*" :value="b.nestedEvent" @input="binding(index, 'nestedEvent', $event)" /></div>
          <div><input aria-label="筛选字段" placeholder="字段，如 tool" :value="b.field" @input="binding(index, 'field', $event)" /><input aria-label="字段比较值" placeholder="精确匹配值" :value="b.value" @input="binding(index, 'value', $event)" /></div>
        </div>
        <button v-if="node.data.bindings.length < 24" type="button" class="wf-add-binding" @click="addBinding">＋ 添加事件绑定</button>
      </template>
    </fieldset>
  </section>
</template>
