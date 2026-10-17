import { ref, watch, type Ref } from 'vue'
import { chatApi } from '../api/chat'
import { createDemoChatApi } from '../api/demo-chat'
import type { Subject } from '../config/subjects'
import { useChat } from './useChat'

export function useAgentChat(subject: Ref<Subject>) {
  const isDemo = import.meta.env.VITE_CHAT_MODE !== 'backend'
  const storageNotice = ref('')
  const api = isDemo ? createDemoChatApi(subject, () => {
    storageNotice.value = '浏览器存储不可用，当前演示对话仅在本次页面中保留。'
  }) : chatApi
  const chat = useChat(api)
  if (isDemo) watch(subject, () => { void chat.loadSessions() })
  return { ...chat, isDemo, storageNotice }
}
