#!/bin/bash

# 阿里云 OSS 部署脚本
# 使用方法: ./deploy-aliyun.sh your-bucket-name oss-region

set -e

BUCKET_NAME=$1
OSS_REGION=$2

if [ -z "$BUCKET_NAME" ] || [ -z "$OSS_REGION" ]; then
    echo "使用方法: ./deploy-aliyun.sh <bucket-name> <oss-region>"
    echo "示例: ./deploy-aliyun.sh my-website oss-cn-hangzhou"
    exit 1
fi

# 检查环境变量
if [ -z "$DEEPSEEK_API_KEY" ]; then
    echo "⚠️  警告: DEEPSEEK_API_KEY 环境变量未设置"
    echo "请在 .env.production 文件中设置，或运行:"
    echo "export DEEPSEEK_API_KEY=your_api_key"
    read -p "是否继续构建? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "📦 开始构建项目..."

# 构建项目
npm run build

if [ ! -d "dist" ]; then
    echo "❌ 构建失败: dist 目录不存在"
    exit 1
fi

echo "✅ 构建完成"
echo "📤 开始上传到阿里云 OSS..."

# 检查是否安装了 ossutil
if ! command -v ossutil64 &> /dev/null; then
    echo "⚠️  ossutil64 未安装"
    echo "请先安装: npm install -g @alicloud/ossutil64"
    echo "或使用其他方式上传 dist 目录到 OSS"
    exit 1
fi

# 上传文件
ossutil64 cp -r dist/ oss://${BUCKET_NAME}/ --update

echo "✅ 上传完成!"
echo ""
echo "📋 后续步骤:"
echo "1. 登录阿里云 OSS 控制台: https://oss.console.aliyun.com/"
echo "2. 进入存储桶 ${BUCKET_NAME}"
echo "3. 开启'静态网站托管'功能"
echo "4. 设置默认首页为 index.html"
echo "5. 绑定你的自定义域名"
echo "6. 配置 CDN 加速（可选）"
echo ""
echo "⚠️  安全提示: 当前 API Key 会暴露在前端代码中，建议使用后端代理!"
