<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import { subjects, subjectOrder, type Subject } from '../config/subjects'

// 只发出学科变更事件，草稿保存和发送期间的切换限制由主页面处理。
defineProps<{ modelValue: Subject; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [subject: Subject] }>()
</script>

<template>
  <div class="subject-switch" role="group" aria-label="切换学习学科" :style="{ '--switch-index': subjectOrder.indexOf(modelValue) }">
    <span class="switch-slider" aria-hidden="true"></span>
    <button v-for="key in subjectOrder" :key="key" type="button" :aria-pressed="modelValue === key" :disabled="disabled" :title="`切换到${subjects[key].discipline}`" @click="emit('update:modelValue', key)">
      <span class="switch-icon" :class="`${key}-switch-icon`"><AppIcon :name="key === 'chinese' ? 'book' : subjects[key].icon" /><i></i></span>
      <span>{{ subjects[key].label }}</span>
    </button>
  </div>
</template>
