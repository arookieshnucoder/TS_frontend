import { ref, watch, type Ref } from 'vue'
import { chatApi } from '../api/chat'
import { createDemoChatApi } from '../api/demo-chat'
import type { Subject } from '../config/subjects'
import { useChat } from './useChat'

/** 在初始化时选择真实接口或演示接口，网络请求失败不会改变当前模式。 */
export function useAgentChat(subject: Ref<Subject>) {
  const mode = import.meta.env.VITE_CHAT_MODE ?? 'demo'
  if (mode !== 'demo' && mode !== 'backend') throw new Error('VITE_CHAT_MODE 只能设为 demo 或 backend。')
  const isDemo = mode === 'demo'
  const storageNotice = ref('')
  const api = isDemo ? createDemoChatApi(subject, () => {
    storageNotice.value = '浏览器存储不可用，当前演示对话仅在本次页面中保留。'
  }) : chatApi
  const chat = useChat(api)
  if (isDemo) watch(subject, () => { void chat.loadSessions() })
  return { ...chat, isDemo, storageNotice }
}
