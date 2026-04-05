'use client';

import { useState, useRef } from 'react';
import { useApp } from '@/lib/store';
import { formatAmount } from '@/lib/format';
import Link from 'next/link';

interface OcrResult {
  amount: number | null;
  store: string | null;
  date: string | null;
  category: string | null;
  categoryLabel: string | null;
  confidence: number;
}

type Step = 'camera' | 'processing' | 'confirm' | 'done';

export default function ReceiptPage() {
  const { dispatch } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('camera');
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editStore, setEditStore] = useState('');
  const [editCategory, setEditCategory] = useState('');

  const categories = [
    '会議費', '交際費', '消耗品費', '旅費交通費', '通信費', '地代家賃', '水道光熱費', '外注費', 'その他',
  ];

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // プレビュー表示
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreview(dataUrl);
      setStep('processing');

      try {
        const res = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl }),
        });

        if (res.ok) {
          const data = await res.json();
          setResult(data);
          setEditAmount(data.amount?.toString() || '');
          setEditStore(data.store || '');
          setEditCategory(data.categoryLabel || data.category || '会議費');
        } else {
          throw new Error('OCR failed');
        }
      } catch {
        setResult({
          amount: null, store: null, date: new Date().toISOString().split('T')[0],
          category: '雑費', categoryLabel: '雑費', confidence: 0,
        });
        setEditAmount('');
        setEditStore('');
        setEditCategory('雑費');
      }

      setStep('confirm');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const amount = parseInt(editAmount) || 0;
    const tx = {
      id: `tx-receipt-${Date.now()}`,
      date: result?.date || new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      description: `${editStore} レシート`,
      category: editCategory,
      categoryLabel: editCategory,
      amount,
      type: 'expense' as const,
      source: 'レシート撮影',
      counterparty: editStore,
      status: 'processed' as const,
      confidence: result?.confidence || 0.9,
    };

    dispatch({ type: 'ADD_TRANSACTIONS', transactions: [tx], pending: [] });
    setStep('done');
  };

  const reset = () => {
    setStep('camera');
    setPreview(null);
    setResult(null);
    setEditAmount('');
    setEditStore('');
    setEditCategory('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-[#1A3A5C] p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-[17px] font-bold text-[#1A3A5C]">レシート撮影</h1>
      </div>

      {/* Step: Camera */}
      {step === 'camera' && (
        <div className="text-center space-y-6 py-8">
          <div className="w-24 h-24 mx-auto bg-gray-100 rounded-2xl flex items-center justify-center">
            <span className="text-[40px]">📸</span>
          </div>
          <div>
            <p className="text-[15px] font-bold text-[#1A3A5C]">レシートを撮影してください</p>
            <p className="text-[12px] text-gray-400 mt-1">AIが金額・店名・勘定科目を自動で読み取ります</p>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
          />

          <button
            onClick={() => fileRef.current?.click()}
            className="w-full py-4 bg-[#1A3A5C] text-white rounded-2xl text-[15px] font-bold"
          >
            📷 カメラで撮影
          </button>

          <button
            onClick={() => {
              if (fileRef.current) {
                fileRef.current.removeAttribute('capture');
                fileRef.current.click();
                fileRef.current.setAttribute('capture', 'environment');
              }
            }}
            className="w-full py-3 bg-white border-2 border-gray-200 text-gray-600 rounded-2xl text-[14px] font-medium"
          >
            🖼 アルバムから選ぶ
          </button>
        </div>
      )}

      {/* Step: Processing */}
      {step === 'processing' && (
        <div className="text-center space-y-6 py-12">
          {preview && (
            <div className="w-40 h-40 mx-auto rounded-xl overflow-hidden border border-gray-200">
              <img src={preview} alt="レシート" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-[#1A3A5C] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-[#1A3A5C] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-[#1A3A5C] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-[14px] text-gray-500">AIが読み取り中...</p>
        </div>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && result && (
        <div className="space-y-4">
          {/* Preview */}
          {preview && (
            <div className="h-32 rounded-xl overflow-hidden border border-gray-200">
              <img src={preview} alt="レシート" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-[14px]">🤖</span>
              <p className="text-[13px] font-bold text-[#1A3A5C]">AIが読み取りました</p>
              <span className="ml-auto bg-emerald-50 text-emerald-600 text-[11px] font-bold px-2 py-0.5 rounded-full">
                確信度 {Math.round((result.confidence || 0.9) * 100)}%
              </span>
            </div>

            {/* Amount */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 block mb-1">金額</label>
              <div className="flex items-center gap-2">
                <span className="text-[14px] text-gray-500">¥</span>
                <input
                  type="number"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  className="flex-1 text-[20px] font-black text-[#1A3A5C] bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 outline-none focus:border-[#1A3A5C]"
                />
              </div>
            </div>

            {/* Store */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 block mb-1">店名</label>
              <input
                type="text"
                value={editStore}
                onChange={e => setEditStore(e.target.value)}
                className="w-full text-[14px] bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200 outline-none focus:border-[#1A3A5C]"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 block mb-1">勘定科目</label>
              <div className="flex flex-wrap gap-2">
                {categories.map(c => (
                  <button
                    key={c}
                    onClick={() => setEditCategory(c)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
                      editCategory === c
                        ? 'bg-[#1A3A5C] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 block mb-1">日付</label>
              <p className="text-[14px] text-gray-700">{result.date || new Date().toISOString().split('T')[0]}</p>
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-[15px] font-bold"
          >
            ✓ この内容で記録する
          </button>

          <button
            onClick={reset}
            className="w-full py-3 bg-white border border-gray-200 text-gray-500 rounded-2xl text-[13px]"
          >
            撮り直す
          </button>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && (
        <div className="text-center space-y-6 py-12">
          <div className="w-20 h-20 mx-auto bg-emerald-50 rounded-full flex items-center justify-center">
            <span className="text-[36px]">✅</span>
          </div>
          <div>
            <p className="text-[18px] font-bold text-[#1A3A5C]">記録しました！</p>
            <p className="text-[13px] text-gray-400 mt-2">
              ¥{(parseInt(editAmount) || 0).toLocaleString()} / {editStore} / {editCategory}
            </p>
          </div>

          <div className="space-y-2">
            <button
              onClick={reset}
              className="w-full py-3 bg-[#1A3A5C] text-white rounded-2xl text-[14px] font-bold"
            >
              もう1枚撮る
            </button>
            <Link href="/" className="block w-full py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl text-[13px] text-center">
              ホームに戻る
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
