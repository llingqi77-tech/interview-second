import React, { useState, useEffect, useRef } from 'react';
import { Character, Message, SimulationState } from '../types';
import { CHARACTERS, USER_INFO } from '../constants';
import { generateAIReply } from '../services/geminiService';
import CharacterCard from './CharacterCard';

interface DiscussionPanelProps {
  state: SimulationState;
  onFinish: (messages: Message[]) => void;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const DiscussionPanel: React.FC<DiscussionPanelProps> = ({ state, onFinish }) => {
  const [messages, setMessages] = useState<Message[]>(state.messages);
  const [activeCharId, setActiveCharId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [round, setRound] = useState(0);
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showTopic, setShowTopic] = useState(true);
  const [userClickedMic, setUserClickedMic] = useState(false);
  const [summaryGuided, setSummaryGuided] = useState(false); // 是否已经引导总结
  const [summaryVolunteered, setSummaryVolunteered] = useState(false); // 是否有人自荐汇报
  const [summaryCompleted, setSummaryCompleted] = useState(false); // 是否已经完成总结汇报
  const [currentPhase, setCurrentPhase] = useState<string>("开局框架阶段"); // 当前阶段，按顺序推进
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const firstTurnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const micCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 用于平衡 AI 发言占比的洗牌队列
  const aiPoolRef = useRef<string[]>([]);

  const MAX_ROUNDS = 25;

  // 阶段定义（按顺序）
  const PHASES = [
    "开局框架阶段",
    "深入讨论与方案贡献",
    "引导与总结陈词",
    "最后补充与面试收尾"
  ];

  // 基于讨论内容动态判断阶段（按顺序推进，不能回退或跳过）
  const getDiscussionPhase = () => {
    if (messages.length === 0) {
      return "开局框架阶段";
    }

    let newPhase = currentPhase; // 默认保持当前阶段

    // 分析最近的消息内容来判断是否可以推进到下一个阶段
    const recentMessages = messages.slice(-8); // 分析最近8条消息
    const allMessages = messages;

    // 根据当前阶段，检查是否可以推进到下一个阶段
    switch (currentPhase) {
      case "开局框架阶段":
        // 检查是否有深入讨论的特征，可以推进到"深入讨论与方案贡献"
        const deepDiscussionKeywords = ['方案', '可行', '具体', '细节', '实施', '落地', '挑战', '问题', '建议', '观点', '认为', '补充', '分析', '评估', '考虑', '策略', '措施'];
        const hasDeepDiscussion = recentMessages.some(m => {
          const content = m.content;
          return deepDiscussionKeywords.some(keyword => content.includes(keyword)) &&
                 content.length > 40; // 较长的发言通常表示深入讨论
        });
        
        // 如果有多条消息且检测到深入讨论特征，推进到下一阶段
        if (messages.length >= 3 && hasDeepDiscussion) {
          newPhase = "深入讨论与方案贡献";
        }
        break;

      case "深入讨论与方案贡献":
        // 检查是否有人引导总结或自荐汇报，可以推进到"引导与总结陈词"
        const hasSummaryGuidance = allMessages.some(m => {
          const content = m.content;
          return (content.includes('总结') && (content.includes('汇报') || content.includes('谁愿意') || content.includes('谁来'))) ||
                 content.includes('我来总结') || 
                 content.includes('我来汇报') ||
                 content.includes('我来说');
        });

        // 或者讨论已经比较充分（消息多、参与者多），也可以推进
        const uniqueSpeakers = new Set(allMessages.map(m => m.senderId));
        const hasSufficientDiscussion = allMessages.length >= 10 && uniqueSpeakers.size >= 3;

        if (hasSummaryGuidance || hasSufficientDiscussion) {
          newPhase = "引导与总结陈词";
        }
        break;

      case "引导与总结陈词":
        // 检查是否已经完成总结汇报，可以推进到"最后补充与面试收尾"
        const hasCompletedSummary = allMessages.some(m => {
          const content = m.content;
          return (content.includes('总结') || content.includes('汇报')) && 
                 content.length > 100 && // 较长的总结内容
                 (content.includes('第一') || content.includes('第二') || content.includes('第三') || 
                  content.includes('首先') || content.includes('其次') || content.includes('最后') ||
                  content.includes('方面') || content.includes('要点') || content.includes('综上所述'));
        });

        if (hasCompletedSummary) {
          newPhase = "最后补充与面试收尾";
        }
        break;

      case "最后补充与面试收尾":
        // 已经是最后阶段，不再推进
        newPhase = "最后补充与面试收尾";
        break;
    }

    // 更新当前阶段（如果推进了）
    if (newPhase !== currentPhase) {
      setCurrentPhase(newPhase);
    }

    return newPhase;
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isTyping]);

  // 当消息为空时，重置阶段为开局框架阶段
  useEffect(() => {
    if (messages.length === 0) {
      setCurrentPhase("开局框架阶段");
    }
  }, [messages.length]);

  // Fix: Set up speech recognition lifecycle handlers to keep isListening state in sync
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'zh-CN';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript;
          }
        }
        if (finalText) setInputValue(prev => prev + finalText);
      };
      recognitionRef.current = recognition;
    }

    // 5秒倒计时：如果用户没有点击麦克风，AI先发言
    micCheckTimeoutRef.current = setTimeout(() => {
      if (messages.length === 0 && !userClickedMic) {
        // 用户5秒内没有点击麦克风，AI抢先发言
        const char = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
        triggerAITurn(char);
      }
    }, 5000);

    return () => {
      if (firstTurnTimeoutRef.current) clearTimeout(firstTurnTimeoutRef.current);
      if (micCheckTimeoutRef.current) clearTimeout(micCheckTimeoutRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  // 获取下一个平衡随机的 AI 发言者
  const getBalancedNextSpeaker = (currentId: string) => {
    if (aiPoolRef.current.length === 0) {
      // 重新洗牌所有 AI 角色
      aiPoolRef.current = CHARACTERS.map(c => c.id).sort(() => Math.random() - 0.5);
    }
    
    // 确保不和当前发言者连续（如果池子里还有其他人的话）
    let nextIndex = 0;
    if (aiPoolRef.current[nextIndex] === currentId && aiPoolRef.current.length > 1) {
      nextIndex = 1;
    }
    
    const nextId = aiPoolRef.current.splice(nextIndex, 1)[0];
    return CHARACTERS.find(c => c.id === nextId)!;
  };

  const addMessage = (senderId: string, senderName: string, content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      senderId,
      senderName,
      content,
      timestamp: Date.now(),
      type: 'message'
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  };

  // 根据文本长度计算合理的说话时间（人类平均语速：每分钟150-200字，约每秒2.5-3.3字）
  const calculateSpeakingTime = (text: string): number => {
    const charCount = text.length;
    const wordsPerSecond = 2.8; // 每秒约2.8字（取中间值）
    const baseTime = (charCount / wordsPerSecond) * 1000; // 转换为毫秒
    // 最小说话时间800ms，最大说话时间5000ms
    return Math.max(800, Math.min(5000, baseTime));
  };

  const triggerAITurn = async (char: Character) => {
    if (round >= MAX_ROUNDS) return;

    setRound(prev => prev + 1);
    setActiveCharId(char.id);
    setIsTyping(true);

    try {
      const phase = getDiscussionPhase();
      const text = await generateAIReply(char, state.topic, state.jobTitle, messages, phase, summaryGuided, summaryVolunteered);
      
      // 检查是否是枢纽型引导总结
      if (char.role === 'STRUCTURED' && phase.includes('总结') && !summaryGuided) {
        const hasGuidance = text.includes('总结') && (text.includes('汇报') || text.includes('谁愿意') || text.includes('谁来'));
        if (hasGuidance) {
          setSummaryGuided(true);
        }
      }
      
      // 检查是否有人自荐汇报
      if (!summaryVolunteered && (text.includes('我来总结') || text.includes('我来汇报') || text.includes('我来说'))) {
        setSummaryVolunteered(true);
      }
      
      // 根据文本长度计算合理的说话时间
      // 如果是总结汇报，给予更多时间（总结通常较长）
      const isSummaryReport = summaryVolunteered && (text.length > 100 || text.includes('总结') || text.includes('汇报'));
      const baseSpeakingTime = calculateSpeakingTime(text);
      const speakingTime = isSummaryReport ? baseSpeakingTime * 1.5 : baseSpeakingTime;
      
      // 等待说话时间，然后显示消息
      setTimeout(() => {
        setIsTyping(false);
        addMessage(char.id, char.name, text);
        setActiveCharId(null);
        
        // 如果完成了总结汇报，标记为完成
        if (summaryVolunteered && text.length > 100) {
          setSummaryCompleted(true);
        }

        // AI 发言后的响应逻辑
        // 检查上一个发言者是谁
        const lastMessage = messages[messages.length - 1];
        const isUserLastSpeaker = lastMessage && lastMessage.senderId === 'user';
        
        if (isUserLastSpeaker) {
          // 如果上一个发言者是用户，AI必须回应（100%概率）
          // 但当前AI已经发言了，所以不需要再触发
          // 这个逻辑已经在用户发言后的handleSendMessage中处理了
        } else {
          // 如果枢纽型引导了总结，下一个发言者应该自荐汇报
          if (summaryGuided && !summaryVolunteered) {
            // 枢纽型引导后，下一个发言者（可以是用户或AI）应该自荐汇报
            // 如果用户没有发言，AI会在后续自动发言时自荐
            // 这里给一个较短的延迟，让AI有机会自荐
            const delay = 1500 + Math.random() * 1000;
            setTimeout(() => {
              const nextChar = getBalancedNextSpeaker(char.id);
              triggerAITurn(nextChar);
            }, delay);
          } else {
            // 如果上一个发言者是AI，有一定概率由另一位AI响应
            const shouldChain = Math.random() < 0.3; // 降低AI之间的连续对话概率
            if (shouldChain && round < MAX_ROUNDS) {
              // 添加合理的间隔：最小1.5秒，最大3秒，避免连续快速发言
              const minInterval = 1500;
              const maxInterval = 3000;
              const delay = minInterval + Math.random() * (maxInterval - minInterval);
              setTimeout(() => {
                const nextChar = getBalancedNextSpeaker(char.id);
                triggerAITurn(nextChar);
              }, delay);
            }
          }
        }
      }, speakingTime);
    } catch (e) {
      console.error(e);
      setIsTyping(false);
      setActiveCharId(null);
    }
  };

  // Fix: Implement toggleListening function for speech recognition
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("您的浏览器不支持语音识别功能。");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      // 标记用户点击了麦克风
      if (!userClickedMic) {
        setUserClickedMic(true);
        // 清除5秒倒计时，用户先发言
        if (micCheckTimeoutRef.current) {
          clearTimeout(micCheckTimeoutRef.current);
          micCheckTimeoutRef.current = null;
        }
      }
      
      // 抢话判定：如果AI正在说话中，用户点击麦克风开始录音，判定为抢话
      if (isTyping && activeCharId) {
        setIsInterrupted(true);
        setTimeout(() => setIsInterrupted(false), 2500);
      }
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Speech recognition start failed:", err);
      }
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    // 标记用户已经发言（无论是通过语音还是输入框）
    if (!userClickedMic) {
      setUserClickedMic(true);
      // 清除5秒倒计时
      if (micCheckTimeoutRef.current) {
        clearTimeout(micCheckTimeoutRef.current);
        micCheckTimeoutRef.current = null;
      }
    }
    
    // 抢话判定：只有在AI显示"说话中"（isTyping && activeCharId）且用户通过语音识别发言时才判定为抢话
    if (isTyping && activeCharId && isListening) {
      setIsInterrupted(true);
      setTimeout(() => setIsInterrupted(false), 2500);
    }

    const messageContent = inputValue.trim();
    addMessage('user', USER_INFO.name, messageContent);
    setInputValue("");
    
    // 检查用户是否自荐汇报
    if (!summaryVolunteered && (messageContent.includes('我来总结') || messageContent.includes('我来汇报') || messageContent.includes('我来说') || messageContent.includes('我来'))) {
      setSummaryVolunteered(true);
    }
    
    // 用户发言后，必须确保有AI回应（强制响应，确保互动）
    // 根据用户发言长度计算合理的等待时间，让AI在用户说完后自然回应
    const userMessageLength = messageContent.length;
    const userSpeakingTime = Math.max(800, Math.min(4000, (userMessageLength / 2.8) * 1000));
    
    // 如果用户自荐了汇报，AI应该等待或补充，延迟稍长
    const isUserVolunteered = summaryVolunteered && (messageContent.includes('我来总结') || messageContent.includes('我来汇报'));
    const responseDelay = isUserVolunteered 
      ? userSpeakingTime + 2000 + Math.random() * 1000  // 用户汇报后，AI稍等再补充
      : userSpeakingTime + 1000 + Math.random() * 1000; // 正常回应时间
    
    setTimeout(() => {
      // 优先选择能回应用户的AI，确保互动
      const nextChar = getBalancedNextSpeaker('user');
      triggerAITurn(nextChar);
    }, responseDelay);
  };

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden relative">
      <div className={`flex flex-col flex-1 transition-all duration-500 ease-in-out ${showTopic ? 'lg:mr-80' : 'mr-0'}`}>
        <div className="bg-white border-b p-4 shadow-sm z-10">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-800 tracking-tight">
                  {getDiscussionPhase()}
                </h2>
                <div className="flex items-center gap-2">
                  <div className="h-1 w-32 bg-slate-100 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${(round / MAX_ROUNDS) * 100}%` }}></div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">进度</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => onFinish(messages)} 
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-indigo-600 shadow-lg shadow-slate-200 transition-all active:scale-95"
            >
              提交评估
            </button>
          </div>
          
          <div className="flex justify-between gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {CHARACTERS.map(c => (
              <CharacterCard key={c.id} character={c} isActive={activeCharId === c.id} isTyping={activeCharId === c.id && isTyping} />
            ))}
            <div className="flex flex-col items-center p-3 rounded-xl bg-white shadow-sm border-2 border-slate-100 min-w-[85px]">
               <img src={USER_INFO.avatar} alt={USER_INFO.name} className="w-12 h-12 rounded-full border-2 border-indigo-300" />
               <span className="mt-2 text-[10px] font-bold text-slate-700">{USER_INFO.displayName}</span>
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide bg-[#f8fafc]">
          {messages.map((msg) => {
            const isUser = msg.senderId === 'user';
            const char = CHARACTERS.find(c => c.id === msg.senderId);
            return (
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-3 duration-500`}>
                <div className={`max-w-[80%] rounded-2xl px-5 py-4 shadow-sm ${isUser ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-200/50'}`}>
                  {!isUser && (
                    <div className="flex items-center mb-2 gap-2">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{char?.name.split(' (')[0]}</span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full text-white font-bold ${char?.color} shadow-sm`}>
                        {char?.role === 'AGGRESSIVE' ? '核心' : char?.role === 'STRUCTURED' ? '枢纽' : '补位'}
                      </span>
                    </div>
                  )}
                  <p className="text-[14px] leading-relaxed whitespace-pre-wrap font-medium">{msg.content}</p>
                </div>
              </div>
            );
          })}
          {isTyping && activeCharId && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
                <div className="typing-indicator flex space-x-1"><span></span><span></span><span></span></div>
                <span className="text-[11px] font-bold text-slate-400">说话中</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-white border-t border-slate-100">
          <div className="max-w-4xl mx-auto flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                placeholder={isListening ? "正在记录您的完整发言..." : "在此输入您的核心观点..."}
                className={`w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl pl-5 pr-14 py-4 text-sm text-slate-900 resize-none h-24 transition-all outline-none ${isListening ? 'ring-4 ring-indigo-100 border-indigo-400' : ''}`}
              />
              <button 
                onClick={toggleListening}
                className={`absolute right-4 bottom-4 p-2.5 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <button 
              onClick={handleSendMessage} 
              disabled={!inputValue.trim()} 
              className="bg-slate-900 text-white w-16 h-24 rounded-2xl flex flex-col items-center justify-center hover:bg-indigo-600 disabled:opacity-30 transition-all shadow-xl active:scale-95 shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span className="text-[10px] font-black uppercase">发送</span>
            </button>
          </div>
          {isInterrupted && (
            <div className="mt-2 text-center animate-bounce">
              <span className="bg-red-500 text-white text-[10px] py-1 px-4 rounded-full font-black shadow-lg">
                ⚠️ 检测到抢话！
              </span>
            </div>
          )}
        </div>
      </div>

      <div className={`fixed lg:absolute top-0 right-0 h-full w-80 bg-white border-l border-slate-200 shadow-2xl z-20 transition-transform duration-500 ease-in-out transform ${showTopic ? 'translate-x-0' : 'translate-x-full'}`}>
        <button 
          onClick={() => setShowTopic(!showTopic)}
          className={`absolute left-[-32px] top-1/2 -translate-y-1/2 w-8 h-20 bg-white border border-r-0 border-slate-200 rounded-l-2xl flex items-center justify-center shadow-[-8px_0_15px_-3px_rgba(0,0,0,0.05)] hover:text-indigo-600 transition-colors z-30`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-500 ${showTopic ? 'rotate-0' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div className="p-8 flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10.392A7.968 7.968 0 015.5 14c1.255 0 2.443.29 3.5.804V4.804zM11 4.804A7.968 7.968 0 0114.5 4c1.255 0 2.443.29 3.5.804v10.392a7.968 7.968 0 00-3.5-.804c-1.255 0-2.443.29-3.5.804V4.804z" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">题目</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-3 scrollbar-hide space-y-8">
            {state.topic.split(/【|】/).map((chunk, idx) => {
              if (!chunk.trim()) return null;
              const isTitle = idx % 2 !== 0;
              return isTitle ? (
                <div key={idx} className="flex items-center gap-2 pt-4">
                  <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                  <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{chunk}</h4>
                </div>
              ) : (
                <p key={idx} className="text-[13px] text-slate-500 leading-relaxed font-medium whitespace-pre-wrap">
                  {chunk.trim()}
                </p>
              );
            })}
          </div>

          <div className="mt-8 p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100">
             <div className="flex items-center gap-2 mb-2">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
               </span>
               <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">实时贴士</span>
             </div>
             <p className="text-[11px] text-indigo-600 font-medium leading-relaxed">
               {round < 18 ? "当前阶段重点是贡献具体想法，争取在方案中留下你的逻辑印记。" : "讨论已接近尾声，请关注是否有人已经做出了总结，若没有，你可以尝试引导。"}
             </p>
          </div>
        </div>
      </div>

      {showTopic && (
        <div 
          onClick={() => setShowTopic(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-10 lg:hidden transition-all duration-500"
        />
      )}
    </div>
  );
};

export default DiscussionPanel;