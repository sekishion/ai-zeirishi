'use client';

import { useState } from 'react';
import { formatAmount } from '@/lib/format';
import Link from 'next/link';

interface ExpenseItem {
  id: string;
  name: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  status: 'pending' | 'approved' | 'rejected';
}

// 経費精算（複数従業員→社長承認）は β版では未実装。
// 旧実装は架空の建設業データ（鈴木一郎・山田工務店等）が認証済みユーザーにも表示されていたため除去。
const initialExpenses: ExpenseItem[] = [];

export default function ExpensePage() {
  const [expenses, setExpenses] = useState(initialExpenses);
  const pending = expenses.filter(e => e.status === 'pending');
  const processed = expenses.filter(e => e.status !== 'pending');

  const handleAction = (id: string, action: 'approved' | 'rejected') => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, status: action } : e));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-[#1A3A5C] p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-[17px] font-bold text-[#1A3A5C]">経費精算</h1>
      </div>

      {/* Summary */}
      <div className="flex gap-2">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center flex-1 min-w-0">
          <p className="text-[11px] text-gray-400 whitespace-nowrap">承認待ち</p>
          <p className="text-[18px] font-black text-amber-600">{pending.length}件</p>
          <p className="text-[11px] text-gray-400 whitespace-nowrap">{formatAmount(pending.reduce((s, e) => s + e.amount, 0))}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center flex-1 min-w-0">
          <p className="text-[11px] text-gray-400 whitespace-nowrap">今月承認済み</p>
          <p className="text-[18px] font-black text-emerald-600">{processed.filter(e => e.status === 'approved').length}件</p>
          <p className="text-[11px] text-gray-400 whitespace-nowrap">{formatAmount(processed.filter(e => e.status === 'approved').reduce((s, e) => s + e.amount, 0))}</p>
        </div>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <>
          <p className="text-[11px] font-bold text-amber-600">承認待ち</p>
          {pending.map(e => (
            <div key={e.id} className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-amber-50 rounded-full flex items-center justify-center text-[12px] font-bold text-amber-600">
                      {e.name[0]}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-gray-800">{e.name}</p>
                      <p className="text-[11px] text-gray-400">{e.date}</p>
                    </div>
                  </div>
                </div>
                <p className="text-[16px] font-black text-[#1A3A5C]">{formatAmount(e.amount)}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 mb-3">
                <p className="text-[13px] text-gray-700">{e.description}</p>
                <p className="text-[11px] text-gray-400 mt-1">{e.category}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleAction(e.id, 'approved')}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-[13px] font-bold"
                >
                  ✓ 承認
                </button>
                <button
                  onClick={() => handleAction(e.id, 'rejected')}
                  className="flex-1 py-2.5 bg-white border-2 border-gray-200 text-gray-500 rounded-xl text-[13px] font-bold"
                >
                  ✗ 却下
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {pending.length === 0 && processed.length === 0 && (
        <div className="text-center py-12 px-4">
          <span className="text-[36px]">📋</span>
          <p className="text-[15px] font-bold text-[#1A3A5C] mt-3">経費精算は β版で準備中です</p>
          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            複数従業員からの経費申請 → 社長承認のフローは<br />
            次のアップデートで提供します。<br /><br />
            現在は LINE で社長自身がレシートを送る運用でお願いします。
          </p>
        </div>
      )}

      {pending.length === 0 && processed.length > 0 && (
        <div className="text-center py-8">
          <span className="text-[36px]">✅</span>
          <p className="text-[14px] font-bold text-[#1A3A5C] mt-2">承認待ちはありません</p>
        </div>
      )}

      {/* Processed */}
      {processed.length > 0 && (
        <>
          <p className="text-[11px] font-bold text-gray-400 mt-2">処理済み</p>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {processed.map(e => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3 opacity-60">
                <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-[12px] font-bold text-gray-400">
                  {e.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-700 truncate">{e.description}</p>
                  <p className="text-[11px] text-gray-400">{e.name} ・ {e.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-bold text-gray-600">{formatAmount(e.amount)}</p>
                  <span className={`text-[11px] font-bold ${e.status === 'approved' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {e.status === 'approved' ? '承認済み' : '却下'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
