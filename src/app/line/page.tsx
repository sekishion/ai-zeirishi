'use client';

import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/lib/store';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

const SUGGEST_CHIPS = [
  '今月の利益は？',
  '節税できる？',
  '資金はいつまで持つ？',
  '決算の予想は？',
];

let msgCounter = 0;
const genId = () => `msg-${++msgCounter}-${Date.now()}`;

export default function LinePage() {
  const { state } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 初回メッセージ
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: genId(),
        role: 'ai',
        text: `${state.ownerName || '社長'}さん、こんにちは！\nAI経理部長です。経理や資金繰りのことなら何でも聞いてください。`,
      }]);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    const userMsg: Message = { id: genId(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          context: `売上: ${state.dashboardMetrics[0]?.value}, 利益: ${state.dashboardMetrics[1]?.value}, 手元資金: ${state.dashboardMetrics[2]?.value}, 資金繰り: あと${state.cashForecast.monthsRemaining}ヶ月分, 会社名: ${state.companyName}, 業種: ${state.companyInfo?.industry || ''}`,
        }),
      });

      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(prev => [...prev, { id: genId(), role: 'ai', text: data.content }]);
    } catch {
      setMessages(prev => [...prev, { id: genId(), role: 'ai', text: 'すみません、接続に問題が発生しました。もう一度お試しください。' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    sendMessage(input.trim());
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <Link href="/" className="text-[#1A3A5C] p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-[17px] font-bold text-[#1A3A5C]">AI経理部長に相談</h1>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4 space-y-3">
        {/* Suggest chips (show at top before any user message) */}
        {messages.filter(m => m.role === 'user').length === 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {SUGGEST_CHIPS.map(chip => (
              <button
                key={chip}
                onClick={() => sendMessage(chip)}
                disabled={loading}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-[12px] text-[#1A3A5C] font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#1A3A5C] text-white rounded-2xl rounded-br-sm'
                  : 'bg-[#F3F4F6] text-gray-800 rounded-2xl rounded-bl-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* Quick reply chips after AI response */}
        {messages.length > 0 && messages[messages.length - 1].role === 'ai' && messages.filter(m => m.role === 'user').length > 0 && !loading && (
          <div className="flex flex-wrap gap-2">
            {SUGGEST_CHIPS.map(chip => (
              <button
                key={chip}
                onClick={() => sendMessage(chip)}
                disabled={loading}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-[12px] text-[#1A3A5C] font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#F3F4F6] rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input bar */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力..."
            className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-[13px] outline-none"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-9 h-9 bg-[#2563EB] rounded-full flex items-center justify-center text-white disabled:opacity-30 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
