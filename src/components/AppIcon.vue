<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 })
const paths: Record<string, string> = {
  sparkles: 'm12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3ZM20 2v4M18 4h4',
  plus: 'M12 5v14M5 12h14',
  compose:
    'M14 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9M16 3l5 5M10 14l3-1 9-9-3-3-9 9-1 4Z',
  panel: 'M9 3v18M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  chat: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3h2a8.5 8.5 0 0 1 8.5 8.5ZM7 10h9M7 14h6',
  close: 'm6 6 12 12M18 6 6 18',
  code: 'm8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  coffee: 'M4 8h12v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8ZM16 9h2a3 3 0 1 1 0 6h-2M7 2v3M12 2v3',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M6 10h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2ZM12 14v3',
  'arrow-up-right': 'M6 18 18 6M6 6h12v12',
  'arrow-up': 'M12 19V5m-6 6 6-6 6 6',
  stop: 'M7 7h10v10H7Z',
  copy: 'M9 9h11v11H9ZM15 5V3H3v12h2',
  check: 'm5 12 4 4L19 6',
  book: 'M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15M5 8l4 1m-4 3 4 1m6-4 4-1m-4 5 4-1',
  brush: 'm3 21 2-7L18 1l5 5L10 19l-7 2Zm2-7 5 5M15 4l5 5M4 20l-1 1',
  feather: 'M20 3C10 1 3 8 4 17l3 3c9 1 16-6 14-16l-1-1ZM3 22 17 8M7 18v-6m5 1h6',
  scroll: 'M5 3h12a3 3 0 0 1 3 3v13M5 3a3 3 0 0 0-3 3v1h6V6a3 3 0 0 0-3-3Zm0 4v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-1H9v1a2 2 0 0 1-4 0M9 10h7m-7 4h7',
  orbit: 'M12 5c6 0 10 3 10 7s-4 7-10 7S2 16 2 12s4-7 10-7Zm-6-3c3-2 7 1 10 6s3 11 0 13-7-1-10-6S3 4 6 2Zm6 9v2',
  function: 'M5 20h3L13 4h6M7 10h10m-2 8 5-6m-5 0 5 6',
  chart: 'M3 3v18h18M5 17c4 0 4-11 8-11s4 7 8 7',
  triangle: 'm12 3 10 18H2L12 3ZM8 21v-5h5',
  dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 4h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01',
  leaf: 'M20 3C9 1 2 8 5 16c8 4 17-2 15-13ZM3 22 16 8m-8 9v-5m0 5 6-1',
  chevron: 'm9 5 7 7-7 7',
}
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.chat" />
  </svg>
</template>
