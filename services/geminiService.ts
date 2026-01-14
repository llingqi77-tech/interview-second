import { Message, Character, FeedbackData } from "../types";
import { SYSTEM_PROMPT_BASE } from "../constants";

/**
 * DeepSeek API 配置
 * API 地址: https://api.deepseek.com/v1/chat/completions
 * 使用环境变量 DEEPSEEK_API_KEY 作为认证密钥
 */
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";

/**
 * 调用 DeepSeek API 生成文本内容
 * @param prompt - 输入的提示词
 * @param temperature - 温度参数，控制输出的随机性（默认 0.7）
 * @returns 生成的文本内容
 */
async function callDeepSeekAPI(prompt: string, temperature: number = 0.7): Promise<string> {
  // 检查环境变量是否存在
  // 优先使用 process.env（通过 Vite define 注入），如果不存在则尝试从 window 对象获取
  let apiKey = process.env.DEEPSEEK_API_KEY;
  
  // 如果 process.env 中没有，尝试从全局变量获取（用于开发环境）
  if (!apiKey && typeof window !== 'undefined' && (window as any).__DEEPSEEK_API_KEY__) {
    apiKey = (window as any).__DEEPSEEK_API_KEY__;
  }
  
  // 调试信息
  console.log('🔍 调试信息:');
  console.log('  - process.env.DEEPSEEK_API_KEY 类型:', typeof apiKey);
  console.log('  - process.env.DEEPSEEK_API_KEY 值:', apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined/null');
  console.log('  - process.env.DEEPSEEK_API_KEY 长度:', apiKey?.length || 0);
  
  // 如果还是没有，使用硬编码的 API Key（仅用于开发测试）
  if (!apiKey) {
    console.warn('⚠️ 环境变量未设置，使用硬编码的 API Key（仅用于开发测试）');
    apiKey = 'sk-84606ff70f2d44f992e1d3cce2851818';
  }
  
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY 环境变量未设置");
  }

  try {
    // 使用 Node.js 原生 fetch 调用 DeepSeek API
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: temperature,
        stream: false,
      }),
    });

    // 检查 HTTP 响应状态
    if (!response.ok) {
      const errorText = await response.text().catch(() => "未知错误");
      throw new Error(`DeepSeek API 请求失败: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // 解析响应 JSON
    const data = await response.json();

    // 从响应体中提取生成的文本内容
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      return data.choices[0].message.content.trim();
    } else {
      throw new Error("DeepSeek API 响应格式异常，未找到生成内容");
    }
  } catch (error) {
    // 处理网络错误或其他异常
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`调用 DeepSeek API 时发生未知错误: ${String(error)}`);
  }
}

export async function generateAIReply(
  character: Character,
  topic: string,
  jobTitle: string,
  history: Message[],
  phase: string
): Promise<string> {
  try {
    const prompt = `
    ${SYSTEM_PROMPT_BASE.replace('{jobTitle}', jobTitle)
      .replace('{topic}', topic)
      .replace('{characterName}', character.name)
      .replace('{characterRole}', character.role)
      .replace('{characterPersonality}', character.personality)
      .replace('{phase}', phase)}
    
    最近讨论历史：
    ${history.slice(-6).map(m => `${m.senderName}: ${m.content}`).join('\n')}
    
    请发表你的言论：
  `;

    // 调用 DeepSeek API，temperature 设置为 0.8 以匹配原有配置
    const result = await callDeepSeekAPI(prompt, 0.8);
    return result || "时间紧迫，我们必须尽快达成共识。";
  } catch (error) {
    console.error("生成 AI 回复失败:", error);
    // 返回默认回复，保持与原代码一致的错误处理
    return "时间紧迫，我们必须尽快达成共识。";
  }
}

export async function generateTopic(company: string, jobTitle: string): Promise<string> {
  try {
    const prompt = `为${company}的${jobTitle}岗位设计一个高质量群面题。
要求分为：
【背景】行业背景与现状
【任务】核心解决问题
【要求】约束条件
【时间分配】各环节建议时长

禁止使用Markdown。请直接用纯文字分段输出。`;

    // 调用 DeepSeek API 生成题目
    const result = await callDeepSeekAPI(prompt, 0.7);
    // 移除 Markdown 格式字符，保持与原代码一致
    return result.replace(/[*#`>]/g, '').trim() || "题目生成失败，请手动输入。";
  } catch (error) {
    console.error("生成题目失败:", error);
    // 返回友好的错误提示，保持与原代码一致的错误处理
    return "题目生成失败，请手动输入。";
  }
}

export async function generateFeedback(
  topic: string,
  jobTitle: string,
  history: Message[]
): Promise<FeedbackData> {
  // 计算用户发言占比（业务逻辑保持不变）
  const userMessages = history.filter(m => m.senderId === 'user');
  const totalMessages = history.length;
  const userCount = userMessages.length;
  const voiceShare = Math.round((userCount / totalMessages) * 100) || 0;

  try {
    // 构建包含 JSON Schema 要求的 prompt，确保 DeepSeek 返回标准 JSON 格式
    const prompt = `作为专业面试官，请深度分析以下讨论中【用户】的表现。
岗位：${jobTitle}
题目：${topic}
全场对话记录：
${history.map(m => `${m.senderName}: ${m.content}`).join('\n')}

评估维度：
1. **发言质量**：分析用户观点是否切中题目核心要害，是否提供了独特的洞察。
2. **结构贡献**：用户是否在确立框架、归纳共识、化解冲突上起到关键作用。
3. **时机掌握**：是否在合适的时机切入，发言是否过于碎片化。
4. **总结表现**：如果用户在最后阶段做了总结陈词，请给予高权重加分。
5. **抗压能力**：在被抢话或质疑时的反应。

请严格按以下 JSON 格式返回，不要包含任何其他文字或 Markdown 格式：
{
  "timing": "发言时机精准度分析（字符串）",
  "voiceShare": 0,
  "structuralContribution": "对讨论框架和进展的贡献评估（字符串）",
  "interruptionHandling": "在冲突和高压下的表现（字符串）",
  "overallScore": 0,
  "suggestions": ["改进建议1", "改进建议2", "改进建议3"]
}

注意：
- timing、structuralContribution、interruptionHandling 必须是字符串类型
- overallScore 必须是 0-100 之间的数字
- suggestions 必须是字符串数组，包含 3-5 条具体改进建议
- voiceShare 字段会被系统自动计算，你可以忽略它`;

    // 调用 DeepSeek API 生成反馈（使用较低温度以确保 JSON 格式准确性）
    const jsonStr = await callDeepSeekAPI(prompt, 0.3);

    // 尝试提取 JSON（可能包含代码块标记）
    let cleanedJsonStr = jsonStr.trim();
    // 移除可能的 Markdown 代码块标记
    if (cleanedJsonStr.startsWith("```json")) {
      cleanedJsonStr = cleanedJsonStr.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanedJsonStr.startsWith("```")) {
      cleanedJsonStr = cleanedJsonStr.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    // 解析 JSON
    let feedback: FeedbackData;
    try {
      feedback = JSON.parse(cleanedJsonStr);
    } catch (parseError) {
      console.error("JSON 解析失败:", parseError, "原始内容:", cleanedJsonStr);
      throw new Error("AI 返回的内容不是有效的 JSON 格式");
    }

    // 验证必需字段
    if (
      typeof feedback.timing !== "string" ||
      typeof feedback.structuralContribution !== "string" ||
      typeof feedback.interruptionHandling !== "string" ||
      typeof feedback.overallScore !== "number" ||
      !Array.isArray(feedback.suggestions)
    ) {
      throw new Error("AI 返回的 JSON 格式不完整或字段类型不正确");
    }

    // 注入实际计算的发言占比（业务逻辑保持不变）
    feedback.voiceShare = voiceShare;
    return feedback;
  } catch (error) {
    console.error("生成反馈失败:", error);
    // 返回默认反馈数据，保持与原代码一致的错误处理
    return {
      timing: "评估过程中未能获取到 AI 分析结果。",
      voiceShare: voiceShare,
      structuralContribution: "无法评价结构化贡献。",
      interruptionHandling: "无法评价抗压表现。",
      overallScore: 60,
      suggestions: ["建议再次提交评估或检查网络连接。"]
    };
  }
}