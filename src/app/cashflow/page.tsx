'use client';

import { useApp } from '@/lib/store';
import { formatAmount } from '@/lib/format';
import Link from 'next/link';

export default function CashflowPage() {
  const { state } = useApp();

  // 月別集計（実データ）
  const monthlyData = new Map<string, { income: number; expense: number }>();
  state.transactions.forEach(t => {
    const m = t.date.slice(0, 7);
    const current = monthlyData.get(m) || { income: 0, expense: 0 };
    if (t.type === 'income') current.income += t.amount;
    else current.expense += t.amount;
    monthlyData.set(m, current);
  });

  const sortedMonths = Array.from(monthlyData.keys()).sort();

  // 実績のバランス推移（累積）
  let runningBalance = 0;
  const actualBars = sortedMonths.map(m => {
    const data = monthlyData.get(m)!;
    runningBalance += data.income - data.expense;
    const mNum = parseInt(m.split('-')[1]);
    return { month: `${mNum}月`, value: Math.round(Math.max(0, runningBalance) / 10000), actual: true };
  });

  // 予測月を追加（月間平均ネットで6ヶ月先まで）
  const avgNet = sortedMonths.length > 0
    ? Array.from(monthlyData.values()).reduce((s, v) => s + v.income - v.expense, 0) / sortedMonths.length
    : 0;
  const lastBalance = runningBalance;
  const lastMonthNum = sortedMonths.length > 0
    ? parseInt(sortedMonths[sortedMonths.length - 1].split('-')[1])
    : 3;

  const forecastCount = Math.max(0, 6 - actualBars.length);
  const forecastBars = Array.from({ length: forecastCount }, (_, i) => {
    const val = Math.round(Math.max(0, lastBalance + avgNet * (i + 1)) / 10000);
    const mNum = (lastMonthNum + i + 1);
    return { month: `${mNum > 12 ? mNum - 12 : mNum}月`, value: val, actual: false };
  });

  const chartData = [...actualBars.slice(-3), ...forecastBars];
  const maxVal = Math.max(...chartData.map(d => d.value), 1);

  // 今後の入出金予定（本日以降の取引を日付昇順で上位5件）
  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingTx = state.transactions
    .filter(t => t.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const level = state.cashForecast.level;
  const months = state.cashForecast.monthsRemaining;

  const safetyColor = level === 'safe' ? 'text-[#059669]' : level === 'caution' ? 'text-[#D97706]' : 'text-[#DC2626]';
  const safetyBg = level === 'safe' ? 'bg-gradient-to-r from-[#059669] to-emerald-400' : level === 'caution' ? 'bg-gradient-to-r from-[#D97706] to-amber-400' : 'bg-gradient-to-r from-[#DC2626] to-red-400';
  const safetyLabel = level === 'safe' ? '安全' : level === 'caution' ? '注意' : '危険';
  const safetyPct = Math.min((months / 24) * 100, 100);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/" className="text-[#1A3A5C] p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-[17px] font-bold text-[#1A3A5C]">資金繰り予測</h1>
      </div>

      {/* Safety indicator */}
      <div className="bg-white rounded-[14px] border border-gray-200 p-5 text-center">
        <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-2">資金の安全度</p>
        <p className={`text-[36px] font-black ${safetyColor}`}>{safetyLabel}</p>
        <p className={`text-[14px] font-bold ${months === 99 ? 'text-gray-400' : safetyColor} mt-1`}>
          {months === 99 ? '経費データ不足' : `あと${months}ヶ月以上`}
        </p>
        <div className="mt-3 mx-auto w-4/5 h-2.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full ${safetyBg} rounded-full transition-all`} style={{ width: `${safetyPct}%` }} />
        </div>
        <div className="flex justify-between w-4/5 mx-auto mt-1 text-[11px] text-gray-400">
          <span>危険</span><span>注意</span><span>安全</span>
        </div>
      </div>

      {/* 月別予測チャート */}
      <div className="bg-white rounded-[14px] border border-gray-200 p-4">
        <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-3">月別予測（6ヶ月先まで）</p>
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="flex items-end gap-2 h-28" style={{ minWidth: `${chartData.length * 52}px` }}>
            {chartData.map((d) => (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-1 min-w-[40px]">
                <span className="text-[11px] font-bold text-[#1A3A5C] whitespace-nowrap">{d.value}万</span>
                <div
                  className={`w-full rounded-t transition-all ${
                    d.actual ? 'bg-[#1A3A5C]' : 'bg-blue-50 border-2 border-dashed border-[#2563EB]'
                  }`}
                  style={{ height: `${(d.value / maxVal) * 80}px` }}
                />
                <span className={`text-[11px] whitespace-nowrap ${d.actual ? 'text-[#1A3A5C] font-bold' : 'text-[#2563EB]'}`}>
                  {d.month}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-4 justify-center mt-2 text-[11px] text-gray-500">
          <span><span className="inline-block w-3 h-2 bg-[#1A3A5C] rounded-sm mr-1" />実績</span>
          <span><span className="inline-block w-3 h-2 border border-dashed border-[#2563EB] rounded-sm mr-1" />AI予測</span>
        </div>
      </div>

      {/* 今後の入出金予定 */}
      <div className="bg-white rounded-[14px] border border-gray-200 p-4">
        <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-3">今後の入出金予定</p>
        <div className="space-y-0">
          {upcomingTx.length === 0 ? (
            <p className="text-[13px] text-gray-400 text-center py-4">予定なし</p>
          ) : (
            upcomingTx.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-b-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                  tx.type === 'income' ? 'bg-emerald-50 text-[#059669]' : 'bg-red-50 text-[#DC2626]'
                }`}>
                  {tx.type === 'income' ? '↓' : '↑'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-800 truncate">{tx.counterparty}</p>
                  <p className="text-[11px] text-gray-500">{tx.date.slice(5).replace('-', '/')}</p>
                </div>
                <p className={`text-[14px] font-bold ${tx.type === 'income' ? 'text-[#059669]' : 'text-[#1A3A5C]'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatAmount(tx.amount)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
