'use client';

import { useApp } from '@/lib/store';
import { formatAmount } from '@/lib/format';
import { AiDisclaimer } from '@/components/shared/AiDisclaimer';
import Link from 'next/link';

const COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#6EE7B7', '#D1D5DB'];

export default function Reports() {
  const { state } = useApp();
  const r = state.report;
  const totalExp = r.pl.expenses;

  // 6ヶ月P/Lモックデータ
  const plHistory = [
    { month: '10月', rev: 680, exp: 550 },
    { month: '11月', rev: 720, exp: 560 },
    { month: '12月', rev: 700, exp: 540 },
    { month: '1月', rev: 740, exp: 570 },
    { month: '2月', rev: 750, exp: 580 },
    { month: '3月', rev: Math.round(r.pl.revenue / 10000), exp: Math.round(r.pl.expenses / 10000) },
  ];
  const maxRev = Math.max(...plHistory.map(p => p.rev));

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/analysis" className="text-[#1A3A5C] p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-[17px] font-bold text-[#1A3A5C]">3月 月次レポート</h1>
      </div>

      {/* P/L Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[11px] font-bold text-gray-400 mb-3">損益（6ヶ月推移）</p>
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="flex items-end gap-2 h-[100px]" style={{ minWidth: `${plHistory.length * 52}px` }}>
            {plHistory.map((p, i) => {
              const profit = p.rev - p.exp;
              const isLast = i === plHistory.length - 1;
              return (
                <div key={p.month} className="flex-1 flex flex-col items-center gap-[2px] min-w-[40px]">
                  <span className={`text-[11px] font-bold whitespace-nowrap ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {profit >= 0 ? '+' : ''}{profit}万
                  </span>
                  <div className="w-full flex flex-col gap-[1px]">
                    <div className={`w-full rounded-t-sm ${isLast ? 'bg-[#1A3A5C]' : 'bg-blue-300'}`} style={{ height: `${(p.rev / maxRev) * 60}px` }} />
                    <div className={`w-full ${isLast ? 'bg-red-400' : 'bg-red-200'}`} style={{ height: `${(p.exp / maxRev) * 40}px` }} />
                  </div>
                  <span className={`text-[11px] whitespace-nowrap ${isLast ? 'text-[#1A3A5C] font-bold' : 'text-gray-400'}`}>{p.month}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex gap-3 justify-center mt-2 text-[11px] text-gray-400">
          <span><span className="inline-block w-2 h-2 bg-[#1A3A5C] rounded-sm mr-1" />売上</span>
          <span><span className="inline-block w-2 h-2 bg-red-400 rounded-sm mr-1" />費用</span>
          <span className="text-emerald-600 font-bold">+数字 = 利益</span>
        </div>
      </div>

      {/* Cash flow */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[11px] font-bold text-gray-400 mb-3">お金の動き</p>
        <div className="flex gap-2 mb-2">
          <div className="flex-1 text-center py-3 bg-emerald-50 rounded-xl">
            <p className="text-[11px] text-emerald-600">入ってきた</p>
            <p className="text-[16px] font-black text-emerald-700">{formatAmount(r.cashflow.inflow)}</p>
          </div>
          <div className="flex-1 text-center py-3 bg-red-50 rounded-xl">
            <p className="text-[11px] text-red-500">出ていった</p>
            <p className="text-[16px] font-black text-red-600">{formatAmount(r.cashflow.outflow)}</p>
          </div>
        </div>
        <p className="text-center text-[12px] text-gray-500">
          差引: <strong className={r.cashflow.net >= 0 ? 'text-emerald-600' : 'text-red-600'}>
            {r.cashflow.net >= 0 ? '+' : ''}{formatAmount(r.cashflow.net)}
          </strong> {r.cashflow.net >= 0 ? '手元が増えた' : '手元が減った'}
        </p>
      </div>

      {/* Expense donut */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[11px] font-bold text-gray-400 mb-3">経費の内訳</p>
        {/* ドーナツ + 凡例: 小画面では縦積み */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-[100px] h-[100px] flex-shrink-0">
            <div
              className="w-full h-full rounded-full"
              style={{
                background: `conic-gradient(${
                  r.pl.expenseBreakdown.map((cat, i) => {
                    const start = r.pl.expenseBreakdown.slice(0, i).reduce((s, c) => s + c.percentage, 0) * 360;
                    const end = start + cat.percentage * 360;
                    return `${COLORS[i % COLORS.length]} ${start}deg ${end}deg`;
                  }).join(', ')
                })`
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[60px] h-[60px] bg-white rounded-full flex flex-col items-center justify-center">
                <span className="text-[12px] font-black text-[#1A3A5C]">{formatAmount(totalExp)}</span>
              </div>
            </div>
          </div>
          <div className="w-full space-y-1.5">
            {r.pl.expenseBreakdown.slice(0, 6).map((cat, i) => (
              <div key={cat.name} className="flex items-center gap-2 text-[12px]">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="flex-1 text-gray-600 min-w-0">{cat.name}</span>
                <span className="font-bold text-gray-700 whitespace-nowrap">{formatAmount(cat.amount)}</span>
                {cat.changeNote && <span className="bg-amber-50 text-amber-600 text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">{cat.changeNote}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI comment */}
      <div className="bg-sky-50 rounded-2xl border border-sky-100 p-4">
        <p className="text-[12px] font-bold text-sky-800 mb-2">🤖 AIのコメント</p>
        <div className="space-y-1.5">
          {r.aiComments.map((c, i) => (
            <p key={i} className="text-[12px] text-sky-700 leading-relaxed">{c}</p>
          ))}
        </div>
      </div>

      <AiDisclaimer />
    </div>
  );
}
