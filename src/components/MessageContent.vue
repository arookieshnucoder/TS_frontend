<script setup lang="ts">
import { computed } from 'vue'
import { mathSegments } from '../utils/math-content'
import 'katex/dist/katex.min.css'
const props = defineProps<{ content: string }>()
// Model prose is text; only bounded, untrusted-mode KaTeX output is rendered as formula markup.
const blocks = computed(() =>
  props.content.split(/```/).map((part, index) => {
    if (index % 2 === 0) return { type: 'text', content: part, language: '', segments: mathSegments(part.trim()) }
    const newline = part.indexOf('\n')
    return {
      type: 'code',
      language: newline < 0 ? '' : part.slice(0, newline),
      content: newline < 0 ? part : part.slice(newline + 1).replace(/\n$/, ''),
      segments: [],
    }
  }),
)
</script>

<template>
  <div class="message-content">
    <template v-for="(block, index) in blocks" :key="index"
      ><div v-if="block.type === 'code'" class="code-block">
        <div class="code-language">{{ block.language || '代码' }}</div>
        <pre><code>{{ block.content }}</code></pre>
      </div>
      <p v-else-if="block.content.trim()" class="message-paragraph">
        <template v-for="(segment, segmentIndex) in block.segments" :key="segmentIndex"><span v-if="segment.type === 'text'">{{ segment.text }}</span><span v-else :class="{ 'math-display': segment.display }" v-html="segment.html" /></template>
      </p></template
    >
  </div>
</template>

<style scoped>
.math-display { display: block; max-width: 100%; overflow-x: auto; }
.message-paragraph :deep(.katex) { font-size: 1.08em; }
</style>
