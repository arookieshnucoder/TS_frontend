<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from './components/AppIcon.vue'
import MessageContent from './components/MessageContent.vue'
import { useChat } from './composables/useChat'
import './styles.css'

const {
  sessions,
  activeSession,
  activeId,
  pendingSessionId,
  apiError,
  isLoading,
  isPending,
  loadSessions,
  createSession,
  selectSession,
  sendMessage,
  stopGeneration,
} = useChat()
const sidebarOpen = ref(window.innerWidth > 760)
const query = ref('')
const draft = ref('')
const input = ref<HTMLTextAreaElement>()
const messageList = ref<HTMLElement>()
const followLatest = ref(true)
const copiedId = ref('')
const copyError = ref('')
let copyTimer: ReturnType<typeof setTimeout> | undefined
const statusLabels = { pending: '生成中', finished: '已完成', failure: '请求异常' }
const isSending = computed(() => activeId.value === pendingSessionId.value)
const filteredSessions = computed(() =>
  sessions.value.filter((session) =>
    session.title.toLowerCase().includes(query.value.toLowerCase()),
  ),
)
const groups = computed(() =>
  [
    {
      label: '今天',
      sessions: filteredSessions.value.filter(
        (session) => new Date(session.updatedAt).toDateString() === new Date().toDateString(),
      ),
    },
    {
      label: '更早的对话',
      sessions: filteredSessions.value.filter(
        (session) => new Date(session.updatedAt).toDateString() !== new Date().toDateString(),
      ),
    },
  ].filter((group) => group.sessions.length),
)
const suggestions = [
  {
    icon: 'code',
    title: '一起学点新东西',
    text: '用简单的例子讲讲 TypeScript 泛型',
    color: 'green',
  },
  {
    icon: 'sparkles',
    title: '给灵感一点空间',
    text: '帮我写一个有趣的短篇故事开头',
    color: 'purple',
  },
  {
    icon: 'coffee',
    title: '让日常有点不同',
    text: '帮我安排一个轻松的周末',
    color: 'orange',
  },
  {
    icon: 'chat',
    title: '随便聊聊也很好',
    text: '分享一个让我意想不到的冷知识',
    color: 'blue',
  },
]

function resizeInput() {
  if (!input.value) return
  input.value.style.height = 'auto'
  input.value.style.height = `${Math.min(input.value.scrollHeight, 180)}px`
}
async function openSession(id: string) {
  if (!(await selectSession(id))) return
  followLatest.value = true
  draft.value = ''
  if (window.innerWidth <= 760) sidebarOpen.value = false
  nextTick(resizeInput)
}
async function newChat() {
  if (!(await createSession())) return
  query.value = ''
  followLatest.value = true
  draft.value = ''
  if (window.innerWidth <= 760) sidebarOpen.value = false
  nextTick(() => {
    resizeInput()
    input.value?.focus()
  })
}
async function submit(text = draft.value) {
  if (!text.trim() || isSending.value || isPending.value || isLoading.value) return
  followLatest.value = true
  if (!(await sendMessage(text))) return
  if (draft.value === text) draft.value = ''
  nextTick(() => {
    resizeInput()
    input.value?.focus()
  })
}
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault()
    submit()
  }
}
async function copyMessage(id: string, content: string) {
  try {
    await navigator.clipboard.writeText(content)
    copiedId.value = id
    copyError.value = ''
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copiedId.value = ''
    }, 2000)
  } catch {
    copyError.value = '复制未成功，请选中回答文字手动复制。'
  }
}
function updateScrollPosition() {
  const list = messageList.value
  if (list) followLatest.value = list.scrollHeight - list.scrollTop - list.clientHeight < 80
}
watch(
  () => [activeId.value, activeSession.value?.messages.map((message) => message.content).join('')],
  async () => {
    await nextTick()
    const list = messageList.value
    if (list && followLatest.value) list.scrollTop = list.scrollHeight
  },
  { flush: 'post', immediate: true },
)
onBeforeUnmount(() => clearTimeout(copyTimer))
</script>

<template>
  <div class="chat-app" :class="{ 'sidebar-hidden': !sidebarOpen }">
    <button
      v-if="sidebarOpen"
      class="sidebar-backdrop"
      aria-label="关闭侧边栏"
      @click="sidebarOpen = false"
    ></button>
    <aside class="sidebar" :class="{ 'is-open': sidebarOpen }" aria-label="聊天会话">
      <div class="sidebar-brand">
        <a class="brand" href="#" aria-label="回到新对话" @click.prevent="newChat"
          ><span class="brand-mark"><AppIcon name="sparkles" /></span> 松间<span class="brand-en"
            >CHAT</span
          ></a
        >
        <button
          class="icon-button collapse-button"
          aria-label="收起侧边栏"
          title="收起侧边栏"
          @click="sidebarOpen = false"
        >
          <AppIcon name="panel" />
        </button>
      </div>
      <button class="new-chat-button" :disabled="isLoading || isPending" @click="newChat">
        <AppIcon name="plus" /> 开启新对话
        <AppIcon name="compose" class="new-chat-end" />
      </button>
      <div class="search-box">
        <AppIcon name="search" /><input
          v-model="query"
          aria-label="搜索对话"
          placeholder="搜索对话"
        /><button v-if="query" class="clear-search" aria-label="清除搜索" @click="query = ''">
          <AppIcon name="close" />
        </button>
      </div>
      <nav class="session-list" aria-label="历史对话">
        <div v-for="group in groups" :key="group.label" class="session-group">
          <p class="group-label">{{ group.label }}</p>
          <button
            v-for="session in group.sessions"
            :key="session.id"
            :disabled="isLoading || isPending"
            class="session-item"
            :class="{ active: activeId === session.id }"
            :aria-current="activeId === session.id ? 'page' : undefined"
            @click="openSession(session.id)"
          >
            <AppIcon name="chat" /><span>{{ session.title }}</span
            ><span v-if="session.id === pendingSessionId" class="session-pending"></span>
          </button>
        </div>
        <p v-if="!filteredSessions.length" class="search-empty">没有找到相关对话</p>
      </nav>
      <div class="sidebar-bottom">
        <div class="local-note">
          <AppIcon name="lock" /><span>你的想法，留在这里<small>对话保存在后端本地</small></span>
        </div>
        <div class="profile">
          <span class="avatar">我</span>
          <div><strong>我的小天地</strong><span>保持好奇，随心畅聊</span></div>
          <span class="profile-dot"></span>
        </div>
      </div>
    </aside>

    <main class="main-panel">
      <header class="topbar">
        <div class="topbar-left">
          <button
            v-if="!sidebarOpen"
            class="icon-button"
            aria-label="展开侧边栏"
            @click="sidebarOpen = true"
          >
            <AppIcon name="panel" /></button
          ><span class="assistant-name">松间 <span>你的灵感搭子</span></span>
        </div>
        <span class="demo-badge"><span></span> 演示模式</span>
      </header>

      <div
        ref="messageList"
        class="conversation-scroll"
        :class="{ 'is-empty': !activeSession?.messages.length }"
        @scroll="updateScrollPosition"
      >
        <section v-if="!activeSession?.messages.length" class="welcome">
          <div class="welcome-symbol"><AppIcon name="sparkles" /></div>
          <div class="welcome-eyebrow">A LITTLE SPACE FOR BIG IDEAS</div>
          <h1>今天，想聊点什么？</h1>
          <p class="welcome-description">
            一个问题、一点灵感，或是天马行空的想法。<br />我在这里，陪你慢慢探索。
          </p>
          <div class="suggestion-grid">
            <button
              v-for="suggestion in suggestions"
              :key="suggestion.title"
              class="suggestion-card"
              @click="submit(suggestion.text)"
            >
              <span class="suggestion-icon" :class="suggestion.color"
                ><AppIcon :name="suggestion.icon"
              /></span>
              <strong>{{ suggestion.title }}</strong
              ><span class="suggestion-text">{{ suggestion.text }}</span
              ><AppIcon class="suggestion-arrow" name="arrow-up-right" />
            </button>
          </div>
          <p class="welcome-footnote"><span></span> 不必有标准答案，从一句你好开始。</p>
        </section>
        <section v-else class="messages" aria-label="聊天记录">
          <div class="conversation-intro">
            <span></span> {{ activeSession.title }} <span></span>
          </div>
          <article
            v-for="message in activeSession.messages"
            :key="message.id"
            class="message"
            :class="message.role"
          >
            <template v-if="message.role === 'assistant'">
              <span class="assistant-avatar"><AppIcon name="sparkles" /></span>
              <div class="assistant-body">
                <div class="message-author">松间 <span>与你一起探索</span></div>
                <MessageContent v-if="message.content" :content="message.content" />
                <span v-else class="typing-indicator" role="status" aria-label="正在思考"
                  ><i></i><i></i><i></i
                ></span>
                <span
                  v-if="message.status === 'streaming' && message.content"
                  class="stream-cursor"
                ></span>
                <div v-if="message.status !== 'streaming'" class="message-actions">
                  <button
                    class="icon-button"
                    :aria-label="copiedId === message.id ? '已复制' : '复制回答'"
                    :title="copiedId === message.id ? '已复制' : '复制回答'"
                    @click="copyMessage(message.id, message.content)"
                  >
                    <AppIcon :name="copiedId === message.id ? 'check' : 'copy'" /></button
                  ><span v-if="message.status === 'stopped'">已停止生成</span
                  ><span v-if="copiedId === message.id">已复制</span>
                </div>
              </div>
            </template>
            <template v-else
              ><div class="user-bubble">{{ message.content }}</div></template
            >
          </article>
        </section>
      </div>

      <footer class="composer-area">
        <p v-if="activeSession" class="notice session-status" :data-status="activeSession.sessionStatus" role="status">
          {{ statusLabels[activeSession.sessionStatus] }}
        </p>
        <p v-if="activeSession?.sessionStatus === 'failure'" class="notice session-failure" role="alert">
          {{ activeSession.sessionError?.message || '模型接口未正确返回，请稍后重试。' }}
          <span v-if="activeSession.sessionError">（{{ activeSession.sessionError.code }} / {{ activeSession.sessionError.httpStatusCode }}）</span>
        </p>
        <p v-if="apiError" class="notice" role="alert">
          {{ apiError }}
          <button type="button" :disabled="isLoading || isPending" @click="loadSessions">重新加载</button>
        </p>
        <p v-if="isPending" class="notice" role="status">正在处理，请稍候…</p>
        <p v-if="copyError" class="notice" role="status">
          {{ copyError }}
        </p>
        <form class="composer" @submit.prevent="submit()">
          <textarea
            ref="input"
            v-model="draft"
            aria-label="输入消息"
            placeholder="发消息给松间，聊聊你的想法…"
            rows="1"
            maxlength="12000"
            @input="resizeInput"
            @keydown="handleKeydown"
          ></textarea>
          <div class="composer-toolbar">
            <span class="composer-mode"><AppIcon name="sparkles" /> 随心聊聊</span>
            <div class="composer-controls">
              <span class="keyboard-hint">Shift + Enter 换行</span
              ><button
                v-if="isSending"
                type="button"
                class="send-button stop-button"
                aria-label="停止生成"
                title="停止生成"
                @click="stopGeneration"
              >
                <AppIcon name="stop" /></button
              ><button
                v-else
                type="submit"
                class="send-button"
                :disabled="!draft.trim() || isLoading || isPending"
                aria-label="发送消息"
                title="发送消息"
              >
                <AppIcon name="arrow-up" />
              </button>
            </div>
          </div>
        </form>
        <p class="composer-disclaimer">
          给想法一点空间 <span>·</span> AI 生成内容，请核实重要信息
        </p>
      </footer>
    </main>
  </div>
</template>
