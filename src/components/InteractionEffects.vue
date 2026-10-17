<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const halo = ref<HTMLElement>()
const ripples = ref<{ id: number; x: number; y: number }[]>([])
const visible = ref(false)
let sequence = 0
let frame = 0
let x = 0
let y = 0
let pointerQuery: MediaQueryList | undefined
let motionQuery: MediaQueryList | undefined
const timers = new Set<ReturnType<typeof setTimeout>>()
const mediaCleanups: (() => void)[] = []

function observePreference(query: MediaQueryList) {
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', onPreferenceChange)
    mediaCleanups.push(() => query.removeEventListener?.('change', onPreferenceChange))
  } else if (typeof query.addListener === 'function') {
    query.addListener(onPreferenceChange)
    mediaCleanups.push(() => query.removeListener?.(onPreferenceChange))
  }
}

function onMove(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || !pointerQuery?.matches || motionQuery?.matches) return
  x = event.clientX; y = event.clientY; visible.value = true
  if (!frame) frame = window.requestAnimationFrame(() => {
    if (halo.value) halo.value.style.transform = `translate3d(${x}px, ${y}px, 0)`
    frame = 0
  })
}
function onLeave() { visible.value = false }
function onPreferenceChange() {
  window.cancelAnimationFrame(frame)
  frame = 0
  timers.forEach(clearTimeout)
  timers.clear()
  visible.value = false
  ripples.value = []
}
function onDown(event: PointerEvent) {
  if (event.button !== 0 || motionQuery?.matches) return
  const target = event.target as HTMLElement | null
  if (target?.closest('button:disabled, input, textarea, select')) return
  const id = ++sequence
  ripples.value = [...ripples.value.slice(-7), { id, x: event.clientX, y: event.clientY }]
  const timer = setTimeout(() => {
    ripples.value = ripples.value.filter(ripple => ripple.id !== id)
    timers.delete(timer)
  }, 850)
  timers.add(timer)
}
onMounted(() => {
  pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  observePreference(pointerQuery)
  observePreference(motionQuery)
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerdown', onDown, { passive: true })
  document.documentElement.addEventListener('pointerleave', onLeave)
  window.addEventListener('blur', onLeave)
})
onBeforeUnmount(() => {
  window.cancelAnimationFrame(frame)
  timers.forEach(clearTimeout)
  mediaCleanups.forEach(cleanup => cleanup())
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerdown', onDown)
  document.documentElement.removeEventListener('pointerleave', onLeave)
  window.removeEventListener('blur', onLeave)
})
</script>

<template>
  <div class="interaction-effects" aria-hidden="true">
    <span ref="halo" class="cursor-halo" :class="{ visible }"><i></i></span>
    <span v-for="ripple in ripples" :key="ripple.id" class="click-feedback" :style="{ left: `${ripple.x}px`, top: `${ripple.y}px` }"><i></i><b></b><em></em></span>
  </div>
</template>
