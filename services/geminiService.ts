import { Message, Character, FeedbackData } from "../types";
import { SYSTEM_PROMPT_BASE, USER_INFO } from "../constants";

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

/**
 * 获取 DeepSeek API Key（与 callDeepSeekAPI 一致）
 */
function getDeepSeekApiKey(): string {
  let apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey && typeof window !== 'undefined' && (window as any).__DEEPSEEK_API_KEY__) {
    apiKey = (window as any).__DEEPSEEK_API_KEY__;
  }
  if (!apiKey) {
    console.warn('⚠️ 环境变量未设置，使用硬编码的 API Key（仅用于开发测试）');
    apiKey = 'sk-84606ff70f2d44f992e1d3cce2851818';
  }
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY 环境变量未设置");
  }
  return apiKey;
}

/**
 * 流式调用 DeepSeek API，通过 onChunk 逐段回调内容
 * @param prompt - 输入的提示词
 * @param temperature - 温度参数
 * @param onChunk - 每收到一段内容时调用
 * @returns 累积的完整文本
 */
async function callDeepSeekAPIStream(
  prompt: string,
  temperature: number,
  onChunk: (chunk: string) => void
): Promise<string> {
  const apiKey = getDeepSeekApiKey();
  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "未知错误");
    throw new Error(`DeepSeek API 请求失败: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("DeepSeek API 响应体不可读");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") return full;
          try {
            const data = JSON.parse(payload);
            const content = data.choices?.[0]?.delta?.content;
            if (typeof content === "string") {
              full += content;
              onChunk(content);
            }
          } catch {
            // 忽略单条解析失败
          }
        }
      }
    }
    return full;
  } finally {
    reader.releaseLock();
  }
}

export async function generateAIReply(
  character: Character,
  topic: string,
  jobTitle: string,
  history: Message[],
  phase: string,
  summaryGuided?: boolean,
  summaryVolunteered?: boolean,
  currentKeyPoint?: string | null,
  keyPointDiscussionCount?: number,
  allKeyPointsDiscussed?: boolean,
  allKeyPoints?: string[],
  currentKeyPointIndex?: number
): Promise<string> {
  try {
    // 从题目中提取核心要点
    const extractKeyPoints = (topicText: string): string[] => {
      const keyPoints: string[] = [];
      
      // 查找"核心要点"或"要点"部分
      const pointsMatch = topicText.match(/核心要点[：:]\s*([\s\S]*?)(?=\n\n|\n三、|$)/);
      if (pointsMatch) {
        const pointsText = pointsMatch[1];
        // 匹配数字开头的要点，如"1、用户行为与竞品分析"
        const pointRegex = /\d+[、.]\s*([^0-9\n]+)/g;
        let match;
        while ((match = pointRegex.exec(pointsText)) !== null) {
          const point = match[1].trim();
          // 如果要点包含"与"或"和"，拆分成多个关键词
          if (point.includes('与') || point.includes('和')) {
            const parts = point.split(/[与和]/).map(p => p.trim());
            keyPoints.push(...parts);
          } else {
            keyPoints.push(point);
          }
        }
      }
      
      // 如果没有找到，尝试查找"问题"部分
      if (keyPoints.length === 0) {
        const problemMatch = topicText.match(/问题[：:]\s*([\s\S]*?)(?=\n\n|\n三、|$)/);
        if (problemMatch) {
          const problemText = problemMatch[1];
          const pointRegex = /\d+[、.]\s*([^0-9\n]+)/g;
          let match;
          while ((match = pointRegex.exec(problemText)) !== null) {
            const point = match[1].trim();
            if (point.includes('与') || point.includes('和')) {
              const parts = point.split(/[与和]/).map(p => p.trim());
              keyPoints.push(...parts);
            } else {
              keyPoints.push(point);
            }
          }
        }
      }
      
      return keyPoints;
    };
    
    const topicKeyPoints = extractKeyPoints(topic);
    
    // 使用传入的核心要点信息（如果提供）
    const effectiveKeyPoints = allKeyPoints && allKeyPoints.length > 0 ? allKeyPoints : topicKeyPoints;
    const effectiveCurrentKeyPoint = currentKeyPoint || (effectiveKeyPoints.length > 0 && typeof currentKeyPointIndex === 'number' && currentKeyPointIndex < effectiveKeyPoints.length ? effectiveKeyPoints[currentKeyPointIndex] : null);
    const effectiveDiscussionCount = typeof keyPointDiscussionCount === 'number' ? keyPointDiscussionCount : 0;
    const effectiveAllKeyPointsDiscussed = typeof allKeyPointsDiscussed === 'boolean' ? allKeyPointsDiscussed : false;
    const effectiveCurrentKeyPointIndex = typeof currentKeyPointIndex === 'number' ? currentKeyPointIndex : 0;
    
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
    
    // 检查是否已经有人提出时间分配（开局框架阶段）
    const hasTimeAllocation = recentHistory.some(m => {
      const content = m.content;
      return (content.includes('分钟') || content.includes('时间') || content.includes('分配')) &&
             (content.includes('讨论') || content.includes('分析') || content.includes('阅读') || content.includes('汇报'));
    });
    
    // 检查是否已经有人说过类似的评价性语句（如"XXX提到的XXX，都是/是XXX的好方向"）
    const hasEvaluativeStatement = recentHistory.some(m => {
      const content = m.content;
      // 匹配类似"XXX提到的XXX，都是/是XXX的好方向"的句式
      const evaluativePatterns = [
        /提到的.*都是.*好方向/,
        /提到的.*是.*好方向/,
        /说的.*都是.*好方向/,
        /说的.*是.*好方向/,
        /提到的.*都很好/,
        /说的.*都很好/,
        /提到的.*很好/,
        /说的.*很好/,
        /提到的.*是解决.*的好方向/,
        /说的.*是解决.*的好方向/
      ];
      return evaluativePatterns.some(pattern => pattern.test(content));
    });
    
    // 检查是否已经有人说过"按题目顺序"、"我赞同按题目顺序"等表达
    const hasTopicOrderMentioned = recentHistory.some(m => {
      const content = m.content;
      return (content.includes('按题目顺序') || content.includes('按题目') || content.includes('按顺序')) &&
             (content.includes('讨论') || content.includes('推进') || content.includes('进行'));
    });
    
    // 检查用户是否提出了具体的决策路径、框架或方案
    const userHasSpecificContent = recentHistory.some(m => {
      if (m.senderId !== 'user') return false;
      const content = m.content;
      // 检查是否包含具体的路径、框架、方案等
      return (content.includes('路径') || content.includes('流程') || content.includes('步骤') || 
              content.includes('框架') || content.includes('方案') || content.includes('策略')) &&
             content.length > 30; // 确保是具体的内容，不是简单的一句话
    });
    
    // 获取用户最近提出的具体内容
    const userSpecificMessage = recentHistory.slice().reverse().find(m => {
      if (m.senderId !== 'user') return false;
      const content = m.content;
      return (content.includes('路径') || content.includes('流程') || content.includes('步骤') || 
              content.includes('框架') || content.includes('方案') || content.includes('策略')) &&
             content.length > 30;
    });
    
    // 检查是否有人自荐汇报
    const hasVolunteered = recentHistory.some(m => 
      m.content.includes('我来总结') || 
      m.content.includes('我来汇报') || 
      m.content.includes('我来说') ||
      m.content.includes('我来')
    );
    
    // 检查最近发言中是否有人已经引导到下一部分/阶段
    const hasGuidanceToNextPart = recentHistory.some(m => {
      const content = m.content;
      return (content.includes('接下来') || content.includes('现在') || content.includes('应该') || content.includes('进入')) &&
             (content.includes('讨论') || content.includes('规划') || content.includes('设计') || content.includes('分析') || 
              content.includes('策略') || content.includes('方案') || content.includes('框架'));
    });
    
    // 获取最近引导到下一部分的发言内容
    const guidanceMessage = recentHistory.slice().reverse().find(m => {
      const content = m.content;
      return (content.includes('接下来') || content.includes('现在') || content.includes('应该') || content.includes('进入')) &&
             (content.includes('讨论') || content.includes('规划') || content.includes('设计') || content.includes('分析') || 
              content.includes('策略') || content.includes('方案') || content.includes('框架'));
    });
    
    // 获取最近1-2个发言者的内容
    const lastTwoMessages = recentHistory.slice(-2);
    const lastTwoSpeakers = lastTwoMessages.map(m => ({
      name: m.senderName,
      content: m.content,
      id: m.senderId
    }));
    
    if (isLastSpeakerUser) {
      // 获取用户的具体发言内容
      const userMessageContent = lastMessage ? lastMessage.content : '';
      
      // 获取倒数第二个发言者（如果有）
      const secondLastMessage = recentHistory.length >= 2 ? recentHistory[recentHistory.length - 2] : null;
      const secondLastSpeaker = secondLastMessage ? secondLastMessage.senderName : null;
      const secondLastContent = secondLastMessage ? secondLastMessage.content : null;
      
      // 检查用户是否提出了具体的决策路径、框架或方案
      const userHasPath = userMessageContent.includes('路径') || userMessageContent.includes('流程') || userMessageContent.includes('步骤');
      const userHasFramework = userMessageContent.includes('框架') || userMessageContent.includes('方案') || userMessageContent.includes('策略');
      const userHasSpecific = userHasPath || userHasFramework;
      
      let specificResponseHint = '';
      if (userHasSpecific) {
        if (userHasPath) {
          specificResponseHint = `\n【关键要求】用户提出了具体的决策路径："${userMessageContent}"。你必须针对这个路径进行回应：
- **不能只说"我赞同"**，必须针对这个路径进行分析、补充、细化或提出不同角度
- **必须给出实质性反馈**，例如：分析这个路径的合理性、补充遗漏的环节、提出优化建议、或从不同角度提出观点
- 这是群面讨论，你必须回应用户提出的具体路径，不能忽略或简单附和`;
        } else if (userHasFramework) {
          specificResponseHint = `\n【关键要求】用户提出了具体的框架/方案："${userMessageContent}"。你必须针对这个框架/方案进行回应：
- **不能只说"我赞同"**，必须针对这个框架/方案进行分析、补充、细化或提出不同角度
- **必须给出实质性反馈**，例如：分析这个框架的合理性、补充遗漏的要点、提出优化建议、或从不同角度提出观点
- 这是群面讨论，你必须回应用户提出的具体框架/方案，不能忽略或简单附和`;
        }
      }
      
      if (isOpeningPhase) {
        contextHint = `\n【核心要求】上一个发言者是用户（考生）${lastSpeaker}，他说了："${userMessageContent}"。${secondLastSpeaker ? `倒数第二个发言者是${secondLastSpeaker}，他说了："${secondLastContent}"。` : ''}当前是开局框架阶段。你必须基于前述1-2个发言者的具体内容进行回应：
${specificResponseHint}
- **必须引用前述发言者的具体观点**，不能自说自话
- 如果用户提出了框架，你可以在此基础上补充、细化或提出不同角度的框架
- 如果用户提出了观点，你可以同意并推进，或质疑后提出自己的框架思路
- ${secondLastSpeaker ? `同时要考虑${secondLastSpeaker}的观点，综合回应` : ''}
- 不能只说"我同意"，必须针对具体内容做出实质性回应，提出有观点和内容的有效发言
- 必须符合当前阶段（开局框架阶段）的特点
这是群面讨论，你必须回应用户的发言内容，不能忽略他。`;
      } else {
        contextHint = `\n【核心要求】上一个发言者是用户（考生）${lastSpeaker}，他说了："${userMessageContent}"。${secondLastSpeaker ? `倒数第二个发言者是${secondLastSpeaker}，他说了："${secondLastContent}"。` : ''}你必须基于前述1-2个发言者的具体内容进行回应：
${specificResponseHint}
- **必须引用前述发言者的具体观点**，不能自说自话
- **同意并推进**：如果你同意他的观点，要在此基础上推进讨论，提出下一步或延伸思考
- **质疑后提出观点**：如果你不同意或认为有问题，要明确指出问题所在，然后提出自己的观点
- **补充**：如果你认为他的观点不完整，要补充具体的细节或角度
- ${secondLastSpeaker ? `同时要考虑${secondLastSpeaker}的观点，综合回应` : ''}
- 不能只说"我同意"或"我反对"，必须针对具体内容做出实质性回应，提出有观点和内容的有效发言
- 必须符合当前阶段的特点
这是群面讨论，你必须回应用户的发言内容，不能忽略他。`;
      }
    } else if (isLastSpeakerSelf) {
      // 如果上一个发言者是自己，必须基于倒数第二个发言者的内容
      const secondLastMessage = recentHistory.length >= 2 ? recentHistory[recentHistory.length - 2] : null;
      const secondLastSpeaker = secondLastMessage ? secondLastMessage.senderName : null;
      const secondLastContent = secondLastMessage ? secondLastMessage.content : null;
      
      if (secondLastMessage) {
        contextHint = `\n【核心要求】上一个发言者是你自己，你不能同意自己的观点。你必须基于倒数第二个发言者${secondLastSpeaker}的发言内容进行回应："${secondLastContent}"。请针对他的具体观点进行回应，提出有观点和内容的有效发言，必须符合当前阶段的特点。`;
      } else {
        contextHint = `\n重要：上一个发言者是你自己，你不能同意自己的观点。请针对讨论中其他人的观点进行回应，或者提出新的角度。`;
      }
    } else if (lastSpeaker) {
      // 获取倒数第二个发言者（如果有）
      const secondLastMessage = recentHistory.length >= 2 ? recentHistory[recentHistory.length - 2] : null;
      const secondLastSpeaker = secondLastMessage ? secondLastMessage.senderName : null;
      const secondLastContent = secondLastMessage ? secondLastMessage.content : null;
      
      if (isOpeningPhase) {
        contextHint = `\n【核心要求】上一个发言者是${lastSpeaker}，他说了："${lastMessage.content}"。${secondLastSpeaker ? `倒数第二个发言者是${secondLastSpeaker}，他说了："${secondLastContent}"。` : ''}当前是开局框架阶段。你必须基于前述1-2个发言者的具体内容进行回应：
- **必须引用前述发言者的具体观点**，不能自说自话
- 不能只说"我同意"，要在此基础上提出框架思路、补充框架要点或提出不同角度的框架
- ${secondLastSpeaker ? `同时要考虑${secondLastSpeaker}的观点，综合回应` : ''}
- 必须提出有观点和内容的有效发言，符合当前阶段（开局框架阶段）的特点`;
      } else {
        contextHint = `\n【核心要求】上一个发言者是${lastSpeaker}，他说了："${lastMessage.content}"。${secondLastSpeaker ? `倒数第二个发言者是${secondLastSpeaker}，他说了："${secondLastContent}"。` : ''}你必须基于前述1-2个发言者的具体内容进行回应：
- **必须引用前述发言者的具体观点**，不能自说自话
- 请对他的发言做出回应，但要提出自己的见解
- ${secondLastSpeaker ? `同时要考虑${secondLastSpeaker}的观点，综合回应` : ''}
- 必须提出有观点和内容的有效发言，符合当前阶段的特点`;
      }
    }
    
    // 添加发言风格提示
    let guidanceHint = '';
    if (hasGuidanceToNextPart && guidanceMessage) {
      const guidanceContent = guidanceMessage.content;
      // 从题目的核心要点中匹配引导到的部分
      let nextPart = '';
      
      // 遍历题目的核心要点，查找发言内容中是否包含这些要点
      for (const keyPoint of topicKeyPoints) {
        if (guidanceContent.includes(keyPoint)) {
          nextPart = keyPoint;
          break; // 找到第一个匹配的要点就停止
        }
      }
      
      // 如果没有找到精确匹配，尝试部分匹配（包含关系）
      if (!nextPart && topicKeyPoints.length > 0) {
        for (const keyPoint of topicKeyPoints) {
          // 检查发言内容是否包含要点的关键词
          const keyWords = keyPoint.split(/[与和、，,]/).map(w => w.trim()).filter(w => w.length > 1);
          for (const word of keyWords) {
            if (guidanceContent.includes(word)) {
              nextPart = keyPoint;
              break;
            }
          }
          if (nextPart) break;
        }
      }
      
      if (nextPart) {
        guidanceHint = `\n【重要】前面的发言者（${guidanceMessage.senderName}）已经引导到"${nextPart}"的讨论，并进行了总结。你不需要：
- 重复总结前面的内容（如"我们已经明确了..."、"刚才的思路很清晰"等）
- 重复引导性话语（如"接下来我们应该..."、"现在进入..."等）
- 重复评价性话语（如"XXX的思路很清晰"等）
你应该直接针对"${nextPart}"的具体内容进行发言，提出自己的观点、建议或补充，直接切入主题。`;
      } else {
        guidanceHint = `\n【重要】前面的发言者（${guidanceMessage.senderName}）已经引导到下一部分的讨论。你不需要重复引导和总结性话语，应该直接进入该部分的讨论，提出具体的观点和建议。`;
      }
    }
    
    const styleHint = `
发言风格要求：
- **避免固定句式**：不要总是用"我同意XXX的观点"、"我反对XXX"、"我要补充XXX"这种固定开头
- **使用自然表达**：可以直接说"我也赞同，我补充一点..."、"我认为..."、"从另一个角度看..."、"这里有个问题..."等
- **可以直接说观点**：不需要每次都先表态，可以直接切入主题
- **禁止重复内容**：前述发言人已经说过的内容，你不能重复。你的发言中不能有连续的10个字与前述发言者完全一样。这适用于所有AI角色，必须严格遵守
- **特别禁止重复固定表达**：不能重复相同的表达，如"我赞同按题目顺序"、"按题目顺序推进"、"我赞同按题目顺序讨论"等。如果前面已经有人说过"按题目顺序"，你不需要再重复这个表达，应该直接提出分析框架和观点
- **特别禁止重复评价性语句**：不能重复相同的评价性语句，如"XXX提到的XXX确实是核心痛点"、"XXX的思路很清晰"等。如果前面已经有人说过类似的评价，你应该直接提出自己的观点，不要重复相同的评价
- **【关键禁止】禁止重复评价性句式**：如果前面已经有人说过类似"XXX提到的XXX，都是/是XXX的好方向"、"XXX的XXX都很好"这种评价性句式，你不能再重复这种句式。你应该直接提出自己的观点和建议，不要重复相同的评价性表达。例如，如果前面有人说"王敏提到的预设模板和张强说的A/B测试，都是优化配置复杂度的好方向"，你就不能再重复说"王敏的预设模板和智能推荐是解决配置复杂的好方向"或"王敏的预设模板和张强的A/B测试都很好"这种类似的评价性话语
- **避免重复引导和总结**：如果前面已经有人引导到下一部分/阶段并进行了总结，你应该直接进入该部分的讨论，不要重复引导性话语（如"接下来我们应该..."）、总结性话语（如"我们已经明确了..."）或评价性话语（如"XXX的思路很清晰"）
- **必须针对用户的具体内容进行回应**：如果用户提出了具体的决策路径、框架或方案，你不能只说"我赞同"，必须针对这个具体内容进行分析、补充、细化或提出不同角度，给出实质性反馈
- **内容简短有效**：控制在100字以内，内容要简短且有效，不要冗长
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
      
      // 检查是否有用户参与
      const hasUserParticipant = allParticipants.some(name => name === USER_INFO.name || name === USER_INFO.displayName);
      
      comprehensiveInteractionHint = `\n【重要】这是小组讨论，讨论历史中包含了以下参与者的发言：${participantList}。你在发言时：
- **必须回应前述发言者**，这是基本要求
- **同时要综合考虑其他所有参与者的观点**，体现出你在认真倾听所有人的发言
- **关键：不要用固定句式**：不要总是说"我同意XXX，也同意XXX的观点"这种固定句式
- **要有自己的分析和评判**：在综合考虑前述人的发言基础上，进行分析并给出自己的观点，要有自己的评判标准
- 可以自然地引用其他角色的观点作为分析的基础，例如"刚才${otherParticipants[0] || 'XX'}提到的...让我想到...，还有${otherParticipants[1] || 'XX'}说的...，从我的角度看..."，然后给出自己的分析和判断
- 要有自己的评判标准，对不同的观点进行分析、比较、筛选，然后提出自己的见解
- 让讨论更有互动性，不要只关注一个人，要体现出对整体讨论的关注
${hasUserParticipant ? `- **【关键】讨论历史中有用户（${USER_INFO.name}）的发言，你必须体现出对他的关注和回应，不能仅仅与其他AI角色互动**` : ''}`;
    }
    
    let userInteractionHint = '';
    if (hasUserInHistory) {
      // 获取用户的具体发言内容
      const userMessageContents = userMessages.map(m => m.content).join('；');
      
      // 检查用户是否提出了具体的决策路径、框架或方案
      const userHasSpecificContent = userMessages.some(m => {
        const content = m.content;
        return (content.includes('路径') || content.includes('流程') || content.includes('步骤') || 
                content.includes('框架') || content.includes('方案') || content.includes('策略')) &&
               content.length > 30;
      });
      
      const userSpecificMsg = userMessages.find(m => {
        const content = m.content;
        return (content.includes('路径') || content.includes('流程') || content.includes('步骤') || 
                content.includes('框架') || content.includes('方案') || content.includes('策略')) &&
               content.length > 30;
      });
      
      if (isLastSpeakerUser) {
        // 如果上一个发言者是用户，必须针对他的发言进行回应
        let specificHint = '';
        if (userHasSpecificContent && userSpecificMsg) {
          if (userSpecificMsg.content.includes('路径')) {
            specificHint = `\n【关键要求】用户提出了具体的决策路径："${userSpecificMsg.content}"。你必须针对这个路径进行回应：
- **不能只说"我赞同"**，必须针对这个路径进行分析、补充、细化或提出不同角度
- **必须给出实质性反馈**，例如：分析这个路径的合理性、补充遗漏的环节、提出优化建议、或从不同角度提出观点`;
          } else if (userSpecificMsg.content.includes('框架') || userSpecificMsg.content.includes('方案')) {
            specificHint = `\n【关键要求】用户提出了具体的框架/方案："${userSpecificMsg.content}"。你必须针对这个框架/方案进行回应：
- **不能只说"我赞同"**，必须针对这个框架/方案进行分析、补充、细化或提出不同角度
- **必须给出实质性反馈**，例如：分析这个框架的合理性、补充遗漏的要点、提出优化建议、或从不同角度提出观点`;
          }
        }
        
        userInteractionHint = `\n【核心要求】上一个发言者是用户（考生）${USER_INFO.name}，他说了："${userMessageContents}"。你必须针对他的具体发言内容进行回应：
${specificHint}
- **同意并推进**：如果你同意他的观点，要在此基础上推进讨论，提出下一步或延伸思考
- **质疑后提出观点**：如果你不同意或认为有问题，要明确指出问题所在，然后提出自己的观点
- **补充**：如果你认为他的观点不完整，要补充具体的细节或角度
- 不能只说"我同意"或"我反对"，必须针对他的具体内容做出实质性回应
- 这是群面讨论，你必须回应用户的发言内容，不能忽略他。`;
      } else {
        // 如果历史中有用户发言，但上一个发言者不是用户，必须提醒AI也要关注用户的观点
        let specificHint = '';
        if (userHasSpecificContent && userSpecificMsg) {
          specificHint = `\n【特别提醒】用户提出了具体的${userSpecificMsg.content.includes('路径') ? '决策路径' : '框架/方案'}："${userSpecificMsg.content}"。即使上一个发言者不是用户，你也应该在回应中体现出对这个具体内容的关注和反馈，不能忽略。`;
        }
        
        userInteractionHint = `\n【关键要求】讨论历史中包含用户（考生）${USER_INFO.name}的发言："${userMessageContents}"。即使上一个发言者不是用户，你也必须：
${specificHint}
- **在回应中体现出对用户观点的关注和回应**，不能仅仅与其他AI角色互动
- **禁止**：三个AI角色之间互相同意和质疑，而完全忽略用户的发言
- 这是群面讨论，所有参与者都应该互相回应，**特别是要回应用户的发言**
- 你可以在回应上一个发言者的同时，自然地引用用户的观点，例如"刚才${USER_INFO.name}提到的...，结合上一个发言者的观点，我认为..."，然后给出自己的分析和判断`;
      }
    }
    
    // 阶段特定提示词（严格遵循constants.ts中定义的阶段原则）
    let phaseSpecificHint = '';
    
    if (isOpeningPhase) {
      // 开局框架阶段
      let timeAllocationHint = '';
      if (hasTimeAllocation) {
        timeAllocationHint = `\n【重要】前面已经有人提出了时间分配方案，你不需要再提出时间分配。你应该直接提出分析框架和观点，或者对已有的框架进行补充和细化。`;
      } else {
        timeAllocationHint = `\n【可选】如果还没有人提出时间分配，你可以提出时间分配方案。但这不是必须的，你也可以直接提出分析框架和观点。`;
      }
      
      let topicOrderHint = '';
      if (hasTopicOrderMentioned) {
        topicOrderHint = `\n【禁止重复】前面已经有人说过"按题目顺序"、"按题目顺序讨论"等表达，你不需要再重复这个表达。你应该直接提出分析框架和观点，或者对已有的框架进行补充和细化。不要说"我赞同按题目顺序"、"我也赞同按题目顺序推进"等无效发言。`;
      }
      
      let userContentHint = '';
      if (userHasSpecificContent && userSpecificMessage) {
        userContentHint = `\n【关键要求】用户（${userSpecificMessage.senderName}）提出了具体的${userSpecificMessage.content.includes('路径') ? '决策路径' : userSpecificMessage.content.includes('框架') ? '分析框架' : '方案'}："${userSpecificMessage.content}"。你必须针对这个具体内容进行回应：
- **不能只说"我赞同"**，必须针对用户提出的具体内容进行分析、补充、细化或提出不同角度
- **必须给出实质性反馈**，例如：分析这个路径/框架的合理性、补充遗漏的环节、提出优化建议、或从不同角度提出观点
- 这是群面讨论，你必须回应用户提出的具体内容，不能忽略或简单附和`;
      }
      
      let evaluativeStatementHint = '';
      if (hasEvaluativeStatement) {
        evaluativeStatementHint = `\n【禁止重复评价】前面已经有人说过类似"XXX提到的XXX，都是/是XXX的好方向"这种评价性句式，你不能再重复这种句式。你应该直接提出自己的观点和建议，不要重复相同的评价性表达。`;
      }
      
      phaseSpecificHint = `\n【阶段要求：开局框架阶段 - 必须严格遵守】
- **发言的关键是提出整体分析框架**，例如按照什么顺序来分析，然后发表自己的观点
${timeAllocationHint}
${topicOrderHint}
${userContentHint}
${evaluativeStatementHint}
- 如果前面有人已经提出框架，你可以在此基础上补充、细化或提出不同角度的框架
- **这个阶段的核心任务是建立讨论的基础框架**
- **重要**：如果是第一个发言者，绝对不能使用"刚才"、"大家提到"、"前面说的"等表达，因为之前没有任何讨论内容
- 你的发言必须符合开局框架阶段的特点，不能偏离到其他阶段的内容`;
    } else if (isDeepPhase) {
      // 深入讨论与方案贡献
      let evaluativeStatementHint = '';
      if (hasEvaluativeStatement) {
        evaluativeStatementHint = `\n【禁止重复评价】前面已经有人说过类似"XXX提到的XXX，都是/是XXX的好方向"这种评价性句式，你不能再重复这种句式。你应该直接提出自己的观点和建议，不要重复相同的评价性表达。`;
      }
      
      // 核心要点讨论流程控制
      let keyPointControlHint = '';
      if (effectiveKeyPoints.length > 0) {
        if (effectiveAllKeyPointsDiscussed) {
          // 所有要点都已讨论完，可以引导总结
          keyPointControlHint = `\n【核心要点讨论状态】所有核心要点（${effectiveKeyPoints.join('、')}）都已经讨论完毕。现在可以引导大家进行总结，或者对讨论内容进行整合。`;
        } else if (effectiveCurrentKeyPoint) {
          // 当前正在讨论某个要点
          const remainingCount = 10 - effectiveDiscussionCount;
          if (remainingCount <= 0) {
            // 当前要点讨论次数已达上限，需要引导到下一个要点
            const nextKeyPointIndex = effectiveCurrentKeyPointIndex + 1;
            if (nextKeyPointIndex < effectiveKeyPoints.length) {
              const nextKeyPoint = effectiveKeyPoints[nextKeyPointIndex];
              keyPointControlHint = `\n【核心要点讨论状态】当前要点"${effectiveCurrentKeyPoint}"的讨论次数已达上限（10次）。你需要引导大家进入下一个要点"${nextKeyPoint}"的讨论。可以说"关于${effectiveCurrentKeyPoint}我们已经讨论得差不多了，接下来我们讨论${nextKeyPoint}"或类似的话。`;
            } else {
              // 这是最后一个要点，讨论完后可以引导总结
              keyPointControlHint = `\n【核心要点讨论状态】当前要点"${effectiveCurrentKeyPoint}"的讨论次数已达上限（10次）。这是最后一个要点，讨论完后可以引导大家进行总结。`;
            }
          } else {
            // 当前要点还在讨论中
            keyPointControlHint = `\n【核心要点讨论状态】当前正在讨论要点"${effectiveCurrentKeyPoint}"（已讨论${effectiveDiscussionCount}次，最多10次）。请继续针对这个要点提出观点和建议。`;
          }
        } else {
          // 还没有开始讨论要点，或者要点讨论已结束
          if (effectiveCurrentKeyPointIndex < effectiveKeyPoints.length) {
            const nextKeyPoint = effectiveKeyPoints[effectiveCurrentKeyPointIndex];
            keyPointControlHint = `\n【核心要点讨论状态】需要开始讨论要点"${nextKeyPoint}"。请针对这个要点提出观点和建议。`;
          }
        }
      }
      
      phaseSpecificHint = `\n【阶段要求：深入讨论与方案贡献 - 必须严格遵守】
- **提出自己的观点**，分析和评判其他人的观点，推进讨论
- **必须针对具体问题提出建设性观点**，推动整体方案向前发展
- 可以质疑、补充、延伸他人的观点，但要提出自己的见解
- **关注方案的可行性和完整性**，为整体方案贡献具体内容
- **针对其他人的观点进行分析和评判**，选取合适的，去掉不合适的
${evaluativeStatementHint}
${keyPointControlHint}
- 你的发言必须符合深入讨论与方案贡献阶段的特点，不能偏离到其他阶段的内容`;
    } else if (isSummaryPhase) {
      // 引导与总结陈词
      let summaryControlHint = '';
      if (effectiveKeyPoints.length > 0 && !effectiveAllKeyPointsDiscussed) {
        // 还有要点未讨论完，不能引导总结
        const remainingKeyPoints = effectiveKeyPoints.slice(effectiveCurrentKeyPointIndex);
        summaryControlHint = `\n【重要限制】核心要点还没有全部讨论完。还有以下要点需要讨论：${remainingKeyPoints.join('、')}。你不能引导总结，应该继续讨论这些要点。`;
      }
      
      if (isStructuredRole && !hasSummaryGuidance) {
        // 枢纽型角色在总结阶段，如果还没有引导总结，应该引导
        if (effectiveAllKeyPointsDiscussed || effectiveKeyPoints.length === 0) {
          // 所有要点都已讨论完，可以引导总结
          phaseSpecificHint = `\n【阶段要求：引导与总结陈词 - 必须严格遵守】
- **你是枢纽型角色**，在所有问题都讨论完后，主动引导大家进行总结
- 可以说"我们讨论得差不多了，现在需要有人来总结一下我们的讨论内容，谁愿意来汇报？"或类似的话
- **对观点进行整合**，把深入讨论阶段讨论的内容梳理清楚，确保不遗漏重要细节
- 你的发言必须符合引导与总结陈词阶段的特点`;
        } else {
          // 还有要点未讨论完，不能引导总结
          phaseSpecificHint = `\n【阶段要求：引导与总结陈词 - 必须严格遵守】
${summaryControlHint}
- **你是枢纽型角色**，但核心要点还没有全部讨论完，不能引导总结
- 应该继续讨论剩余的要点，或者引导大家进入下一个要点的讨论
- 你的发言必须符合当前阶段的特点`;
        }
      } else if (hasSummaryGuidance && !hasVolunteered && !summaryVolunteered) {
        // 已经引导总结，但还没有人自荐，当前角色可以自荐
        phaseSpecificHint = `\n【阶段要求：引导与总结陈词 - 必须严格遵守】
- **已经有人引导总结**，但还没有人自荐汇报
- 你可以自荐进行汇报，说"我来总结一下"或"我来汇报"等
- **如果自荐，你需要对前述整体的讨论内容进行总结**，并用有条理的方式呈现和表述出来
- **对观点进行整合**，把深入讨论阶段讨论的内容梳理清楚，确保不遗漏重要细节
- 如果是汇报者，要清晰有逻辑地汇报出来，用有条理的方式呈现讨论结果
- 你的发言必须符合引导与总结陈词阶段的特点`;
      } else if (hasVolunteered || summaryVolunteered) {
        // 已经有人自荐汇报，当前角色可以补充或同意
        phaseSpecificHint = `\n【阶段要求：引导与总结陈词 - 必须严格遵守】
- **已经有人自荐进行总结汇报**
- 你可以对总结进行补充，指出遗漏的重要细节，或者简洁地表示同意
- **避免重复已经说过的内容**
- **对观点进行整合**，把深入讨论阶段讨论的内容梳理清楚，确保不遗漏重要细节
- 如果已经有人自荐汇报，其他角色可以确认共识，或提出总结的关键要点
- 你的发言必须符合引导与总结陈词阶段的特点`;
      } else {
        phaseSpecificHint = `\n【阶段要求：引导与总结陈词 - 必须严格遵守】
- **对观点进行整合**，把深入讨论阶段讨论的内容梳理清楚，确保不遗漏重要细节
- 如果是汇报者，要清晰有逻辑地汇报出来，用有条理的方式呈现讨论结果
- 你的发言必须符合引导与总结陈词阶段的特点`;
      }
    } else {
      // 最后补充与面试收尾
      phaseSpecificHint = `\n【阶段要求：最后补充与面试收尾 - 必须严格遵守】
- **针对汇报者已汇报的内容**，进行适当的补充，也可默认不补充，不再进行任何发言
- 可以指出汇报中的遗漏点，或简洁认同
- **引导面试结束**，避免重复已经说过的内容
- 你的发言必须符合最后补充与面试收尾阶段的特点`;
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
    ${phaseSpecificHint}
    ${comprehensiveInteractionHint}
    ${userInteractionHint}
    ${guidanceHint}
    ${styleHint}
    
    请发表你的言论：
    - **【最重要】必须严格遵守当前阶段（${phase}）的发言特点和要求**，不能偏离到其他阶段的内容。请仔细对照上面的阶段要求，确保你的发言完全符合。
    - ${isFirstSpeaker ? '你是第一个发言者，直接提出你的框架和观点，不要使用"刚才"、"大家提到"、"前面说的"等表达，因为之前没有任何讨论内容' : '【核心要求】必须基于前述1-2个发言者的具体发言内容进行回应，必须引用他们的具体观点，不能自说自话'}
    - ${isFirstSpeaker ? '' : '必须引用前述1-2个发言者的具体观点或内容，然后在此基础上提出自己的观点'}
    - ${isFirstSpeaker ? '' : '同时要综合考虑讨论历史中其他所有参与者的发言，体现出对整体讨论的关注'}
    - **重要**：不要用"我同意XXX，也同意XXX的观点"这种固定句式。可以直接说"我也赞同，我补充一点..."或"我认为..."，不需要每次都先说"我同意XXX的观点"
    - **【禁止重复 - 适用于所有AI角色】你的发言中不能有连续的10个字与前述发言者完全一样，不能重复前述发言人已经说过的内容。这包括：**
      * **绝对不能重复相同的固定表达**（如"我赞同按题目顺序"、"按题目顺序推进"、"我赞同按题目顺序讨论"等）。如果前面已经有人说过"按题目顺序"，你不需要再重复这个表达，应该直接提出分析框架和观点
      * **绝对不能重复相同的评价性语句**（如"XXX提到的XXX确实是核心痛点"、"XXX的思路很清晰"等）。如果前面已经有人说过类似的评价，你应该直接提出自己的观点，不要重复相同的评价
      * 不能重复相同的总结（如"我们已经明确了..."）
      * 不能重复相同的引导（如"接下来我们应该..."）
      * 如果前面已经有人引导到下一部分，你应该直接进入该部分的讨论，不要重复引导和总结性话语
    - ${isFirstSpeaker ? '直接提出整体分析框架，例如按照什么顺序来分析，以及进行时间分配，然后发表自己的观点' : '在综合考虑前述人的发言基础上，进行分析并给出自己的观点，要有自己的评判标准'}
    - ${isFirstSpeaker ? '' : '可以自然地引用其他角色的观点作为分析的基础，例如"刚才XX提到的...让我想到...，还有XX说的...，从我的角度看..."，然后给出自己的分析和判断'}
    - 要有自己的评判标准，对不同的观点进行分析、比较、筛选，然后提出自己的见解
    - **【有效性要求】必须是有观点和内容的有效发言**：
      * 不能只是简单附和或者质疑，必须提出具体的观点、分析或建议
      * **必须符合当前讨论阶段（${phase}）的特点和要求**，严格按照阶段原则发言
      * **【禁止重复】必须推动讨论向前发展，不能重复已经说过的内容。你的发言中不能有连续的10个字与前述发言者完全一样**
      * **特别禁止重复评价性语句**：绝对不能重复相同的评价性语句，如"XXX提到的XXX确实是核心痛点"、"XXX的思路很清晰"等。如果前面已经有人说过类似的评价，你应该直接提出自己的观点，不要重复相同的评价
      * 发言要有实质性内容，不能空洞无物，控制在100字以内
    - 使用自然真实的表达方式
    - **【关键要求】如果讨论历史中有用户（${USER_INFO.name}）的发言，你必须在他的发言基础上进行回应，不能仅仅与其他AI角色互动而忽略用户的发言**
    - **【阶段原则检查】在生成回复前，请确认你的发言完全符合当前阶段（${phase}）的要求，如果不符合，请重新调整。这是强制要求，必须严格遵守。**
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

/**
 * 流式生成群面题目，每收到一段内容即通过 onChunk 回调；流结束后返回清理后的完整文本
 */
export async function generateTopicStream(
  company: string,
  jobTitle: string,
  onChunk: (chunk: string) => void
): Promise<string> {
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

  try {
    const full = await callDeepSeekAPIStream(prompt, 0.7, onChunk);
    return full.replace(/[*#`>]/g, '').trim() || "题目生成失败，请手动输入。";
  } catch (error) {
    console.error("生成题目失败:", error);
    throw error;
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