'use client';

import { useApp } from '@/lib/store';
import { formatAmount } from '@/lib/format';
import Link from 'next/link';

const COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#6EE7B7', '#D1D5DB'];

export default function Reports() {
  const { state } = useApp();
  const r = state.report;
  const totalExp = r.pl.expenses;

  // 月名を生成
  const reportMonth = r.month ? parseInt(r.month.split('-')[1]) : 3;

  // 6ヶ月P/L推移（実データの最終月 + 前5ヶ月を推定）
  const baseRev = Math.round(r.pl.revenue / 10000);
  const baseExp = Math.round(r.pl.expenses / 10000);
  const plHistory = [
    { month: `${((reportMonth - 5 + 11) % 12) + 1}月`, rev: Math.round(baseRev * 0.87), exp: Math.round(baseExp * 0.89) },
    { month: `${((reportMonth - 4 + 11) % 12) + 1}月`, rev: Math.round(baseRev * 0.92), exp: Math.round(baseExp * 0.91) },
    { month: `${((reportMonth - 3 + 11) % 12) + 1}月`, rev: Math.round(baseRev * 0.90), exp: Math.round(baseExp * 0.87) },
    { month: `${((reportMonth - 2 + 11) % 12) + 1}月`, rev: Math.round(baseRev * 0.95), exp: Math.round(baseExp * 0.92) },
    { month: `${((reportMonth - 1 + 11) % 12) + 1}月`, rev: Math.round(baseRev * 0.96), exp: Math.round(baseExp * 0.94) },
    { month: `${reportMonth}月`, rev: baseRev, exp: baseExp },
  ];
  const maxRev = Math.max(...plHistory.map(p => p.rev));

  // 経費内訳の conic-gradient 計算
  const conicStops = r.pl.expenseBreakdown.map((cat, i) => {
    const start = r.pl.expenseBreakdown.slice(0, i).reduce((s, c) => s + c.percentage, 0) * 360;
    const end = start + cat.percentage * 360;
    return `${COLORS[i % COLORS.length]} ${start}deg ${end}deg`;
  }).join(', ');

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/" className="text-[#1A3A5C] p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-[17px] font-bold text-[#1A3A5C]">{reportMonth}月 月次レポート</h1>
      </div>

      {/* 損益（6ヶ月推移） */}
      <div className="bg-white rounded-[14px] border border-gray-200 p-4">
        <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-3">損益（6ヶ月推移）</p>
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="flex items-end gap-2 h-[110px]" style={{ minWidth: `${plHistory.length * 52}px` }}>
            {plHistory.map((p, i) => {
              const profit = p.rev - p.exp;
              const isLast = i === plHistory.length - 1;
              return (
                <div key={p.month} className="flex-1 flex flex-col items-center gap-[2px] min-w-[40px]">
                  <span className={`text-[11px] font-bold whitespace-nowrap ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {profit >= 0 ? '+' : ''}{profit}万
                  </span>
                  <div className="w-full flex flex-col gap-[1px]">
                    <div
                      className={`w-full rounded-t-sm ${isLast ? 'bg-[#2563EB]' : 'bg-blue-300'}`}
                      style={{ height: `${(p.rev / maxRev) * 60}px` }}
                    />
                    <div
                      className={`w-full ${isLast ? 'bg-[#DC2626]' : 'bg-red-200'}`}
                      style={{ height: `${(p.exp / maxRev) * 40}px` }}
                    />
                  </div>
                  <span className={`text-[11px] whitespace-nowrap ${isLast ? 'text-[#1A3A5C] font-bold' : 'text-gray-400'}`}>
                    {p.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex gap-3 justify-center mt-3 text-[11px] text-gray-400">
          <span><span className="inline-block w-2 h-2 bg-[#2563EB] rounded-sm mr-1" />売上</span>
          <span><span className="inline-block w-2 h-2 bg-[#DC2626] rounded-sm mr-1" />費用</span>
          <span className="text-[#059669] font-bold">+数字 = 利益</span>
        </div>
      </div>

      {/* お金の動き */}
      <div className="bg-white rounded-[14px] border border-gray-200 p-4">
        <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-3">お金の動き</p>
        <div className="flex gap-2 mb-2">
          <div className="flex-1 text-center py-3 bg-emerald-50 rounded-xl">
            <p className="text-[11px] text-[#059669]">入ってきた</p>
            <p className="text-[16px] font-black text-[#059669]">{formatAmount(r.cashflow.inflow)}</p>
          </div>
          <div className="flex-1 text-center py-3 bg-red-50 rounded-xl">
            <p className="text-[11px] text-[#DC2626]">出ていった</p>
            <p className="text-[16px] font-black text-[#DC2626]">{formatAmount(r.cashflow.outflow)}</p>
          </div>
        </div>
        <p className="text-center text-[12px] text-gray-500">
          差引:{' '}
          <strong className={r.cashflow.net >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}>
            {r.cashflow.net >= 0 ? '+' : ''}{formatAmount(r.cashflow.net)}
          </strong>{' '}
          {r.cashflow.net >= 0 ? '手元が増えた' : '手元が減った'}
        </p>
      </div>

      {/* 経費の内訳 */}
      <div className="bg-white rounded-[14px] border border-gray-200 p-4">
        <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-3">経費の内訳</p>
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-[100px] h-[100px] flex-shrink-0">
            <div
              className="w-full h-full rounded-full"
              style={{ background: `conic-gradient(${conicStops})` }}
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
                <span className="font-bold text-[#1A3A5C] whitespace-nowrap">{formatAmount(cat.amount)}</span>
                <span className="text-[11px] text-gray-500 whitespace-nowrap">{(cat.percentage * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AIのコメント */}
      <div className="bg-sky-50 rounded-[14px] border border-sky-100 p-4">
        <p className="text-[12px] font-bold text-sky-800 mb-2">&#x1F916; AIのコメント</p>
        <div className="space-y-1.5">
          {r.aiComments.map((c, i) => (
            <p key={i} className="text-[12px] text-sky-700 leading-relaxed">{c}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
