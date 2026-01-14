<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1EYoq90RLxWdLsc1UZFqq5BwIMToJX7jm

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `DEEPSEEK_API_KEY` in [.env.local](.env.local) to your DeepSeek API key
3. Run the app:
   `npm run dev`

## 部署到中国大陆

如果你需要将项目部署到中国大陆可访问的网站，请查看 [部署指南](DEPLOY_CN.md)。

部署指南包含：
- 阿里云 OSS + CDN 部署方案（推荐）
- 腾讯云 COS + CDN 部署方案
- 自建服务器 + Nginx 部署方案
- 域名备案和配置说明
- 安全部署建议（API Key 保护）
