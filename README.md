<div align="center">

# 🎯 群面模拟器

**专业、高压、实战。模拟互联网大厂群面环境。**

[![React](https://img.shields.io/badge/React-19.2.3-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.0-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1.18-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

[在线体验](#) • [功能特性](#-核心功能) • [技术架构](#-技术架构) • [快速开始](#-快速开始)

</div>

---

## 📸 产品首页

<div align="center">

![产品首页](./screenshots/homepage.png)

*如果图片未显示，请将你的产品首页截图保存为 `screenshots/homepage.png`*

</div>

---

## 📖 产品介绍

**群面模拟器** 是一款基于 AI 驱动的无领导小组讨论面试模拟平台，专为求职者设计，帮助他们在真实的群面环境中练习和提升面试技巧。

### 🎯 产品定位

- **目标用户**：准备校招群面面试的求职者
- **核心价值**：提供接近真实的群面环境，让求职者在实战中提升面试能力
- **差异化优势**：AI 驱动的多角色互动 + 实时反馈分析

### ✨ 核心功能

#### 1. 🧠 AI 智能题目生成
- 根据公司和岗位自动生成高质量群面题目
- 包含背景、任务、要求、时间分配等完整要素
- 模拟真实大厂面试题目风格

#### 2. 👥 多角色 AI 讨论伙伴
系统内置 3 个不同性格的 AI 角色，模拟真实群面场景。

#### 3. 💬 实时讨论模拟
- 支持文本输入和语音识别
- 动态讨论阶段识别（开局框架 → 深入讨论 → 总结引导 → 收尾补充）
- 智能发言平衡机制，避免 AI 角色过度发言
- 抢话检测和高压场景模拟

#### 4. 📊 AI 智能反馈分析
面试结束后，系统会生成详细的评估报告：

- **发言时机分析**：评估切入时机的精准度
- **话语权占比**：统计发言频率和占比
- **结构贡献评估**：分析对讨论框架的贡献
- **抗压能力评价**：评估在冲突和高压下的表现
- **综合评分**：0-100 分的整体表现评分
- **改进建议**：3-5 条具体的优化建议

---

## 🏗️ 技术架构

### 前端技术栈

```
┌─────────────────────────────────────────────────────────┐
│                     前端应用层                            │
├─────────────────────────────────────────────────────────┤
│  React 19.2.3  │  TypeScript 5.8.2  │  Vite 6.2.0      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    UI 组件层                              │
├─────────────────────────────────────────────────────────┤
│  • SetupForm (题目设置)                                   │
│  • DiscussionPanel (讨论面板)                            │
│  • FeedbackReport (反馈报告)                              │
│  • CharacterCard (角色卡片)                               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   样式系统                                │
├─────────────────────────────────────────────────────────┤
│  Tailwind CSS 4.1.18  │  PostCSS  │  Autoprefixer      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   服务层                                  │
├─────────────────────────────────────────────────────────┤
│  geminiService.ts (AI 服务封装)                           │
│  • generateTopic() - 生成题目                            │
│  • generateAIReply() - 生成 AI 回复                      │
│  • generateFeedback() - 生成反馈报告                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   AI 服务层                               │
├─────────────────────────────────────────────────────────┤
│  DeepSeek API (deepseek-chat)                           │
│  • Chat Completions API                                 │
│  • 模型: deepseek-chat                                  │
│  • 温度参数: 0.3-0.8 (根据场景调整)                      │
└─────────────────────────────────────────────────────────┘
```

### 技术选型说明

| 技术 | 版本 | 用途 | 选择理由 |
|------|------|------|----------|
| **React** | 19.2.3 | UI 框架 | 成熟的组件化开发，丰富的生态系统 |
| **TypeScript** | 5.8.2 | 类型系统 | 提供类型安全，提升代码可维护性 |
| **Vite** | 6.2.0 | 构建工具 | 极速的开发体验，快速的 HMR |
| **Tailwind CSS** | 4.1.18 | CSS 框架 | 原子化 CSS，快速构建现代 UI |
| **DeepSeek API** | latest | AI 服务 | 高性能中文对话模型，成本效益高 |

### 项目结构

```
interview-second-main/
├── components/              # React 组件
│   ├── SetupForm.tsx       # 题目设置表单
│   ├── DiscussionPanel.tsx # 讨论面板（核心）
│   ├── FeedbackReport.tsx  # 反馈报告
│   └── CharacterCard.tsx   # 角色卡片
├── services/                # 服务层
│   └── geminiService.ts    # AI 服务封装
├── types.ts                 # TypeScript 类型定义
├── constants.ts             # 常量配置（角色、提示词）
├── App.tsx                  # 主应用组件
├── index.tsx                # 应用入口
├── vite.config.ts           # Vite 配置
├── tailwind.config.js        # Tailwind 配置
└── package.json             # 项目依赖
```

## 📦 部署

### GitHub Pages 部署

快速部署到 GitHub Pages，免费且简单：

**⚠️ 遇到部署错误？** 查看 [快速配置指南](./GITHUB_PAGES_SETUP.md)

详细部署指南请查看 [GitHub Pages 部署文档](./DEPLOY_GITHUB_PAGES.md)

**快速步骤：**
1. 在仓库 Settings → Pages 中启用 GitHub Pages
2. **重要**：选择 "GitHub Actions" 作为部署源（不是 "Deploy from a branch"）
3. 在 Secrets 中添加 `DEEPSEEK_API_KEY`
4. 推送代码到 `main` 分支，自动部署

### Vercel 部署（推荐）

详细部署指南请查看 [Vercel 部署文档](./DEPLOY_VERCEL.md)

### 中国大陆部署

如需部署到中国大陆可访问的网站，请查看 [国内部署指南](./DEPLOY_CN.md)

支持以下部署方案：
- 阿里云 OSS + CDN
- 腾讯云 COS + CDN
- 自建服务器 + Nginx

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证。详情请查看 [LICENSE](./LICENSE) 文件。

---

## 🙏 致谢

- [DeepSeek](https://www.deepseek.com/) - 提供强大的 AI 对话能力
- [React](https://react.dev/) - 优秀的 UI 框架
- [Vite](https://vitejs.dev/) - 极速的开发体验
- [Tailwind CSS](https://tailwindcss.com/) - 优雅的 CSS 框架

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给个 Star！**

Made with ❤️ by [llingqi77-tech](https://github.com/llingqi77-tech)

</div>
