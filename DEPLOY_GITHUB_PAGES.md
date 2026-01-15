# GitHub Pages 部署指南

## ⚠️ 常见错误解决

### 错误：`Get Pages site failed` 或 `HttpError: Not Found`

这个错误表示 GitHub Pages 还没有在仓库中启用，或者没有配置为使用 GitHub Actions 作为部署源。

## 解决步骤

### 第一步：启用 GitHub Pages

1. **进入仓库设置**
   - 打开你的 GitHub 仓库：`https://github.com/llingqi77-tech/interview-second`
   - 点击仓库顶部的 **Settings**（设置）标签

2. **找到 Pages 设置**
   - 在左侧菜单中找到 **Pages**（页面）选项
   - 点击进入 Pages 设置页面

3. **配置部署源**
   - 在 "Source"（源）部分，选择 **GitHub Actions** 作为部署源
   - **不要**选择 "Deploy from a branch"（从分支部署）
   - 保存设置

4. **验证设置**
   - 设置完成后，你应该能看到 "Your site is live at..." 的提示
   - 如果还没有，等待几秒钟让 GitHub 处理

### 第二步：配置 GitHub Secrets

1. **进入 Secrets 设置**
   - 在仓库 Settings 中，找到 **Secrets and variables** → **Actions**
   - 点击 **New repository secret**

2. **添加 DEEPSEEK_API_KEY**
   - Name: `DEEPSEEK_API_KEY`
   - Value: 你的 DeepSeek API Key（`sk-84606ff70f2d44f992e1d3cce2851818`）
   - 点击 **Add secret**

### 第三步：触发部署

1. **推送代码**
   ```bash
   git add .
   git commit -m "Configure GitHub Pages"
   git push origin main
   ```

2. **或手动触发**
   - 进入仓库的 **Actions** 标签
   - 选择 "Build and Deploy to GitHub Pages" workflow
   - 点击 **Run workflow** → **Run workflow**

### 第四步：验证部署

1. **查看 Actions 日志**
   - 进入 **Actions** 标签
   - 查看最新的 workflow 运行状态
   - 确保所有步骤都显示绿色 ✓

2. **访问网站**
   - 部署成功后，访问：`https://llingqi77-tech.github.io/interview-second/`
   - 注意：URL 格式为 `https://<username>.github.io/<repository-name>/`

## 完整配置检查清单

- [ ] GitHub Pages 已启用
- [ ] 部署源设置为 "GitHub Actions"（不是 "Deploy from a branch"）
- [ ] `DEEPSEEK_API_KEY` 已添加到 GitHub Secrets
- [ ] `.github/workflows/deploy.yml` 文件存在且正确
- [ ] 代码已推送到 `main` 分支
- [ ] Actions workflow 运行成功

## 常见问题

### Q1: 仍然显示 "Get Pages site failed"

**解决方法：**
1. 确保在 Settings → Pages 中选择了 "GitHub Actions" 作为部署源
2. 等待几分钟让 GitHub 处理配置
3. 尝试手动运行 workflow

### Q2: 网站显示 404

**可能原因：**
- Base path 配置不正确
- 文件路径问题

**解决方法：**
1. 检查 workflow 日志中的 base path 设置
2. 确保访问的 URL 包含正确的仓库名路径
3. 例如：`https://llingqi77-tech.github.io/interview-second/`（注意末尾的斜杠）

### Q3: 环境变量未设置错误

**解决方法：**
1. 确保在 GitHub Secrets 中添加了 `DEEPSEEK_API_KEY`
2. Secret 名称必须完全匹配：`DEEPSEEK_API_KEY`（区分大小写）
3. 重新运行 workflow

### Q4: 构建失败

**可能原因：**
- 依赖安装失败
- TypeScript 错误
- 环境变量问题

**解决方法：**
1. 查看 Actions 日志中的具体错误信息
2. 本地运行 `pnpm run build` 测试构建
3. 修复错误后重新提交

## 自定义域名（可选）

如果你想使用自定义域名：

1. **在 Pages 设置中添加域名**
   - Settings → Pages → Custom domain
   - 输入你的域名（如：`interview.yourdomain.com`）

2. **配置 DNS**
   - 添加 CNAME 记录指向 `llingqi77-tech.github.io`
   - 或添加 A 记录指向 GitHub Pages 的 IP 地址

3. **等待 DNS 生效**
   - 通常需要几分钟到几小时

## 更新部署

每次代码更新后：

1. **提交代码**
   ```bash
   git add .
   git commit -m "Update: your changes"
   git push origin main
   ```

2. **自动部署**
   - GitHub Actions 会自动触发部署
   - 在 Actions 标签中查看部署进度

3. **验证更新**
   - 等待部署完成后访问网站
   - 可能需要清除浏览器缓存才能看到最新版本

## 回滚部署

如果新部署有问题：

1. 进入 **Actions** 标签
2. 找到之前成功的部署
3. 点击进入查看详情
4. 可以重新运行该 workflow

## 技术支持

如果遇到其他问题：

1. 查看 GitHub Actions 日志
2. 检查 GitHub Pages 设置
3. 参考 [GitHub Pages 官方文档](https://docs.github.com/en/pages)
