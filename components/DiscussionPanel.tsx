import React, { useState, useEffect, useRef } from 'react';
import { Character, Message, SimulationState } from '../types';
import { CHARACTERS } from '../constants';
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
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const firstTurnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 用于平衡 AI 发言占比的洗牌队列
  const aiPoolRef = useRef<string[]>([]);

  const MAX_ROUNDS = 25;

  // 动态阶段判断
  const getDiscussionPhase = () => {
    if (round < 5) return "开局框架阶段 (Setting Framework)";
    if (round < 18) return "深入讨论与方案贡献 (Idea Contribution)";
    if (round < 22) return "引导与总结陈词 (Guiding Conclusion)";
    return "最后补充与面试收尾 (Final Supplement)";
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isTyping]);

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

    // 自动开局
    firstTurnTimeoutRef.current = setTimeout(() => {
      if (messages.length === 0) {
        // 第一回合随机指定一人，后续进入洗牌逻辑
        const char = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
        triggerAITurn(char);
      }
    }, 2500);

    return () => {
      if (firstTurnTimeoutRef.current) clearTimeout(firstTurnTimeoutRef.current);
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

  const triggerAITurn = async (char: Character) => {
    if (round >= MAX_ROUNDS) return;

    setRound(prev => prev + 1);
    setActiveCharId(char.id);
    setIsTyping(true);

    try {
      const text = await generateAIReply(char, state.topic, state.jobTitle, messages, getDiscussionPhase());
      setIsTyping(false);
      addMessage(char.id, char.name, text);
      setActiveCharId(null);

      // AI 发言后，有一定概率立刻由另一位 AI 响应，增强讨论连贯性
      const shouldChain = Math.random() < 0.4;
      if (shouldChain && round < MAX_ROUNDS) {
        const delay = 1200 + Math.random() * 1800;
        setTimeout(() => {
          const nextChar = getBalancedNextSpeaker(char.id);
          triggerAITurn(nextChar);
        }, delay);
      }
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
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Speech recognition start failed:", err);
      }
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    // 如果在 AI 发言时强制插入，视为抢话
    if (isTyping || activeCharId) {
      setIsInterrupted(true);
      setTimeout(() => setIsInterrupted(false), 2500);
    }

    addMessage('user', '你', inputValue);
    setInputValue("");
    
    // 用户发言后，1-2秒后会有 AI 接话
    setTimeout(() => {
      const nextChar = getBalancedNextSpeaker('user');
      triggerAITurn(nextChar);
    }, 1500 + Math.random() * 1000);
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
                  <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">进度 {round}/{MAX_ROUNDS}</span>
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
               <div className="w-12 h-12 rounded-full border-2 border-slate-300 flex items-center justify-center bg-slate-50 text-slate-400 font-bold text-xs uppercase">User</div>
               <span className="mt-2 text-[10px] font-bold text-slate-700">我 (考生)</span>
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
                <span className="text-[11px] font-bold text-slate-400">正在思考发言...</span>
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
            <h3 className="text-lg font-black text-slate-900 tracking-tight">群面真题材料</h3>
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