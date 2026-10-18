# 松间

语文「知墨」、数学「序理」与英语「言境」的学习空间。

## 界面展示

**语文 · 知墨**

![语文界面](asset/chinese-desktop.jpg)

**数学 · 序理**

![数学界面](asset/math-desktop.jpg)

**英语 · 言境**

![英语界面](asset/english-desktop.jpg)

## 启动

需要 Node.js 24.12+。默认使用本地演示，无需 API Key。

`VITE_CHAT_MODE=demo` 使用本地示例，`VITE_CHAT_MODE=backend` 连接真实后端；未设置时为 `demo`，其他值会报错。真实请求失败时会展示错误，不会切换为演示数据。

代码入口：`App.vue` 负责页面交互，`useAgentChat` 选择数据来源，`useChat` 管理会话与逐字展示，`types/chat.ts` 集中定义响应和界面类型。运行记录与 MCP 管理接口分别位于 `api/runs.ts`、`api/mcp.ts`。

在 `frontend` 目录下运行：

```sh
npm install
npm run dev
```

## 技术栈

Vue 3 · TypeScript · Vite · KaTeX
