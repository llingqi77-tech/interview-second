# Vercel 部署指南

## 部署前准备

### 1. 更新依赖锁文件

确保 `pnpm-lock.yaml` 与 `package.json` 同步：

```bash
pnpm install
```

### 2. 提交更新的文件

```bash
git add pnpm-lock.yaml
git commit -m "Update pnpm-lock.yaml after removing @google/genai"
git push
```

## Vercel 部署步骤

### 方法一：通过 Vercel 网站部署

1. **登录 Vercel**
   - 访问 [vercel.com](https://vercel.com)
   - 使用 GitHub 账号登录

2. **导入项目**
   - 点击 "Add New Project"
   - 选择你的 GitHub 仓库 `llingqi77-tech/interview-second`
   - Vercel 会自动检测到这是一个 Vite 项目

3. **配置环境变量**
   - 在 "Environment Variables" 部分添加：
     - **Name**: `DEEPSEEK_API_KEY`
     - **Value**: 你的 DeepSeek API Key（`sk-84606ff70f2d44f992e1d3cce2851818`）
     - **Environment**: 选择 `Production`, `Preview`, `Development`（全部勾选）

4. **配置构建设置**
   - **Framework Preset**: Vite
   - **Build Command**: `pnpm run build`（或使用默认值）
   - **Output Directory**: `dist`
   - **Install Command**: `pnpm install --no-frozen-lockfile`（如果 lockfile 有问题）

5. **部署**
   - 点击 "Deploy"
   - 等待构建完成

### 方法二：使用 Vercel CLI

1. **安装 Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **在项目目录中部署**
   ```bash
   cd interview-second-main
   vercel
   ```

4. **设置环境变量**
   ```bash
   vercel env add DEEPSEEK_API_KEY
   # 输入你的 API Key: sk-84606ff70f2d44f992e1d3cce2851818
   # 选择环境: Production, Preview, Development
   ```

5. **重新部署**
   ```bash
   vercel --prod
   ```

## 常见问题解决

### 问题 1: pnpm-lock.yaml 不同步

**错误信息：**
```
ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date
```

**解决方法：**
1. 本地运行 `pnpm install` 更新 lockfile
2. 提交更新的 `pnpm-lock.yaml` 文件
3. 或者在 Vercel 项目设置中将 "Install Command" 改为：
   ```
   pnpm install --no-frozen-lockfile
   ```

### 问题 2: 环境变量未设置

**错误信息：**
```
DEEPSEEK_API_KEY 环境变量未设置
```

**解决方法：**
1. 在 Vercel 项目设置中添加环境变量
2. 确保环境变量名称是 `DEEPSEEK_API_KEY`（不是 `VITE_DEEPSEEK_API_KEY`）
3. 重新部署项目

### 问题 3: 构建失败

**可能原因：**
- TypeScript 类型错误
- 依赖安装失败
- 构建命令错误

**解决方法：**
1. 检查 Vercel 构建日志
2. 本地运行 `pnpm run build` 测试构建
3. 修复错误后重新提交

## 部署后检查

1. **访问网站**
   - 部署完成后，Vercel 会提供一个 URL（如：`https://your-project.vercel.app`）
   - 访问该 URL 检查网站是否正常

2. **测试功能**
   - 填写公司和岗位信息
   - 点击"生成题目"按钮，测试是否正常
   - 如果失败，检查浏览器控制台的错误信息

3. **检查环境变量**
   - 在 Vercel 项目设置中确认环境变量已正确设置
   - 注意：环境变量修改后需要重新部署才能生效

## 自定义域名

1. **在 Vercel 项目设置中添加域名**
   - 进入项目 → Settings → Domains
   - 添加你的域名

2. **配置 DNS**
   - 按照 Vercel 提供的 DNS 记录配置你的域名
   - 等待 DNS 生效（通常几分钟到几小时）

3. **SSL 证书**
   - Vercel 会自动为你的域名配置 SSL 证书
   - 无需手动配置

## 注意事项

⚠️ **重要安全提示：**
- API Key 会通过 Vercel 的环境变量注入到构建产物中
- 这意味着 API Key 会暴露在前端代码中
- 建议：
  1. 使用 Vercel Serverless Functions 创建 API 代理（推荐）
  2. 或限制 API Key 的使用频率和权限
  3. 定期更换 API Key

## 更新部署

每次代码更新后：
1. 提交代码到 GitHub
2. Vercel 会自动触发新的部署（如果已连接 GitHub）
3. 或手动运行 `vercel --prod` 部署

## 回滚部署

如果新部署有问题：
1. 在 Vercel Dashboard 中找到之前的部署
2. 点击 "..." → "Promote to Production"
3. 即可回滚到之前的版本
