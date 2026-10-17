<script setup lang="ts">
import { computed } from 'vue'
import { mathSegments, type MathSegment } from '../utils/math-content'

const props = defineProps<{ content: string }>()
type Segment = MathSegment | { type: 'strong'; children: MathSegment[] } | { type: 'code'; text: string }
const segments = computed(() => props.content.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).filter(Boolean).flatMap<Segment>(text => {
  if (text.startsWith('**') && text.endsWith('**')) return [{ type: 'strong', children: mathSegments(text.slice(2, -2)) }]
  if (text.startsWith('`') && text.endsWith('`')) return [{ type: 'code', text: text.slice(1, -1) }]
  return mathSegments(text)
}))
</script>

<template>
  <template v-for="(segment, index) in segments" :key="index">
    <span v-if="segment.type === 'math'" :class="{ 'math-display': segment.display }" v-html="segment.html" />
    <strong v-else-if="segment.type === 'strong'"><template v-for="(child, childIndex) in segment.children" :key="childIndex"><span v-if="child.type === 'math'" :class="{ 'math-display': child.display }" v-html="child.html" /><span v-else>{{ child.text }}</span></template></strong>
    <code v-else-if="segment.type === 'code'" class="inline-code">{{ segment.text }}</code>
    <span v-else>{{ segment.text }}</span>
  </template>
</template>

<style scoped>
.math-display { display: block; max-width: 100%; overflow-x: auto; }
.inline-code { padding: .12em .35em; border: 1px solid var(--border); border-radius: 4px; background: var(--surface); font-size: .9em; }
</style>
