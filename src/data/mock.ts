import type { ChatSession } from '../types/chat'

export function createMockSessions(): ChatSession[] {
  const now = Date.now()
  return [
    { id: 'welcome', title: '新对话', updatedAt: now, messages: [] },
    {
      id: 'typescript',
      title: '把 TypeScript 泛型讲简单一点',
      updatedAt: now - 60000,
      messages: [
        {
          id: 'ts-user',
          role: 'user',
          content: '泛型到底有什么用？能给一个简单的例子吗？',
        },
        {
          id: 'ts-assistant',
          role: 'assistant',
          content:
            '可以把泛型想象成一个“保留类型信息的盒子”。你放进什么类型，拿出来的就还是什么类型。\n\n例如，这个函数原样返回传入的值：\n\n```typescript\nfunction identity<T>(value: T): T {\n  return value\n}\n\nconst name = identity("张三") // string\nconst age = identity(18)      // number\n```\n\nT 是一个类型参数。调用时，TypeScript 会根据你的参数推断 T，所以你不用为字符串和数字各写一遍函数。\n\n和 any 不同，泛型保留了输入与输出之间的类型关系。',
          status: 'complete',
        },
      ],
    },
    {
      id: 'weekend',
      title: '一个不赶时间的周末计划',
      updatedAt: now - 86400000,
      messages: [
        {
          id: 'weekend-user',
          role: 'user',
          content: '这个周末想放松一下，有什么建议？',
        },
        {
          id: 'weekend-assistant',
          role: 'assistant',
          content:
            '那就给自己一个不赶时间的周末吧。☀️\n\n周六上午：睡到自然醒，认真吃一顿早餐。带一本读到一半的书，去附近的咖啡馆坐坐。\n\n周六下午：在公园散步，试着拍下三件平时不会注意到的小事。\n\n周日：留给一件你一直想做的小事——做一道新菜、整理一个角落，或者看一部收藏很久的电影。\n\n不用把每一分钟填满，留白也是计划的一部分。',
          status: 'complete',
        },
      ],
    },
    {
      id: 'story',
      title: '如果月亮开了一家便利店',
      updatedAt: now - 172800000,
      messages: [
        {
          id: 'story-user',
          role: 'user',
          content: '以月亮上的便利店为主题，写一个故事开头。',
        },
        {
          id: 'story-assistant',
          role: 'assistant',
          content:
            '月亮上的便利店，每晚十点准时亮灯。\n\n店里不卖饭团，也不卖汽水。货架上整齐摆着“没来得及说的晚安”“小时候夏天的风”和“再试一次的勇气”。\n\n阿夏是新来的夜班店员。上岗第一天，店长只交代了一件事：\n\n“如果有人来买明天，记得问问他，今天过得怎么样。”',
          status: 'complete',
        },
      ],
    },
  ]
}

export function getMockReply(prompt: string): string {
  if (/泛型|typescript|\bts\b|接口|编程/i.test(prompt))
    return '我们用一个小例子来理解 TypeScript 泛型。\n\n想象你有一个盒子：放进去的是字符串，取出来的也应该是字符串。泛型就是帮你记住这层关系。\n\n```typescript\nfunction first<T>(items: T[]): T | undefined {\n  return items[0]\n}\n\nconst name = first(["张三", "李四"]) // string | undefined\nconst number = first([1, 2, 3])      // number | undefined\n```\n\n这里的 T 代表调用时确定的类型。一个函数就可以处理不同类型的数组，同时保留类型检查。\n\n返回类型中还有 undefined，是因为空数组可能没有第一个元素。\n\n你可以试着把它改成“取最后一个元素”，看看该怎么写。'
  if (/故事|灵感|写作|月亮/.test(prompt))
    return '给你一个有一点奇幻的开头：\n\n城里有一家只在雨天开门的旧书店。\n\n书店里的书没有结局。老板说，结局要拿回家，自己过出来。\n\n那天，林小满躲雨时随手翻开一本蓝色封面的书。第一页只有一句话：\n\n“下午三点十七分，你会遇见一个忘记带伞的人。请不要把伞借给他。”\n\n她看了一眼时间。三点十六分。\n\n——你希望接下来偏温暖治愈，还是带一点悬疑？'
  if (/周末|计划|放松|日常|旅行/.test(prompt))
    return '一起安排一个有留白的周末吧。🌿\n\n01 / 慢慢开始\n睡到自然醒，给自己做一份喜欢的早餐。先别急着刷手机，听完一首歌。\n\n02 / 出门走走\n选一条没走过的小路，逛一家小店，或者去公园晒晒太阳。目的地不用很远。\n\n03 / 留一点时间给自己\n看一部收藏很久的电影，读几页书，或试着做一道新菜。只选一件就好。\n\n04 / 轻轻收尾\n周日晚上整理一下桌面，写下下周最想完成的一件小事。\n\n这份计划可以随时更改。休息的目的，是让你舒服，而不是完成另一张任务清单。'
  if (/冷知识|有趣|知识/.test(prompt))
    return '分享一个和自然有关的小知识：章鱼有三颗心脏。🐙\n\n其中两颗主要把血液送往鳃，另一颗负责将血液送往身体其他部分。\n\n它们的血液还含有以铜为基础的血蓝蛋白，因此呈现蓝色。\n\n海洋里的生命，有时候比科幻故事还让人意外。'
  if (/你好|hi|hello/i.test(prompt))
    return '你好呀，很高兴在这里遇见你。🌿\n\n这里可以放下严肃的大问题，也可以装下一闪而过的小想法。\n\n想学点东西、找点灵感，或者单纯聊聊今天，都可以。你想从哪里开始？'
  return `收到你的想法了：“${prompt.length > 100 ? `${prompt.slice(0, 100)}…` : prompt}”\n\n我们可以从三个小问题开始：\n\n• 你最想探索的是其中哪一部分？\n• 有没有一个具体的例子或场景？\n• 你希望最后得到一个建议、一份计划，还是新的灵感？\n\n把大问题拆成小问题，往往就更容易开始了。\n\n这是演示回复；接入真实模型后，我就能围绕你的问题继续展开。`
}
