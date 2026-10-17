<script setup lang="ts">
import { computed } from 'vue'
import MessageText from './MessageText.vue'
import 'katex/dist/katex.min.css'
const props = defineProps<{ content: string }>()
type Block = { type: 'code'; content: string; language: string }
  | { type: 'text'; content: string; tag: 'p' | 'h2' | 'h3' | 'h4' | 'blockquote' }
  | { type: 'list'; items: string[]; tag: 'ol' | 'ul' }
// Structural Markdown becomes Vue elements. User HTML and code are always text;
// only bounded, untrusted-mode KaTeX output in MessageText can produce markup.
const blocks = computed<Block[]>(() => props.content.split(/```/).flatMap((part, index): Block[] => {
  if (index % 2) {
    const newline = part.indexOf('\n')
    return [{ type: 'code', language: newline < 0 ? '' : part.slice(0, newline),
      content: newline < 0 ? part : part.slice(newline + 1).replace(/\n$/, '') }]
  }
  return part.trim().split(/\n\s*\n/).filter(Boolean).map((paragraph): Block => {
    const heading = /^(#{1,6})\s+([^\n]+)$/.exec(paragraph)
    if (heading) return { type: 'text', tag: heading[1]!.length <= 2 ? 'h2' : heading[1]!.length === 3 ? 'h3' : 'h4', content: heading[2]! }
    const lines = paragraph.split('\n')
    if (lines.every(line => /^>\s?/.test(line))) return { type: 'text', tag: 'blockquote', content: lines.map(line => line.replace(/^>\s?/, '')).join('\n') }
    if (lines.every(line => /^\d+\.\s+/.test(line))) return { type: 'list', tag: 'ol', items: lines.map(line => line.replace(/^\d+\.\s+/, '')) }
    if (lines.every(line => /^[-*]\s+/.test(line))) return { type: 'list', tag: 'ul', items: lines.map(line => line.replace(/^[-*]\s+/, '')) }
    return { type: 'text', tag: 'p', content: paragraph }
  })
}))
</script>

<template>
  <div class="message-content">
    <template v-for="(block, index) in blocks" :key="index"
      ><div v-if="block.type === 'code'" class="code-block">
        <div class="code-language">{{ block.language || '代码' }}</div>
        <pre><code>{{ block.content }}</code></pre>
      </div>
      <component v-else-if="block.type === 'list'" :is="block.tag" class="message-list">
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex"><MessageText :content="item" /></li>
      </component>
      <component v-else :is="block.tag" :class="block.tag === 'p' ? 'message-paragraph' : 'message-' + block.tag">
        <MessageText :content="block.content" />
      </component></template
    >
  </div>
</template>

<style scoped>
.message-content { overflow-wrap: anywhere; }
.message-content :deep(.katex) { font-size: 1.08em; }
.message-h2, .message-h3, .message-h4 { color: var(--ink); font-size: 17px; font-weight: 600; line-height: 1.6; margin: 1.2em 0 .7em; }
.message-h4 { font-size: 15px; }
.message-blockquote { margin: .8em 0 1.2em; padding: .6em 1em; border-left: 2px solid var(--accent); border-radius: 0 6px 6px 0; color: var(--muted); background: color-mix(in srgb, var(--accent-soft) 45%, transparent); font-size: 12px; line-height: 1.9; }
.message-list { color: var(--text); font-size: 14px; line-height: 1.95; padding-left: 1.7em; margin: .6em 0 1.2em; }
.message-list li { padding-left: .2em; margin: .35em 0; }
.message-content :deep(strong) { color: var(--ink); font-weight: 600; }
</style>
