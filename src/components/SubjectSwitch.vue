<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import type { Subject } from '../config/subjects'

defineProps<{ modelValue: Subject; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [subject: Subject] }>()
</script>

<template>
  <div class="subject-switch" role="group" aria-label="切换学习学科" :class="{ 'is-math': modelValue === 'math' }">
    <span class="switch-slider" aria-hidden="true"></span>
    <button type="button" :aria-pressed="modelValue === 'chinese'" :disabled="disabled" title="切换到语文研习室" @click="emit('update:modelValue', 'chinese')">
      <span class="switch-icon chinese-switch-icon"><AppIcon name="book" /><i></i></span>
      <span>语文</span>
    </button>
    <button type="button" :aria-pressed="modelValue === 'math'" :disabled="disabled" title="切换到数学探索室" @click="emit('update:modelValue', 'math')">
      <span class="switch-icon math-switch-icon"><AppIcon name="orbit" /><i></i></span>
      <span>数学</span>
    </button>
  </div>
</template>
