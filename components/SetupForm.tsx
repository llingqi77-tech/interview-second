
import React, { useState } from 'react';
import { generateTopic } from '../services/geminiService';

interface SetupFormProps {
  onStart: (topic: string, jobTitle: string, company: string) => void;
}

const SetupForm: React.FC<SetupFormProps> = ({ onStart }) => {
  const [topic, setTopic] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!company || !jobTitle) {
      alert("请先填写公司和岗位，以便生成相关的题目。");
      return;
    }
    setIsGenerating(true);
    try {
      const result = await generateTopic(company, jobTitle);
      setTopic(result);
    } catch (error) {
      console.error(error);
      alert("生成失败，请稍后重试。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic && jobTitle && company) {
      onStart(topic, jobTitle, company);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded-3xl shadow-2xl border border-slate-100">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">群面模拟器</h1>
        <p className="text-slate-500 text-base">专业、高压、实战。模拟互联网大厂群面环境。</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="group">
            <label className="block text-sm font-bold text-slate-700 mb-2 transition-colors group-focus-within:text-indigo-600">面试公司</label>
            <input 
              type="text" 
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="例如：字节跳动"
              className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-slate-900 bg-slate-50 font-medium placeholder:text-slate-400"
              required
            />
          </div>
          <div className="group">
            <label className="block text-sm font-bold text-slate-700 mb-2 transition-colors group-focus-within:text-indigo-600">面试岗位</label>
            <input 
              type="text" 
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="例如：产品经理"
              className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-slate-900 bg-slate-50 font-medium placeholder:text-slate-400"
              required
            />
          </div>
        </div>

        <div className="relative">
          <div className="flex justify-between items-end mb-3">
            <label className="block text-sm font-bold text-slate-700">群面讨论题目</label>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !company || !jobTitle}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-3 w-3 text-indigo-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  正在智能生成题目...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.3 1.047a1 1 0 01.894.448l7 11a1 1 0 11-1.688 1.06l-7-11a1 1 0 01.494-1.508zM1 18a1 1 0 011-1h16a1 1 0 110 2H2a1 1 0 01-1-1z" clipRule="evenodd" />
                    <path d="M5.5 13a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
                  </svg>
                  生成大厂真题风格题目
                </>
              )}
            </button>
          </div>
          
          <div className={`relative rounded-3xl overflow-hidden border-2 transition-all ${topic ? 'border-indigo-200 bg-white shadow-inner' : 'border-slate-100 bg-slate-50'}`}>
            <textarea 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="填写题目内容，或者点击上方按钮让 AI 结合公司与岗位为你设计一个经典群面题目..."
              className="w-full px-6 py-6 text-slate-900 bg-transparent focus:outline-none transition-all h-64 md:h-80 resize-none text-base leading-relaxed font-medium placeholder:text-slate-400"
              required
            />
            {isGenerating && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                   <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                   <span className="text-sm font-bold text-slate-600">面试官出题中...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <button 
          type="submit"
          className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-indigo-600 shadow-2xl shadow-slate-200 transition-all active:scale-[0.98] text-lg tracking-wide uppercase"
        >
          确认题目 · 开始模拟
        </button>
      </form>
      
      <p className="mt-8 text-center text-slate-400 text-xs">
        模拟器将为您生成 4 位各具特色的 AI 讨论伙伴，并记录您的表现生成详细反馈。
      </p>
    </div>
  );
};

export default SetupForm;
