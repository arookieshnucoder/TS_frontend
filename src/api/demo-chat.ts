import type { Ref } from 'vue'
import { chatApi, type SessionDto } from './chat'
import type { Subject } from '../config/subjects'

const storagePrefix = 'songjian.demo.v1.'

function exampleReply(subject: Subject, content: string): string {
  const note = '> 本地演示 · 以下是预设学习示例，未调用 AI 模型。\n\n'
  if (subject === 'math') {
    if (content.includes('x² - 5x + 6') || content.includes('x²−5x+6')) {
      return note + '### 把方程变成两个一次式\n\n由 $x^2-5x+6=(x-2)(x-3)$，得到：\n\n$$x=2\\quad\\text{或}\\quad x=3$$\n\n**检验**：$4-10+6=0$，$9-15+6=0$，两根都成立。\n\n小提示：寻找两个乘积为 6、和为 −5 的数，能帮助我们完成因式分解。'
    }
    if (content.includes('x² - 4x + 1')) {
      return note + '### 用配方看见函数的形状\n\n$$y=x^2-4x+1=(x-2)^2-3$$\n\n所以顶点是 **(2, −3)**，对称轴是 **x = 2**，开口向上。\n\n当 $x=2$ 时平方项为 0，函数取得最小值 −3。试试再找一对关于对称轴对称的点。'
    }
    if (content.includes('红球') && content.includes('白球')) {
      return note + '### 不放回：第二次的总数变了\n\n以“2 个红球、1 个白球，不放回摸两次”为例：\n\n第一次摸到红球的概率为 $\\frac{2}{3}$；第二次在第一次为红球的条件下，摸到红球的概率为 $\\frac{1}{2}$。\n\n$$P=\\frac{2}{3}\\times\\frac{1}{2}=\\frac{1}{3}$$\n\n注意：两次摸球不独立，第二次要使用剩余球数。'
    }
    if (content.includes('直角三角形') && content.includes('3') && content.includes('4')) {
      return note + '### 先讨论：谁是斜边？\n\n以直角三角形两边长为 3 和 4 为例：\n\n1. 若 3、4 都是直角边，第三边为 $\\sqrt{3^2+4^2}=5$。\n2. 若 4 是斜边，第三边为 $\\sqrt{4^2-3^2}=\\sqrt{7}$。\n3. 3 不可能是斜边，因为它比已知边 4 短。\n\n因此所有可能值为 **5 或 $\\sqrt{7}$**。'
    }
    return note + '### 让思路一步步清晰\n\n这是数学 Agent 的界面演示，暂时不能求解任意题目。你可以点击“解一个方程”等示例，体验公式排版与逐字回复。\n\n真正解题时，我们会从这三步开始：\n\n1. **整理条件**：写清已知量、单位与要求的量。\n2. **寻找关系**：选择等式、图形或分类讨论。\n3. **检查结果**：代回条件，核验范围与特殊情况。'
  }
  if (content.includes('定风波') || content.includes('莫听穿林打叶声')) {
    return note + '### 风雨中的一份从容\n\n苏轼的《定风波·莫听穿林打叶声》，从途中遇雨写起，把生活中的风雨与人生的起伏相连。\n\n**上阕看行动**：同行者避雨，词人却吟啸徐行。“竹杖芒鞋轻胜马”，用轻快的步履写出内心的舒展。\n\n**下阕看心境**：“回首向来萧瑟处，归去，也无风雨也无晴。”风雨与晴日都成为可以坦然面对的经历。\n\n赏析时可沿着 **途中遇雨 → 从容前行 → 回首释然** 的线索，理解词人旷达的情怀。'
  }
  if (content.includes('陋室铭')) {
    return note + '### 室虽陋，人有德\n\n刘禹锡在《陋室铭》中以“惟吾德馨”点明主旨：居室的价值来自主人的品德，而非外在的华美。\n\n**重点字词**：“馨”本指香气，这里指品德高尚；“鸿儒”是博学的人；“白丁”在本文中指没有学问的人。\n\n“谈笑有鸿儒，往来无白丁”：**与我谈笑的是博学的人，交往的没有缺少学问的人。** 此句从交往之雅表现主人志趣。\n\n文章借写居室来表达志向，这种写法叫作 **托物言志**。可结合环境、交往和生活三方面寻找证据。'
  }
  if (content.includes('盼望着') && content.includes('春天')) {
    return note + '### 让春天有了脚步\n\n朱自清《春》的这句开头，用两种表达把期待写得可感：\n\n1. **反复**：“盼望着，盼望着”，反复吟咏，突出盼春的急切与欣喜，形成轻快的节奏。\n2. **拟人**：“春天的脚步近了”，赋予春天人的动作，让抽象的季节变化变得生动、亲切。\n\n“东风来了”则提示春的到来。作答时把 **具体词句、修辞名称、情感效果** 连在一起，会比只列术语更完整。'
  }
  if (content.includes('雨后校园')) {
    return note + '### 雨停以后，校园在悄悄说话\n\n先别急着写“校园真美”，沿着一条散步的路线收集细节：\n\n- **看**：叶尖的水珠、操场上倒映天空的水洼。\n- **听**：檐下滴水、鞋底踏过湿地的轻响。\n- **闻与触**：草木的清香、拂过脸颊的凉风。\n\n可以按“走出教室 → 经过花坛 → 来到操场”的顺序展开，再用一件真实发生的小事串起感受。\n\n**开头示例**：雨刚停，走廊的栏杆还挂着水珠。我推开门，风里多了一点泥土的气息。\n\n让景物与自己的心情相照应，结尾就能自然落在你独有的发现上。'
  }
  if (content.includes('春望')) {
    return note + '### 山河仍在，春色有情\n\n“国破山河在，城春草木深。”杜甫把残破的国都与依旧的山河并置，让草木的繁盛映出城池的荒凉。\n\n**情景交融**是阅读的切口：“感时花溅泪，恨别鸟惊心”，花鸟本来可娱人，在诗人的眼中却承载着忧时伤别。\n\n试着从 **眼前之景 → 内心之情 → 时代背景** 三层组织你的赏析，避免只罗列修辞名称。'
  }
  if (content.includes('背影')) {
    return note + '### 从一个动作，读懂一份牵挂\n\n读《背影》时，可以留意父亲买橘子时的动作描写。“攀”“缩”“倾”等动词，让年迈父亲行动的不易变得具体。\n\n**可用的赏析思路**：先指出具体动作，再说明动作的困难，最后联系父爱与“我”的感动。\n\n写作时也可以借鉴这种方法：不直接说“他很关心我”，而是写一个能让读者看见的细节。'
  }
  if (content.includes('文言') || content.includes('论语')) {
    return note + '### 先读通，再读懂\n\n以《论语》“学而时习之，不亦说乎”为例：“时”可理解为按时，“习”是温习、实践，“说”通“悦”，是愉快。\n\n译文：**学习后按时温习，不也是令人愉快的吗？**\n\n阅读文言文时，先圈出实词、虚词与特殊用法，再结合上下文理顺句意。这里只展示预设例句，不是对任意文言材料的翻译。'
  }
  if (content.includes('作文') || content.includes('开头')) {
    return note + '### 把“大道理”写成“小画面”\n\n以“成长”为题，可以从一处具体的生活场景进入：\n\n> 那把旧伞靠在门边，伞骨微微弯着。雨落下来时，我才发现，原来自己已经能够把伞举过母亲的头顶。\n\n这个开头用 **旧伞、雨、身高变化** 连接成长与亲情。接下来补上真正属于你的经历，文字才会有自己的温度。'
  }
  return note + '### 在字里行间，发现自己的理解\n\n这是语文 Agent 的界面演示，暂时不能分析任意文章。点击诗词、阅读或写作示例，可以体验不同的学习场景。\n\n我们可以沿着这样的线索阅读：\n\n1. **读见文字**：抓住人物、意象和关键句。\n2. **读懂表达**：结合语境解释写法的作用。\n3. **写出理解**：用原文证据支撑自己的判断。'
}

export function createDemoChatApi(subject: Ref<Subject>, onStorageError: () => void): typeof chatApi {
  const memory = new Map<Subject, SessionDto[]>()
  const copy = <T>(value: T): T => structuredClone(value)
  function read(key: Subject): SessionDto[] {
    if (memory.has(key)) return memory.get(key)!
    let sessions: SessionDto[] = []
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storagePrefix + key) ?? '[]')
      if (Array.isArray(saved)) sessions = saved.filter((value): value is SessionDto =>
        value && typeof value.id === 'string' && typeof value.title === 'string' &&
        typeof value.updatedAt === 'string' && !Number.isNaN(Date.parse(value.updatedAt)) &&
        Array.isArray(value.messages) && value.messages.every((message: { id?: unknown; role?: unknown; content?: unknown }) =>
          message && typeof message.id === 'string' && (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string'),
      ).map(value => ({ ...value, sessionStatus: 'finished', sessionError: null }))
    } catch { onStorageError() }
    memory.set(key, sessions)
    return sessions
  }
  function save(key: Subject) {
    try { localStorage.setItem(storagePrefix + key, JSON.stringify(read(key))) }
    catch { onStorageError() }
  }
  function find(key: Subject, id: string) {
    const session = read(key).find(item => item.id === id)
    if (!session) throw new Error('这段演示对话已不存在，请开启新对话。')
    return session
  }
  return {
    async list() { return copy(read(subject.value)) },
    async getById(id) { return copy(find(subject.value, id)) },
    async create(title) {
      const key = subject.value
      const now = new Date().toISOString()
      const session: SessionDto = { id: `demo-${crypto.randomUUID()}`, title, createdAt: now, updatedAt: now,
        modelRequestId: null, messages: [], sessionStatus: 'finished', sessionError: null }
      read(key).unshift(session)
      save(key)
      return copy(session)
    },
    async send(id, content, signal) {
      signal.throwIfAborted()
      const key = subject.value
      const session = find(key, id)
      const answer = exampleReply(key, content)
      session.messages.push({ id: crypto.randomUUID(), role: 'user', content },
        { id: crypto.randomUUID(), role: 'assistant', content: answer })
      if (session.messages.length === 2) session.title = content.slice(0, 22)
      session.updatedAt = new Date().toISOString()
      save(key)
      return copy(session)
    },
  }
}
