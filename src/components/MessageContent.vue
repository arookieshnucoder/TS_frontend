<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ content: string }>()
// Model output is rendered as text, never injected as HTML.
const blocks = computed(() =>
  props.content.split(/```/).map((part, index) => {
    if (index % 2 === 0) return { type: 'text', content: part, language: '' }
    const newline = part.indexOf('\n')
    return {
      type: 'code',
      language: newline < 0 ? '' : part.slice(0, newline),
      content: newline < 0 ? part : part.slice(newline + 1).replace(/\n$/, ''),
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
        {{ block.content.trim() }}
      </p></template
    >
  </div>
</template>
