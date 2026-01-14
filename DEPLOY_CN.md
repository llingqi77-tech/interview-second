# 中国大陆部署指南

本文档提供将项目部署到中国大陆可访问网站的详细步骤。

## ⚠️ 重要安全提示

**当前代码将 API Key 打包到前端，存在安全风险！** API Key 会暴露在浏览器中，任何人都可以查看和使用。

**强烈建议：**
1. 使用后端 API 代理（推荐）：创建一个简单的后端服务，将 API Key 存储在服务器端
2. 或使用环境变量注入（仅限构建时）：确保 API Key 不会提交到代码仓库

## 部署方案选择

### 方案一：阿里云 OSS + CDN（推荐，性价比高）

**优点：**
- 成本低（静态网站托管约 0.15 元/GB/月）
- 配置简单
- 支持 CDN 加速
- 支持自定义域名和 HTTPS

**适用场景：** 个人项目、小型企业

---

### 方案二：腾讯云 COS + CDN

**优点：**
- 与阿里云类似
- 腾讯云生态集成好

**适用场景：** 已在腾讯云生态的项目

---

### 方案三：自建服务器 + Nginx

**优点：**
- 完全控制
- 可自定义配置

**缺点：**
- 需要维护服务器
- 需要配置 SSL 证书

**适用场景：** 有服务器运维能力

---

## 详细部署步骤

### 方案一：阿里云 OSS + CDN 部署

#### 第一步：准备工作

1. **域名备案**
   - 登录 [阿里云备案系统](https://beian.aliyun.com/)
   - 完成域名备案（通常需要 7-20 个工作日）
   - 备案通过后才能绑定域名

2. **创建 OSS 存储桶**
   - 登录 [阿里云控制台](https://oss.console.aliyun.com/)
   - 创建存储桶（Bucket）
   - 选择区域：建议选择离用户最近的区域（如：华东1-杭州）
   - 读写权限：设置为"公共读"（用于静态网站托管）

#### 第二步：本地构建项目

```bash
# 1. 安装依赖
npm install
# 或
pnpm install

# 2. 创建环境变量文件 .env.production
# 在项目根目录创建 .env.production 文件
echo "DEEPSEEK_API_KEY=your_deepseek_api_key_here" > .env.production

# 3. 构建项目
npm run build
# 或
pnpm run build

# 构建完成后，dist 目录包含所有静态文件
```

#### 第三步：上传到 OSS

**方法 A：使用阿里云控制台上传**
1. 进入 OSS 控制台，选择你的存储桶
2. 点击"文件管理" → "上传文件"
3. 选择 `dist` 目录下的所有文件上传
4. 确保 `index.html` 在根目录

**方法 B：使用命令行工具（推荐）**
```bash
# 安装阿里云 CLI 工具
npm install -g @alicloud/ossutil64

# 配置访问密钥
ossutil64 config

# 上传 dist 目录到 OSS
ossutil64 cp -r dist/ oss://your-bucket-name/ --update
```

**方法 C：使用 OSS Browser（图形化工具）**
- 下载 [OSS Browser](https://help.aliyun.com/document_detail/61872.html)
- 使用 AccessKey 登录
- 拖拽 `dist` 目录内容到存储桶

#### 第四步：配置静态网站托管

1. 在 OSS 控制台，进入你的存储桶
2. 点击"基础设置" → "静态网站托管"
3. 开启"静态网站托管"
4. 设置：
   - 默认首页：`index.html`
   - 默认 404 页：`index.html`（用于 SPA 路由）
   - 子目录首页：`index.html`

#### 第五步：绑定自定义域名

1. 在存储桶的"传输管理" → "域名管理"中
2. 点击"绑定域名"
3. 输入你的域名（如：`www.yourdomain.com`）
4. 选择"自动添加 CNAME 记录"（如果域名在阿里云）
5. 或手动在域名 DNS 解析中添加 CNAME 记录：
   ```
   类型：CNAME
   主机记录：www（或 @ 表示根域名）
   记录值：your-bucket-name.oss-cn-hangzhou.aliyuncs.com
   ```

#### 第六步：配置 CDN 加速（可选但推荐）

1. 登录 [CDN 控制台](https://cdn.console.aliyun.com/)
2. 添加加速域名
3. 源站类型：选择"OSS 域名"
4. 源站地址：选择你的 OSS 存储桶
5. 加速区域：选择"仅中国内地"
6. 配置 HTTPS：
   - 上传 SSL 证书（可在阿里云申请免费证书）
   - 或使用阿里云提供的免费证书
7. 配置完成后，将域名的 CNAME 记录指向 CDN 提供的地址

#### 第七步：配置环境变量（重要）

**⚠️ 安全警告：** 当前代码将 API Key 打包到前端，这是不安全的！

**临时方案（仅用于测试）：**
- 在 `.env.production` 中设置 `DEEPSEEK_API_KEY`
- 构建时会被注入到代码中
- **不要将 `.env.production` 提交到 Git**

**推荐方案：创建后端 API 代理**
- 见下方"安全部署方案"

---

### 方案二：腾讯云 COS + CDN 部署

步骤与阿里云类似：

1. **创建 COS 存储桶**
   - 登录 [腾讯云控制台](https://console.cloud.tencent.com/cos)
   - 创建存储桶，设置"公有读私有写"

2. **上传文件**
   ```bash
   # 使用 COSCMD 工具
   pip install coscmd
   coscmd config -a SecretId -s SecretKey -b BucketName -r Region
   coscmd upload -rs dist/ /
   ```

3. **开启静态网站托管**
   - 在存储桶的"基础配置" → "静态网站"中开启
   - 设置默认首页为 `index.html`

4. **绑定域名和 CDN**
   - 类似阿里云流程

---

### 方案三：自建服务器 + Nginx 部署

#### 第一步：准备服务器

- 购买云服务器（阿里云 ECS、腾讯云 CVM 等）
- 安装 Nginx

#### 第二步：构建并上传项目

```bash
# 本地构建
npm run build

# 使用 scp 上传到服务器
scp -r dist/* root@your-server-ip:/var/www/html/
```

#### 第三步：配置 Nginx

创建 `/etc/nginx/sites-available/your-site`：

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    root /var/www/html;
    index index.html;

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

启用配置：
```bash
ln -s /etc/nginx/sites-available/your-site /etc/nginx/sites-enabled/
nginx -t  # 测试配置
systemctl reload nginx
```

#### 第四步：配置 SSL 证书

使用 Let's Encrypt 免费证书：
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 安全部署方案（强烈推荐）

### 创建后端 API 代理

由于 API Key 不应该暴露在前端，建议创建一个简单的后端服务：

#### 选项 A：使用 Vercel Serverless Functions（如果可访问）

创建 `api/chat.ts`：
```typescript
export default async function handler(req, res) {
  const { prompt, temperature } = req.body;
  
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature,
      stream: false,
    }),
  });
  
  const data = await response.json();
  res.json(data);
}
```

#### 选项 B：使用 Node.js + Express（部署到国内服务器）

1. 创建 `server/index.js`：
```javascript
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  const { prompt, temperature = 0.7 } = req.body;
  
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature,
        stream: false,
      }),
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

2. 修改前端代码，调用后端 API 而不是直接调用 DeepSeek

---

## 部署检查清单

- [ ] 域名已完成备案
- [ ] 项目已成功构建（`npm run build`）
- [ ] 静态文件已上传到服务器/OSS
- [ ] 静态网站托管已开启
- [ ] 自定义域名已绑定
- [ ] SSL 证书已配置（HTTPS）
- [ ] CDN 已配置（如使用）
- [ ] 环境变量已正确设置
- [ ] 网站可以正常访问
- [ ] API 调用正常（测试生成题目、AI 回复等功能）

---

## 常见问题

### Q: 域名备案需要多长时间？
A: 通常 7-20 个工作日，具体取决于管局审核速度。

### Q: 可以使用未备案的域名吗？
A: 可以，但只能使用 IP 访问或使用云服务商提供的临时域名。绑定自定义域名必须完成备案。

### Q: API Key 暴露在前端安全吗？
A: **不安全！** 任何人都可以在浏览器开发者工具中查看并使用你的 API Key。建议使用后端代理。

### Q: 如何限制 API 调用频率？
A: 如果使用后端代理，可以在后端实现限流。如果直接在前端调用，无法有效限制。

### Q: 部署后访问 404？
A: 检查：
1. SPA 路由配置（确保所有路由都返回 `index.html`）
2. 静态网站托管的默认页面设置
3. Nginx 的 `try_files` 配置

---

## 成本估算（阿里云方案）

- **OSS 存储：** 约 0.12 元/GB/月（标准存储）
- **OSS 流量：** 约 0.5 元/GB（外网下行流量）
- **CDN 流量：** 约 0.24 元/GB（中国内地）
- **域名：** 已购买
- **SSL 证书：** 免费（Let's Encrypt 或阿里云免费证书）

**小规模网站（月访问量 < 10GB）：** 约 5-20 元/月

---

## 技术支持

如遇到部署问题，请检查：
1. 浏览器控制台错误信息
2. 服务器日志
3. CDN 缓存配置
4. 域名解析是否正确
