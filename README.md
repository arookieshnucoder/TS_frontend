# 松间 Chat

Vue 3 + TypeScript + Vite。侧边栏和会话上下文都来自后端 JSON。

## 启动

先按 backend/README.md 启动后端，再运行：

```sh
npm install
npm run dev
```

开发代理默认 /api → http://localhost:8080。其他端口通过 API_PROXY_TARGET 配置。前端不保存模型 Key，不调用 /internal 接口。

## 消息状态

- 发送时显示 pending（生成中）。
- 普通 REST 请求成功返回 HTTP 200，使用后端 DTO 显示 finished 和回复。
- 模型失败返回 HTTP 400，使用响应中的 DTO 显示 failure 和错误信息，保留草稿。
- 已移除 NDJSON 解析和 generating 状态。
- 网络中断未收到 HTTP 响应时显示连接错误，不编造服务端状态码。
- 停止按钮取消请求。若后端已完成保存，以刷新后的结果为准。

支持会话搜索、切换、刷新恢复、Enter 发送、Shift+Enter 换行、复制和代码块展示。

## 全量测试与构建

```sh
npm test
npm run build
```

包含真实后端 HTTP 联调、REST 200/400 客户端测试和页面组件交互测试。build 同时执行类型检查。

会话标题由后端模型在前五个成功轮次内生成或微调，随后冻结；前端创建会话时只发送临时标题“新对话”。模型侧记忆摘要和工具调用不会替换用户看到的历史。构建设置 `emptyOutDir: false`，旧构建产物按仓库规则保留供人工清理。

Docker 镜像由 `Dockerfile` 分阶段构建，通过 Nginx 在 8080 端口提供页面并将 `/api/` 转发到 Compose 中的 backend。完整部署入口位于同级 backend 仓库：在项目根目录执行 `./backend/scripts/deploy.ps1`。各仓库 CI 自动测试和构建，成对镜像发布与 Windows 自动部署使用 backend 的 **Release full stack** 工作流，详见 `../backend/docs/deployment.md`。
