# 学科主题验收

在 `frontend` 中运行：

```sh
node --test --test-timeout=30000 tests/theme-ui.test.mjs tests/chat-ui.test.mjs
npm test
npm run build
```

`theme-ui.test.mjs` 挂载真实 Vue 页面，并禁止所有 `fetch` 请求，验证默认演示在离线环境独立工作：

- 学科按钮的可访问名称、选中状态，以及语文/数学欢迎内容与输入提示。
- 两学科草稿和历史隔离；切科重置搜索；刷新恢复；题卡发送保留未提交草稿。
- 题卡与演示回答对应；Enter 发送、Shift + Enter 和输入法确认不误发；生成时禁止切科；停止后显示完整回复。
- 浏览器存储不可用时明确提示，并继续在内存中保存当前页面的分科对话。
- 移动端关闭侧栏移出键盘导航，Escape 关闭并恢复展开按钮焦点。
- 鼠标跟随、点击反馈、快速点击数量上限和自动回收；动态切换低动效或触屏偏好；卸载时移除全局及媒体查询监听。

原有 `chat-ui.test.mjs` 继续在后端模式模拟 HTTP 成功和断网，验证历史、回复、错误状态及失败后草稿保留。`npm test` 还包含本地模拟模型的后端 HTTP 联调，不需要真实模型 Key。

Happy DOM 不提供真实排版、原生 Tab 导航或最终 CSS 动画渲染。浏览器验收应另行检查两学科在桌面、390px 和 320px 窗口下无横向溢出，右上角切换和输入框可用；动画背景可见，鼠标皮肤与点击反馈对应主题；触屏目标可点击，键盘焦点清楚；系统低动效偏好关闭背景和交互动画。

## 本次验收记录（2026-10-17）

- 制作者与评测者完成两轮行为审查，并按真实浏览器发现修复了欢迎页裁切、辅助文字偏小和开发浮标遮挡。
- `npm test`：17 项全部通过，覆盖后端 HTTP/MCP 兼容联调、本地演示、八张题卡、双科隔离、存储回退、效果清理与安全内容渲染；未配置真实模型 Key。
- `npm run build`：类型检查与生产构建通过。
- 真实浏览器：1280×720、1280×600、390×844、320×720 均无横向溢出，输入区始终可用；窄屏欢迎区可滚动到全部题卡。
- 键盘实测：Enter 切科、Tab 到题卡时显示焦点环，Escape 关闭移动侧栏并返回展开按钮。
- 动画实测：数学网格 `grid-drift` 为 running，前后采样 transform 持续变化；数学原生 cursor 为本地 `cursor-coordinate.svg`。页面控制台无 error/warn。
- 动态低动效偏好、粗指针降级、触屏反馈与卸载监听清理由组件测试覆盖；未修改操作系统偏好或网络配置。

截图：

- [语文桌面](artifacts/chinese-desktop.jpg)
- [数学桌面](artifacts/math-desktop.jpg)
- [数学公式回复](artifacts/math-reply-desktop.jpg)
- [390px 语文](artifacts/chinese-mobile-390.jpg)
- [320px 数学，下滚展示完整题卡](artifacts/math-mobile-320.jpg)
