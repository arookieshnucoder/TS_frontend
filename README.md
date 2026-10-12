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

联调测试要求同级 `../backend` 已安装依赖，并支持 `agentModel` 注入和 `AgentHarness`。测试注入模拟模型，不需要 `LLM_API_KEY`。前端 CI 默认固定使用兼容的后端提交 `2635abec3f1c43e7ba2b9806b6ee6aec327e1502`，避免前后端独立推送时，浮动分支暂时处于不兼容状态。升级联调后端时同步更新 `.github/workflows/ci.yml` 中的提交；如通过仓库变量 `BACKEND_REF` 覆盖，请同样指定兼容的提交 SHA。`BACKEND_REPOSITORY` 可覆盖后端仓库。CI 会打印实际测试的前后端提交，便于定位版本错配。

会话标题由后端模型在前五个成功轮次内生成或微调，随后冻结；前端创建会话时只发送临时标题“新对话”。模型侧记忆摘要和工具调用不会替换用户看到的历史。构建设置 `emptyOutDir: false`，旧构建产物按仓库规则保留供人工清理。

Docker 镜像由 `Dockerfile` 分阶段构建，通过 Nginx 在 8080 端口提供页面并将 `/api/` 转发到 Compose 中的 backend。完整部署入口位于同级 backend 仓库：在项目根目录执行 `./backend/scripts/deploy.ps1`。各仓库 CI 自动测试和构建，成对镜像发布与 Windows 自动部署使用 backend 的 **Release full stack** 工作流，详见 `../backend/docs/deployment.md`。
# MCP Hub

侧边栏的 MCP Hub 默认收起，支持表单、JSON 和文件导入、启用开关、连接测试与工具目录。允许修改数据需要单独勾选；远程管理令牌只保存在页面内存中。操作异常会显示错误，开关在后端保存成功后更新。

后端接入及自建 MCP 教程位于同工作区的 `backend/docs/MCP_GUIDE.md`。连接方式支持 stdio、Streamable HTTP 和旧 SSE。stdio 程序在后端主机执行，用户浏览器无需安装工具程序。
