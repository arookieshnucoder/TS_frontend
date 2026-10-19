<script setup lang="ts">
import { computed, defineAsyncComponent, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from './components/AppIcon.vue'
import MessageContent from './components/MessageContent.vue'
import McpHub from './components/McpHub.vue'
import RunTimeline from './components/RunTimeline.vue'
import SubjectSwitch from './components/SubjectSwitch.vue'
import SubjectAtmosphere from './components/SubjectAtmosphere.vue'
import InteractionEffects from './components/InteractionEffects.vue'
import { subjects, subjectOrder, type Subject } from './config/subjects'
import { useAgentChat } from './composables/useAgentChat'
import { authKey } from './composables/useAuth'
import './styles.css'
const auth = inject(authKey, undefined)
const isAdmin = computed(() => auth?.user.value?.role === 'admin')
const WorkflowWorkbench = defineAsyncComponent(() => import('./components/workflows/WorkflowWorkbench.vue'))
const workflowOpen = ref(false), workflowRunId = ref<string>()
function openWorkflow(runId?: string) { workflowRunId.value = runId; workflowOpen.value = true }
watch(isAdmin, value => { if (!value) { workflowOpen.value = false; workflowRunId.value = undefined } })

/** 恢复上次学科；没有可用偏好时使用语文，仅影响界面初始选择。 */
function savedSubject(): Subject {
  try {
    const saved = localStorage.getItem('songjian-subject')
    return subjectOrder.find(value => value === saved) ?? 'chinese'
  }
  catch { return 'chinese' }
}
const subject = ref<Subject>(savedSubject())
const activeSubject = computed(() => subjects[subject.value])
const {
  sessions,
  activeSession,
  activeId,
  pendingSessionId,
  apiError,
  isLoading,
  isPending,
  isTyping,
  loadSessions,
  createSession,
  selectSession,
  sendMessage,
  stopGeneration,
  isDemo,
  storageNotice,
} = useAgentChat(subject)
const sidebarOpen = ref(window.innerWidth > 760)
const query = ref('')
const draft = ref('')
const drafts: Record<Subject, string> = { chinese: '', math: '', english: '' }
const input = ref<HTMLTextAreaElement>()
const sidebar = ref<HTMLElement>()
const sidebarToggle = ref<HTMLButtonElement>()
const sidebarCollapse = ref<HTMLButtonElement>()
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
// 每门学科保留自己的草稿，发送期间暂停切换，避免把回复展示到另一学科。
function changeSubject(next: Subject) {
  if (next === subject.value || isPending.value || isLoading.value) return
  drafts[subject.value] = draft.value
  subject.value = next
  draft.value = drafts[next]
  query.value = ''
  copiedId.value = ''; copyError.value = ''
  followLatest.value = true
  try { localStorage.setItem('songjian-subject', next) } catch { /* 隐私模式可能禁用存储，当前学科仍保留在页面内存中。 */ }
  if (window.innerWidth <= 760) sidebarOpen.value = false
  nextTick(resizeInput)
}

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
// 只有发送成功才清空对应草稿；失败或取消时允许用户继续编辑重发。
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
// 中文输入法确认候选字时不能触发发送；Shift+Enter 保留换行。
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
// 用户主动向上阅读时停止跟随，靠近底部后才恢复自动滚动。
function updateScrollPosition() {
  const list = messageList.value
  if (list) followLatest.value = list.scrollHeight - list.scrollTop - list.clientHeight < 80
}
function closeSidebar() {
  sidebarOpen.value = false
  nextTick(() => sidebarToggle.value?.focus())
}
function openSidebar() {
  sidebarOpen.value = true
  if (window.innerWidth <= 760) nextTick(() => sidebarCollapse.value?.focus())
}
function handleEscape(event: KeyboardEvent) {
  if (!sidebarOpen.value || window.innerWidth > 760) return
  if (event.key === 'Escape') { closeSidebar(); return }
  if (event.key === 'Tab') {
    const controls = sidebar.value?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary')
    const visible = [...(controls ?? [])].filter(element => element.getClientRects().length > 0)
    const first = visible[0]
    const last = visible[visible.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
}
onMounted(() => window.addEventListener('keydown', handleEscape))
watch(
  () => [activeId.value, activeSession.value?.messages.map((message) => message.content).join('')],
  async () => {
    await nextTick()
    const list = messageList.value
    if (list && followLatest.value) {
      list.scrollTop = activeSession.value?.messages.length ? list.scrollHeight : 0
    }
  },
  { flush: 'post', immediate: true },
)
onBeforeUnmount(() => {
  clearTimeout(copyTimer)
  window.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <div class="chat-app" :data-subject="subject" :class="{ 'sidebar-hidden': !sidebarOpen }" :inert="workflowOpen">
    <InteractionEffects />
    <button
      v-if="sidebarOpen"
      class="sidebar-backdrop"
      aria-label="关闭侧边栏"
      @click="closeSidebar"
    ></button>
    <aside ref="sidebar" class="sidebar" :class="{ 'is-open': sidebarOpen }" :inert="!sidebarOpen" :aria-hidden="!sidebarOpen" aria-label="聊天会话">
      <div class="sidebar-brand">
        <a class="brand" href="#" aria-label="回到新对话" @click.prevent="newChat"
          ><span class="brand-mark"><AppIcon name="leaf" /></span> 松间<span class="brand-en"
            >SONGJIAN</span
          ></a
        >
        <button
          class="icon-button collapse-button"
          ref="sidebarCollapse"
          aria-label="收起侧边栏"
          title="收起侧边栏"
          @click="closeSidebar"
        >
          <AppIcon name="panel" />
        </button>
      </div>
      <div class="sidebar-subject"><span>{{ activeSubject.english }}</span><strong>{{ activeSubject.discipline }}</strong><p>{{ activeSubject.sideNote }}</p></div>
      <button class="new-chat-button" :disabled="isLoading || isPending" @click="newChat">
        <AppIcon name="plus" /> 开启一段新探索
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
        <div v-if="!filteredSessions.length" class="search-empty"><AppIcon :name="query ? 'search' : activeSubject.icon" /><p>{{ query ? '没有找到相关对话' : activeSubject.emptyNote }}</p></div>
      </nav>
      <button v-if="!isDemo && isAdmin" class="workflow-entry" type="button" @click="openWorkflow()"><AppIcon name="code" /><span>工作流工作台<small>流程定义 · 运行观测</small></span><span class="workflow-admin">ADMIN</span></button>
      <McpHub v-if="!isDemo && isAdmin" />
      <details v-if="isDemo" class="demo-tools"><summary><AppIcon name="code" /><span>探索工具</span><span class="demo-tools-label">本地演示</span><AppIcon name="chevron" /></summary><div><p>这里先专注体验学科对话与解题思路。</p><p>演示回答由本地示例生成，未连接模型与工具服务。</p></div></details>
      <div class="sidebar-bottom">
        <div class="local-note">
          <AppIcon name="lock" /><span>给思考一点自己的空间<small>{{ isDemo ? '演示对话仅保存在当前浏览器' : '对话保存在后端本地' }}</small></span>
        </div>
        <div class="profile">
          <span class="avatar">学</span>
          <div><strong>{{ auth?.user.value?.username ?? '保持好奇，慢慢生长' }}</strong><span>{{ auth?.user.value?.role === 'admin' ? '管理员' : '你的专属学习空间' }}</span></div>
          <button v-if="auth" class="account-logout" type="button" :disabled="auth.busy.value" @click="auth.logout">退出</button>
          <span v-else class="profile-dot"></span>
        </div>
        <p v-if="auth?.error.value" class="notice" role="alert">{{ auth.error.value }}</p>
      </div>
    </aside>

    <main class="main-panel">
      <SubjectAtmosphere :subject="subject" />
      <header class="topbar">
        <div class="topbar-left">
          <button
            v-if="!sidebarOpen"
            ref="sidebarToggle"
            class="icon-button"
            aria-label="展开侧边栏"
            :aria-expanded="sidebarOpen"
            @click="openSidebar"
          >
            <AppIcon name="panel" /></button
          ><span class="assistant-name">{{ activeSubject.name }} <span>{{ activeSubject.discipline }}</span></span>
        </div>
        <div class="topbar-right"><span v-if="isDemo" class="demo-badge"><span></span> 演示空间</span><SubjectSwitch :model-value="subject" :disabled="isPending || isLoading" @update:model-value="changeSubject" /></div>
      </header>
      <span class="sr-only" role="status" aria-live="polite">当前为{{ activeSubject.discipline }}</span>

      <div
        ref="messageList"
        class="conversation-scroll"
        :class="{ 'is-empty': !activeSession?.messages.length }"
        @scroll="updateScrollPosition"
      >
        <section v-if="!activeSession?.messages.length" :key="subject" class="welcome">
          <div class="welcome-eyebrow"><span></span>{{ activeSubject.discipline }}<span></span></div>
          <div class="welcome-symbol"><AppIcon :name="activeSubject.icon" /><span class="symbol-orbit"></span><i></i></div>
          <p class="welcome-overline" :lang="subject === 'english' ? 'en' : 'zh-CN'">{{ activeSubject.eyebrow }}</p>
          <h1>{{ activeSubject.title }}<em>{{ activeSubject.titleAccent }}</em></h1>
          <p class="welcome-description">
            {{ activeSubject.description }}<br />{{ activeSubject.subdescription }}
          </p>
          <div class="suggestion-heading"><span>从这里，开始探索</span><span>{{ activeSubject.exploration }} <AppIcon name="arrow-up-right" /></span></div>
          <div class="suggestion-grid">
            <button
              v-for="(suggestion, index) in activeSubject.suggestions"
              :key="suggestion.title"
              class="suggestion-card"
              :disabled="isLoading || isPending"
              @click="submit(suggestion.text)"
            >
              <span class="suggestion-icon"
                ><AppIcon :name="suggestion.icon"
              /></span>
              <span class="suggestion-copy"><strong>{{ suggestion.title }}</strong><span class="suggestion-text">{{ suggestion.subtitle }}</span></span>
              <span class="suggestion-index">0{{ index + 1 }}</span><AppIcon class="suggestion-arrow" name="arrow-up-right" />
            </button>
          </div>
          <p class="welcome-footnote" :lang="subject === 'english' ? 'en' : 'zh-CN'"><span></span> {{ activeSubject.motto }} <span></span></p>
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
              <span class="assistant-avatar"><AppIcon :name="activeSubject.icon" /></span>
              <div class="assistant-body">
                <div class="message-author">{{ activeSubject.name }} <span>{{ activeSubject.discipline }}</span></div>
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
                  ><span v-if="copiedId === message.id">已复制</span>
                </div>
              </div>
            </template>
            <template v-else
              ><div class="user-bubble">{{ message.content }}</div></template
            >
          </article>
        </section>
        <RunTimeline v-if="activeSession && !isDemo && isAdmin" :session-id="activeSession.id" :updated-at="activeSession.updatedAt" :pending="activeSession.sessionStatus === 'pending'" @open-canvas="openWorkflow" />
      </div>

      <footer class="composer-area">
        <p v-if="storageNotice" class="notice" role="status">{{ storageNotice }}</p>
        <p v-if="activeSession" class="notice session-status" :data-status="activeSession.sessionStatus" role="status">
          {{ isTyping ? '正在显示回复' : statusLabels[activeSession.sessionStatus] }}
        </p>
        <p v-if="activeSession?.sessionStatus === 'failure'" class="notice session-failure" role="alert">
          {{ activeSession.sessionError?.message || '模型接口未正确返回，请稍后重试。' }}
          <span v-if="activeSession.sessionError">（{{ activeSession.sessionError.code }} / {{ activeSession.sessionError.httpStatusCode }}）</span>
        </p>
        <p v-if="apiError" class="notice" role="alert">
          {{ apiError }}
          <button type="button" :disabled="isLoading || isPending" @click="loadSessions">重新加载</button>
        </p>
        <p v-if="isPending" class="notice" role="status">{{ isTyping ? '点击停止按钮可立即显示完整回复。' : '正在处理，请稍候…' }}</p>
        <p v-if="copyError" class="notice" role="status">
          {{ copyError }}
        </p>
        <form class="composer" @submit.prevent="submit()">
          <textarea
            ref="input"
            v-model="draft"
            aria-label="输入消息"
            :placeholder="activeSubject.placeholder"
            rows="1"
            maxlength="12000"
            @input="resizeInput"
            @keydown="handleKeydown"
          ></textarea>
          <div class="composer-toolbar">
            <span class="composer-mode"><AppIcon :name="activeSubject.icon" /> {{ activeSubject.mode }}</span>
            <div class="composer-controls">
              <span class="keyboard-hint">Shift + Enter 换行</span
              ><button
                v-if="isSending"
                type="button"
                class="send-button stop-button"
                :aria-label="isTyping ? '显示完整回复' : '停止生成'"
                :title="isTyping ? '显示完整回复' : '停止生成'"
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
          {{ isDemo ? '本地演示 · 回答为预设示例' : 'AI 生成内容，请核实重要信息' }} <span>·</span> {{ activeSubject.motto }}
        </p>
      </footer>
    </main>
  </div>
  <WorkflowWorkbench v-if="workflowOpen && isAdmin" :subject="subject" :session-id="activeSession?.id" :initial-run-id="workflowRunId" @close="workflowOpen = false" />
</template>

<style scoped>
.workflow-entry { display:flex;align-items:center;gap:10px;width:100%;padding:14px 18px;border:0;border-top:1px solid #e4e9de;background:transparent;color:#718265;text-align:left;cursor:pointer;flex-shrink:0; }
.workflow-entry:hover { background:#f0f4e9; }.workflow-entry>svg { width:17px;height:17px; }.workflow-entry>span { font-size:11px; }.workflow-entry small { display:block;font-size:9px;color:#9aa78f;margin-top:3px; }.workflow-entry .workflow-admin { margin-left:auto;font-size:8px;letter-spacing:1px;padding:3px 5px;border:1px solid #dfe8d6;border-radius:4px;color:#99aa89; }
</style>
