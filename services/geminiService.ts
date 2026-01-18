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
  phase: string,
  summaryGuided?: boolean,
  summaryVolunteered?: boolean
): Promise<string> {
  try {
    // 获取更多的讨论历史，让AI能看到更多上下文（增加到10条）
    const recentHistory = history.slice(-10);
    const lastMessage = recentHistory[recentHistory.length - 1];
    const lastSpeaker = lastMessage ? lastMessage.senderName : '';
    const isLastSpeakerUser = lastMessage && lastMessage.senderId === 'user';
    const isLastSpeakerSelf = lastMessage && lastMessage.senderId === character.id;
    
    // 分析讨论历史中所有参与者的发言
    const allSpeakers = recentHistory.map(m => ({
      name: m.senderName,
      content: m.content,
      id: m.senderId
    }));
    
    // 找出讨论中提到的关键观点和不同角色的贡献
    const otherSpeakers = allSpeakers.filter(s => s.id !== character.id && s.id !== 'user');
    const userSpeakers = allSpeakers.filter(s => s.id === 'user');
    const allParticipants = [...new Set(allSpeakers.map(s => s.name))];
    
    // 检查是否是第一个发言者（讨论历史为空或只有系统消息，或者只有当前角色的发言）
    const nonSystemMessages = history.filter(m => m.type !== 'system');
    const isFirstSpeaker = nonSystemMessages.length === 0 || 
                          (nonSystemMessages.length === 1 && nonSystemMessages[0].senderId === character.id);
    const isEarlySpeaker = nonSystemMessages.length <= 2; // 前两个发言者
    
    // 构建更详细的上下文提示
    let contextHint = '';
    const isOpeningPhase = phase.includes('开局框架');
    const isDeepPhase = phase.includes('深入讨论');
    const isSummaryPhase = phase.includes('总结') || phase.includes('收尾');
    const isStructuredRole = character.role === 'STRUCTURED';
    
    // 逻辑检查提示：避免不符合逻辑的表达
    let logicCheckHint = '';
    if (isFirstSpeaker || isEarlySpeaker) {
      logicCheckHint = `\n【重要逻辑检查】你是${isFirstSpeaker ? '第一个' : '前几个'}发言者，讨论历史中${isFirstSpeaker ? '没有任何' : '几乎没有'}之前的讨论内容。因此：
- **绝对禁止**使用"刚才"、"大家提到"、"前面说的"、"之前讨论的"、"刚才大家提到的框架方向"等表达
- **绝对禁止**引用不存在的讨论内容
- 如果是第一个发言者，直接提出你的框架和观点，不要说"刚才"、"大家"等
- 如果是前几个发言者，只能引用确实存在的、在你之前发言者的内容`;
    }
    
    // 检查最近是否有引导总结的消息
    const hasSummaryGuidance = recentHistory.some(m => 
      m.content.includes('总结') && m.content.includes('汇报') || 
      m.content.includes('谁来总结') || 
      m.content.includes('谁愿意')
    );
    
    // 检查是否有人自荐汇报
    const hasVolunteered = recentHistory.some(m => 
      m.content.includes('我来总结') || 
      m.content.includes('我来汇报') || 
      m.content.includes('我来说') ||
      m.content.includes('我来')
    );
    
    if (isLastSpeakerUser) {
      // 获取用户的具体发言内容
      const userMessageContent = lastMessage ? lastMessage.content : '';
      
      if (isOpeningPhase) {
        contextHint = `\n【核心要求】上一个发言者是用户（考生）${lastSpeaker}，他说了："${userMessageContent}"。当前是开局框架阶段。你必须针对他的具体发言内容进行回应：
- 如果用户提出了框架，你可以在此基础上补充、细化或提出不同角度的框架
- 如果用户提出了观点，你可以同意并推进，或质疑后提出自己的框架思路
- 不能只说"我同意"，必须针对他的具体内容做出实质性回应
这是群面讨论，你必须回应用户的发言内容，不能忽略他。`;
      } else {
        contextHint = `\n【核心要求】上一个发言者是用户（考生）${lastSpeaker}，他说了："${userMessageContent}"。你必须针对他的具体发言内容进行回应：
- **同意并推进**：如果你同意他的观点，要在此基础上推进讨论，提出下一步或延伸思考
- **质疑后提出观点**：如果你不同意或认为有问题，要明确指出问题所在，然后提出自己的观点
- **补充**：如果你认为他的观点不完整，要补充具体的细节或角度
- 不能只说"我同意"或"我反对"，必须针对他的具体内容做出实质性回应
这是群面讨论，你必须回应用户的发言内容，不能忽略他。`;
      }
    } else if (isLastSpeakerSelf) {
      contextHint = `\n重要：上一个发言者是你自己，你不能同意自己的观点。请针对讨论中其他人的观点进行回应，或者提出新的角度。`;
    } else if (lastSpeaker) {
      if (isOpeningPhase) {
        contextHint = `\n重要：上一个发言者是${lastSpeaker}，当前是开局框架阶段。请对他的发言做出回应，但不能只说"我同意"，要在此基础上提出框架思路、补充框架要点或提出不同角度的框架。`;
      } else {
        contextHint = `\n重要：上一个发言者是${lastSpeaker}，请对他的发言做出回应，但要提出自己的见解。`;
      }
    }
    
    // 添加发言风格提示
    const styleHint = `
发言风格要求：
- 避免固定句式，不要总是用"我同意"、"我反对"、"我要补充"开头
- 使用自然表达，如"我认为"、"我还想到一点"、"从另一个角度看"、"这里有个问题"等
- 可以直接说观点，不需要每次都先表态
- 在综合考虑他人观点的基础上，要有自己的分析和评判标准，且不能偏离题目的核心，不能违法题目的要求
- 必须基本符合你的性格特点：${character.personality}
`;
    
    // 检查讨论历史中是否有用户发言
    const hasUserInHistory = recentHistory.some(m => m.senderId === 'user');
    const userMessages = recentHistory.filter(m => m.senderId === 'user');
    
    // 构建综合互动提示
    let comprehensiveInteractionHint = '';
    
    if (allParticipants.length > 1) {
      const otherParticipants = allParticipants.filter(name => name !== character.name.split(' (')[0]);
      const participantList = otherParticipants.join('、');
      
      comprehensiveInteractionHint = `\n【重要】这是小组讨论，讨论历史中包含了以下参与者的发言：${participantList}。你在发言时：
- **必须回应前述发言者**，这是基本要求
- **同时要综合考虑其他所有参与者的观点**，体现出你在认真倾听所有人的发言
- **关键：不要用固定句式**：不要总是说"我同意XXX，也同意XXX的观点"这种固定句式
- **要有自己的分析和评判**：在综合考虑前述人的发言基础上，进行分析并给出自己的观点，要有自己的评判标准
- 可以自然地引用其他角色的观点作为分析的基础，例如"刚才${otherParticipants[0] || 'XX'}提到的...让我想到...，还有${otherParticipants[1] || 'XX'}说的...，从我的角度看..."，然后给出自己的分析和判断
- 要有自己的评判标准，对不同的观点进行分析、比较、筛选，然后提出自己的见解
- 让讨论更有互动性，不要只关注一个人，要体现出对整体讨论的关注
- 如果讨论历史中有用户（我）的发言，必须体现出对他的关注和回应`;
    }
    
    let userInteractionHint = '';
    if (hasUserInHistory && !isLastSpeakerUser) {
      // 如果历史中有用户发言，但上一个发言者不是用户，提醒AI也要关注用户的观点
      userInteractionHint = `\n注意：讨论历史中包含用户（考生）的发言，即使上一个发言者不是用户，你也要在回应中体现出对用户观点的关注，这是群面讨论，所有参与者都应该互相回应。`;
    }
    
    // 总结汇报相关提示
    let summaryHint = '';
    if (isSummaryPhase && isStructuredRole && !hasSummaryGuidance) {
      // 枢纽型角色在总结阶段，如果还没有引导总结，应该引导
      summaryHint = `\n【重要】当前是总结阶段，你是枢纽型角色，应该引导大家进行总结。可以说"我们讨论得差不多了，现在需要有人来总结一下我们的讨论内容，谁愿意来汇报？"或类似的话。`;
    } else if (isSummaryPhase && hasSummaryGuidance && !hasVolunteered && !summaryVolunteered) {
      // 已经引导总结，但还没有人自荐，当前角色可以自荐
      summaryHint = `\n【重要】已经有人引导总结，但还没有人自荐汇报。你可以自荐进行汇报，说"我来总结一下"或"我来汇报"等。如果自荐，你需要对前述整体的讨论内容进行总结，并用有条理的方式呈现和表述出来。`;
    } else if (isSummaryPhase && (hasVolunteered || summaryVolunteered)) {
      // 已经有人自荐汇报，当前角色可以补充或同意
      summaryHint = `\n【重要】已经有人自荐进行总结汇报。你可以对总结进行补充，指出遗漏的重要细节，或者简洁地表示同意。避免重复已经说过的内容。`;
    }
    
    const prompt = `
    ${SYSTEM_PROMPT_BASE.replace('{jobTitle}', jobTitle)
      .replace('{topic}', topic)
      .replace('{characterName}', character.name)
      .replace('{characterRole}', character.role)
      .replace('{characterPersonality}', character.personality)
      .replace('{phase}', phase)}
    
    最近讨论历史（包含所有参与者的发言）：
    ${recentHistory.length > 0 ? recentHistory.map(m => `${m.senderName}: ${m.content}`).join('\n') : '（目前还没有讨论内容）'}
    
    ${logicCheckHint}
    ${contextHint}
    ${comprehensiveInteractionHint}
    ${userInteractionHint}
    ${summaryHint}
    ${styleHint}
    
    请发表你的言论：
    - ${isFirstSpeaker ? '你是第一个发言者，直接提出你的框架和观点，不要使用"刚才"、"大家提到"、"前面说的"等表达，因为之前没有任何讨论内容' : '必须回应上一个发言者的观点'}
    - ${isFirstSpeaker ? '' : '同时要综合考虑讨论历史中其他所有参与者的发言，体现出对整体讨论的关注'}
    - **重要**：不要用"我同意XXX，也同意XXX的观点"这种固定句式
    - ${isFirstSpeaker ? '直接提出整体分析框架，例如按照什么顺序来分析，以及进行时间分配，然后发表自己的观点' : '在综合考虑前述人的发言基础上，进行分析并给出自己的观点，要有自己的评判标准'}
    - ${isFirstSpeaker ? '' : '可以自然地引用其他角色的观点作为分析的基础，然后给出自己的分析和判断'}
    - 要有自己的评判标准，对不同的观点进行分析、比较、筛选，然后提出自己的见解
    - 使用自然真实的表达方式
    - 如果是群面讨论，要确保回应用户的发言
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
    const prompt = `你是一位资深的${company}面试官，正在为${jobTitle}岗位设计群面题目。

请深入分析${company}的业务特点、行业定位、核心产品/服务，以及${jobTitle}岗位在该公司的实际工作场景和核心职责。基于这些信息，设计一个高度贴合、具有实战性的群面题目。

题目要求严格按照以下格式输出：

一、背景
（仅用一个段落描述${company}某个具体业务组或项目当前遇到的真实业务困境和挑战。背景必须：
- 紧密结合${company}的实际业务场景（如${company}的核心产品、服务模式、用户群体等）
- 体现${jobTitle}岗位在该公司可能面临的典型工作场景
- 描述具体的业务问题，而非抽象概念
- 不要涉及公司整体战略、产品线架构、时代背景等宏观内容
- 聚焦一个具体的业务困境，让讨论有明确的解决目标）

二、问题
请你们在小组讨论中，设计出解决方案框架。方案需包含以下核心要点：
1、关键动作或讨论要点一（简短明确，与${jobTitle}岗位核心能力相关）
2、关键动作或讨论要点二（简短明确，与${jobTitle}岗位核心能力相关）
3、关键动作或讨论要点三（简短明确，与${jobTitle}岗位核心能力相关）
4、关键动作或讨论要点四（简短明确，与${jobTitle}岗位核心能力相关）

要求：每个要点要简短明确，只说明关键动作和要讨论的要点、角度即可，不要冗长描述。

三、时间分配
1、阅读材料：X分钟。
2、小组讨论：X分钟。
3、总结汇报：X分钟。

重要要求：
- 使用中文数字"一、二、三"作为一级标题
- 使用阿拉伯数字"1、2、3"作为二级标题
- 禁止使用Markdown格式（不要使用#、**、*等符号）
- 直接使用纯文字分段输出
- 背景部分必须控制在1个段落内，要真实反映${company}的业务特点和${jobTitle}的工作场景
- 问题部分的4个要点要简短明确，只说明关键动作和要讨论的要点、角度即可，不要冗长描述
- 每个要点控制在10-15字以内，例如："用户需求分析"、"运营策略设计"、"技术方案评估"等
- 问题部分的4个要点必须针对${jobTitle}岗位的核心能力要求，体现该岗位在${company}的实际工作职责
- 题目要有实战性，避免过于理论化或抽象化
- 时间分配要合理，总时长控制在30-40分钟

请确保题目充分体现${company}的业务特色和${jobTitle}岗位的专业要求，让候选人能够展示与岗位高度匹配的能力。`;

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