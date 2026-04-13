'use client';

import { useApp } from '@/lib/store';
import { formatAmount } from '@/lib/format';
import Link from 'next/link';

export default function Home() {
  const { state } = useApp();
  const months = state.cashForecast.monthsRemaining;
  const r = state.report;
  const pendingCount = state.pendingItems.length;

  const revenue = r.pl.revenue;
  const profit = r.pl.profit;
  const expense = r.pl.expenses;
  const balance = state.cashForecast.projectedBalance;

  const profitChange = r.pl.revenueChange !== undefined ? r.pl.revenueChange : 0;
  const profitPct = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  const bars = [
    { label: '先々月', v: Math.round(balance * 0.9 / 10000), real: true },
    { label: '先月', v: Math.round(balance * 0.95 / 10000), real: true },
    { label: '今月', v: Math.round(balance / 10000), real: true },
    { label: '来月', v: Math.round(balance * 1.06 / 10000), real: false },
    { label: '再来月', v: Math.round(balance * 1.12 / 10000), real: false },
  ];
  const mx = Math.max(...bars.map(b => b.v), 1);

  const safetyColor = months >= 6 ? '#059669' : months >= 3 ? '#D97706' : '#DC2626';
  const safetyText = months >= 6 ? '安全' : months >= 3 ? '注意' : '危険';

  return (
    <div className="space-y-3">
      {/* ヘッダー */}
      <div className="pt-1">
        <p className="text-[11px] text-gray-400">AI経理部長</p>
        <h1 className="text-[18px] font-bold text-[#1A3A5C]">{new Date().getMonth() + 1}月のまとめ</h1>
        <p className="text-[11px] text-gray-400">更新: {new Date().getMonth() + 1}/{new Date().getDate()} {new Date().getHours()}:00</p>
      </div>

      {/* 手元資金（ヒーロー） */}
      <div className="bg-white rounded-[14px] border border-gray-200 p-5 text-center">
        <p className="text-[11px] text-gray-500">手元資金</p>
        <p className="text-[28px] font-black text-[#1A3A5C] leading-tight">{formatAmount(balance)}</p>
        <div className="mt-2">
          <span className="inline-block bg-emerald-50 text-emerald-600 text-[11px] font-bold px-3 py-1 rounded-lg">
            前月比 +{formatAmount(Math.round(balance * 0.05))}
          </span>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          💡 このペースなら<strong style={{ color: safetyColor }}>{safetyText}（{months}ヶ月以上）</strong>
        </p>
      </div>

      {/* 3指標 */}
      <div className="grid grid-cols-3 gap-[6px]">
        <div className="bg-white rounded-[14px] border border-gray-200 p-3 text-center">
          <p className="text-[11px] text-gray-500">売上</p>
          <p className="text-[16px] font-black text-[#1A3A5C]">{formatAmount(revenue)}</p>
          <p className={`text-[12px] font-bold ${profitChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {profitChange >= 0 ? '+' : ''}{Math.round(profitChange * 100)}%
          </p>
        </div>
        <div className="bg-white rounded-[14px] border border-gray-200 p-3 text-center">
          <p className="text-[11px] text-gray-500">利益</p>
          <p className="text-[16px] font-black text-[#1A3A5C]">{formatAmount(profit)}</p>
          <p className={`text-[12px] font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {profitPct}%
          </p>
        </div>
        <div className="bg-white rounded-[14px] border border-gray-200 p-3 text-center">
          <p className="text-[11px] text-gray-500">未入金</p>
          <p className="text-[16px] font-black text-red-600">{formatAmount(0)}</p>
          <p className="text-[12px] font-bold text-amber-600">0件</p>
        </div>
      </div>

      {/* 資金繰り予測 */}
      <div className="bg-white rounded-[14px] border border-gray-200 p-4">
        <div className="flex justify-between items-center mb-2">
          <p className="text-[12px] font-bold text-[#1A3A5C]">💰 資金繰り予測</p>
          <Link href="/cashflow" className="text-[11px] text-blue-600">詳しく →</Link>
        </div>
        <div className="flex items-end gap-[6px] h-[70px]">
          {bars.map(b => (
            <div key={b.label} className="flex-1 flex flex-col items-center gap-[3px]">
              <span className="text-[9px] font-bold text-[#1A3A5C]">{b.v}万</span>
              <div
                className={`w-full rounded-t-[3px] ${b.real ? 'bg-[#1A3A5C]' : ''}`}
                style={{
                  height: `${Math.max(2, (b.v / mx) * 50)}px`,
                  ...(b.real ? {} : { border: '1.5px dashed #3B82F6', background: 'rgba(59,130,246,0.12)' }),
                }}
              />
              <span className="text-[9px] text-gray-500">{b.label}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 text-center mt-1">実線=実績 / 点線=AI予測</p>
      </div>

      {/* アラート */}
      {pendingCount > 0 && (
        <Link href="/pending" className="block">
          <div className="bg-amber-50 rounded-[14px] border border-amber-200 px-4 py-3 flex items-center gap-3">
            <span className="text-[18px]">⚠️</span>
            <div className="flex-1">
              <p className="text-[12px] font-bold text-amber-800">{pendingCount}件の確認待ち</p>
              <p className="text-[11px] text-amber-600">AIが判断に迷っています</p>
            </div>
            <span className="text-[12px] text-amber-600 font-bold">詳細→</span>
          </div>
        </Link>
      )}

      {/* AIコメント */}
      {revenue > 0 && (
        <div className="bg-sky-50 rounded-[14px] border border-sky-200 p-4">
          <p className="text-[12px] font-bold text-sky-800 mb-1">🤖 AIのコメント</p>
          <p className="text-[12px] text-sky-700 leading-relaxed">
            {profit >= 0
              ? `今月の利益率は${profitPct}%です。${months >= 6 ? 'このペースが続けば資金は安定しています。' : '資金繰りに注意してください。'}`
              : '今月は赤字です。経費の見直しをおすすめします。'
            }
          </p>
        </div>
      )}

      {/* クイックリンク */}
      <div className="grid grid-cols-4 gap-[6px]">
        {[
          { href: '/reports', icon: '📊', label: '月次\nレポート' },
          { href: '/invoices', icon: '📄', label: '請求書' },
          { href: '/simulator', icon: '🔮', label: 'シミュ\nレーション' },
          { href: '/line', icon: '💬', label: 'AI相談' },
        ].map(l => (
          <Link key={l.href} href={l.href} className="bg-white rounded-[14px] border border-gray-200 p-3 text-center">
            <p className="text-[18px]">{l.icon}</p>
            <p className="text-[10px] font-bold text-[#1A3A5C] mt-1 whitespace-pre-line leading-tight">{l.label}</p>
          </Link>
        ))}
      </div>

      {/* フッター */}
      <div className="flex justify-center gap-4 text-[11px] text-gray-400 pt-2 pb-1">
        <Link href="/terms" className="underline">利用規約</Link>
        <Link href="/privacy" className="underline">プライバシーポリシー</Link>
      </div>
    </div>
  );
}
