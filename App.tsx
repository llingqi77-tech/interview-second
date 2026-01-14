
import React, { useState } from 'react';
import SetupForm from './components/SetupForm';
import DiscussionPanel from './components/DiscussionPanel';
import FeedbackReport from './components/FeedbackReport';
import { SimulationState, Message, FeedbackData } from './types';
import { generateFeedback } from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<SimulationState>({
    topic: "",
    jobTitle: "",
    company: "",
    messages: [],
    status: 'IDLE',
    activeCharacterId: null,
    round: 0
  });

  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);

  const startSimulation = (topic: string, jobTitle: string, company: string) => {
    setState({
      ...state,
      topic,
      jobTitle,
      company,
      status: 'DISCUSSING',
      messages: [],
      round: 0
    });
  };

  const finishSimulation = async (history: Message[]) => {
    setState(prev => ({ ...prev, status: 'FINISHED', messages: history }));
    setIsLoadingFeedback(true);
    try {
      const data = await generateFeedback(state.topic, state.jobTitle, history);
      setFeedback(data);
    } catch (e) {
      console.error(e);
      setFeedback({
        timing: "分析时遇到了一些问题，无法准确评价你的时机。",
        voiceShare: 0,
        structuralContribution: "无法评价你的贡献。",
        interruptionHandling: "无法评价。",
        overallScore: 60,
        suggestions: ["尝试再次生成反馈", "注意保持发言逻辑清晰"]
      });
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  const restart = () => {
    setState({
      topic: "",
      jobTitle: "",
      company: "",
      messages: [],
      status: 'IDLE',
      activeCharacterId: null,
      round: 0
    });
    setFeedback(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <main className="w-full max-w-4xl h-[85vh] flex flex-col">
        {state.status === 'IDLE' && (
          <div className="flex-1 flex items-center justify-center">
            <SetupForm onStart={startSimulation} />
          </div>
        )}

        {state.status === 'DISCUSSING' && (
          <div className="flex-1 h-full rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
            <DiscussionPanel state={state} onFinish={finishSimulation} />
          </div>
        )}

        {state.status === 'FINISHED' && (
          <div className="flex-1 overflow-y-auto scrollbar-hide py-8">
            {isLoadingFeedback ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-indigo-600 font-bold">AI</div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">面试官正在整理评估报告...</h3>
                  <p className="text-slate-500 mt-2">分析发言频率、逻辑结构、打断应对中</p>
                </div>
              </div>
            ) : feedback ? (
              <FeedbackReport feedback={feedback} onRestart={restart} />
            ) : (
              <div className="text-center p-8 bg-white rounded-3xl shadow-xl">
                 <h2 className="text-2xl font-bold text-red-500 mb-4">反馈生成失败</h2>
                 <p className="text-slate-600 mb-6">抱歉，无法连接到评估服务器，请稍后重试。</p>
                 <button onClick={restart} className="px-6 py-2 bg-slate-900 text-white rounded-xl">返回主页</button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
