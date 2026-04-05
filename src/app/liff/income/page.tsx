'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function IncomeForm() {
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid') || '';

  const [client, setClient] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [savedAmount, setSavedAmount] = useState(0);

  const parsedAmount = (() => {
    const cleaned = amount.replace(/[,円¥\s]/g, '');
    if (cleaned.includes('万')) return parseFloat(cleaned.replace('万', '')) * 10000;
    return parseInt(cleaned, 10) || 0;
  })();

  const handleSubmit = async () => {
    if (!client.trim()) { alert('取引先を入力してください'); return; }
    if (parsedAmount <= 0) { alert('金額を入力してください'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/liff/income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: uid, client: client.trim(), amount: parsedAmount, memo }),
      });
      const data = await res.json();
      if (data.ok) {
        setSavedAmount(parsedAmount);
        setDone(true);
      } else {
        alert(data.error || 'エラーが発生しました');
      }
    } catch {
      alert('送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-[#f0fdf4] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 text-center shadow-lg max-w-sm w-full">
          <div className="text-[48px] mb-4">✅</div>
          <h2 className="text-[20px] font-black text-gray-900 mb-2">入金を記録しました</h2>
          <p className="text-[15px] text-gray-600 mb-6">
            ¥{savedAmount.toLocaleString()} ← {client}
          </p>
          <button onClick={() => window.close()} className="w-full bg-[#06C755] text-white font-bold py-3 rounded-full text-[15px]">
            LINEに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <h1 className="text-[17px] font-black text-gray-900">💰 入金を記録</h1>
      </div>

      <div className="px-4 py-5 space-y-5 pb-28">
        <div>
          <label className="text-[12px] font-bold text-gray-500 block mb-1">取引先 *</label>
          <input
            type="text"
            value={client}
            onChange={e => setClient(e.target.value)}
            placeholder="例: ABC建設"
            className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-[16px] focus:border-[#06C755] focus:ring-1 focus:ring-[#06C755] outline-none"
          />
        </div>

        <div>
          <label className="text-[12px] font-bold text-gray-500 block mb-1">入金額 *</label>
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="例: 3500000 または 350万"
            className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-[20px] font-bold focus:border-[#06C755] focus:ring-1 focus:ring-[#06C755] outline-none"
          />
          {parsedAmount > 0 && (
            <p className="text-[13px] text-[#06C755] mt-1 font-bold">¥{parsedAmount.toLocaleString()}</p>
          )}
        </div>

        <div>
          <label className="text-[12px] font-bold text-gray-500 block mb-1">メモ（任意）</label>
          <input
            type="text"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="例: 3月分工事代金"
            className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-[15px] focus:border-[#06C755] outline-none"
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <button
          onClick={handleSubmit}
          disabled={submitting || !client.trim() || parsedAmount <= 0}
          className="w-full bg-[#06C755] text-white font-bold py-3.5 rounded-full text-[16px] disabled:opacity-40 active:scale-[0.98] transition-all"
        >
          {submitting ? '記録中...' : parsedAmount > 0 ? `¥${parsedAmount.toLocaleString()} を記録` : '入金を記録'}
        </button>
      </div>
    </div>
  );
}

export default function IncomePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-gray-400">読み込み中...</p></div>}>
      <IncomeForm />
    </Suspense>
  );
}
