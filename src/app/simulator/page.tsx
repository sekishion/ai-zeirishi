'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';
import { formatAmount } from '@/lib/format';
import Link from 'next/link';

export default function SimulatorPage() {
  const { state } = useApp();
  const r = state.report;

  // 実データから初期値を取得
  const monthlyRevenue = r.pl.revenue || 0;
  const monthlyExpenses = r.pl.expenses || 0;

  const [revenue, setRevenue] = useState(monthlyRevenue);
  const [expenses, setExpenses] = useState(monthlyExpenses);
  const [tab, setTab] = useState<'forecast' | 'whatif' | 'tax'>('forecast');

  const profit = revenue - expenses;
  const profitRate = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0';
  const annualRevenue = monthlyRevenue * 12;
  const annualExpenses = monthlyExpenses * 12;
  const annualProfit = annualRevenue - annualExpenses;
  const estimatedTax = Math.max(0, annualProfit * 0.3);
  const breakeven = expenses;

  const tabs = [
    { id: 'forecast' as const, label: '決算予測' },
    { id: 'whatif' as const, label: 'What-if' },
    { id: 'tax' as const, label: '税金' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/" className="text-[#1A3A5C] p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-[17px] font-bold text-[#1A3A5C]">シミュレーション</h1>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-200 rounded-[10px] p-[3px]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-[12px] font-bold rounded-[8px] transition-all ${
              tab === t.id ? 'bg-white text-[#1A3A5C] shadow-sm' : 'text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 決算予測 */}
      {tab === 'forecast' && (
        <div className="space-y-4">
          <div className="bg-white rounded-[14px] border border-gray-200 p-5 text-center">
            <p className="text-[11px] text-gray-500 mb-1">今のペースが続くと...</p>
            <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-4">年間決算予測</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 rounded-xl p-4">
                <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-1">年間売上</p>
                <p className="text-[20px] font-black text-[#059669]">{formatAmount(annualRevenue)}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-1">年間利益</p>
                <p className="text-[20px] font-black text-[#2563EB]">{formatAmount(annualProfit)}</p>
              </div>
            </div>
            <div className="mt-3 bg-amber-50 rounded-lg p-3 text-[12px] text-[#D97706]">
              予想法人税: 約{formatAmount(estimatedTax)}（実効税率30%で概算）
            </div>
          </div>
        </div>
      )}

      {/* What-if */}
      {tab === 'whatif' && (
        <div className="space-y-4">
          <div className="bg-white rounded-[14px] border border-gray-200 p-4">
            <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-4">もし売上が変わったら？</p>

            <div className="space-y-4">
              {/* 月間売上スライダー */}
              <div>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-gray-500">月間売上</span>
                  <span className="font-bold text-[#1A3A5C]">{formatAmount(revenue)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={15000000}
                  step={100000}
                  value={revenue}
                  onChange={(e) => setRevenue(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1A3A5C]"
                />
                <div className="flex justify-between text-[11px] text-gray-400">
                  <span>0</span><span>1,500万円</span>
                </div>
              </div>

              {/* 月間費用スライダー */}
              <div>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-gray-500">月間費用</span>
                  <span className="font-bold text-[#1A3A5C]">{formatAmount(expenses)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={15000000}
                  step={100000}
                  value={expenses}
                  onChange={(e) => setExpenses(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1A3A5C]"
                />
                <div className="flex justify-between text-[11px] text-gray-400">
                  <span>0</span><span>1,500万円</span>
                </div>
              </div>

              {/* 結果 */}
              <div className="border-t-2 border-gray-200 pt-3 flex justify-between items-baseline">
                <div>
                  <p className="text-[11px] text-gray-500">月間利益</p>
                  <p className={`text-[24px] font-black ${profit >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                    {formatAmount(profit)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-gray-500">利益率</p>
                  <p className={`text-[18px] font-black ${profit >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                    {profitRate}%
                  </p>
                </div>
              </div>

              {/* AI コメント */}
              <div className="bg-sky-50 rounded-lg p-3 text-[12px] text-sky-800 leading-relaxed">
                &#x1F916;{' '}
                {profit >= 0
                  ? `赤字ラインは月売上${formatAmount(breakeven)}以下です。${revenue > breakeven * 1.2 ? 'まだ余裕があります。' : '注意が必要です。'}`
                  : `現在赤字です。売上を${formatAmount(breakeven - revenue)}増やすか、費用を削減する必要があります。`
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 節税チェック */}
      {tab === 'tax' && (
        <div className="space-y-4">
          <div className="bg-white rounded-[14px] border border-gray-200 p-4">
            <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-3">節税チェック</p>

            {[
              { icon: '\u2705', title: '小規模企業共済', desc: '月7万 → 年84万の所得控除', save: '節税25万', color: 'bg-emerald-50 text-[#059669]' },
              { icon: '\uD83D\uDCA1', title: '経営セーフティ共済', desc: '月20万 → 年240万を経費化', save: '節税72万', color: 'bg-blue-50 text-[#2563EB]' },
              { icon: '\uD83D\uDCA1', title: '役員報酬の最適化', desc: '法人税+所得税+社保のバランス', save: '要シミュレーション', color: 'bg-blue-50 text-[#2563EB]' },
              { icon: '\uD83D\uDCA1', title: '消費税（原則 vs 簡易）', desc: '簡易課税の方が有利な可能性', save: '要検討', color: 'bg-amber-50 text-[#D97706]' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-b-0">
                <span className="text-lg">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[#1A3A5C]">{item.title}</p>
                  <p className="text-[11px] text-gray-500">{item.desc}</p>
                </div>
                <span className={`inline-block px-3 py-1 rounded-lg text-[11px] font-bold ${item.color}`}>
                  {item.save}
                </span>
              </div>
            ))}

            <div className="mt-3 bg-emerald-50 rounded-lg p-3 text-center">
              <p className="text-[11px] text-gray-500">節税ポテンシャル合計</p>
              <p className="text-[20px] font-black text-[#059669]">約97万円/年</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
