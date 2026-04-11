'use client';

import { useApp } from '@/lib/store';
import { getGreeting, formatAmount } from '@/lib/format';
import { AiDisclaimer } from '@/components/shared/AiDisclaimer';
import Link from 'next/link';

export default function Home() {
  const { state } = useApp();
  const greeting = getGreeting();
  const months = state.cashForecast.monthsRemaining;
  const acc = state.accuracyLogs[state.accuracyLogs.length - 1];
  const autoRate = acc ? Math.round(acc.accuracy * 100) : 0;
  const pendingCount = state.pendingItems.length;
  const r = state.report;

  // 粗利率の計算
  const grossMargin = r.pl.revenue > 0 ? Math.round(((r.pl.revenue - (r.pl.expenses * 0.6)) / r.pl.revenue) * 100) : 0;
  // 営業利益率
  const opMargin = r.pl.revenue > 0 ? Math.round((r.pl.profit / r.pl.revenue) * 100) : 0;
  // 損益分岐点（固定費 ÷ 粗利率）
  const fixedCosts = state.cashForecast.fixedCosts || r.pl.expenses * 0.4;
  const breakeven = grossMargin > 0 ? Math.round(fixedCosts / (grossMargin / 100)) : 0;
  // 現在の売上が損益分岐点の何%か
  const breakevenRatio = breakeven > 0 ? Math.round((r.pl.revenue / breakeven) * 100) : 0;

  // 未回収売掛金（モック: 取引の入金予定から計算）
  const unpaidInvoices = 2;
  const unpaidAmount = 350000;

  // 資金予測バー
  const balance = state.cashForecast.projectedBalance;
  const bars = [
    { label: '1月', v: 850, real: true },
    { label: '2月', v: 980, real: true },
    { label: '3月', v: Math.round(balance / 10000), real: true },
    { label: '4月', v: Math.round(balance / 10000 * 1.06), real: false },
    { label: '5月', v: Math.round(balance / 10000 * 1.12), real: false },
  ];
  const mx = Math.max(...bars.map(b => b.v));

  // 今後の支払い（直近の大きな支出）
  const upcomingPayments = state.transactions
    .filter(t => t.type === 'expense')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  return (
    <div className="space-y-4">
      {/* LINE体験バナー */}
      <Link href="/line" className="block bg-[#06C755] rounded-2xl p-3.5 text-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-[18px]">💬</div>
          <div className="flex-1">
            <p className="text-[13px] font-bold">LINEで使うとこうなります</p>
            <p className="text-[11px] opacity-80">レシート・質問・請求書をチャットで体験</p>
          </div>
          <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </div>
      </Link>

      {/* 挨拶 + ステータス */}
      <div>
        <h1 className="text-[17px] font-bold text-[#1A3A5C]">{state.ownerName}さん、{greeting}</h1>
        <p className="text-[12px] text-gray-400">
          {pendingCount > 0
            ? `⚠️ ${pendingCount}件だけ確認が必要です`
            : `✅ 経理はすべてAIが処理済み。異常ありません`
          }
        </p>
      </div>

      {/* ===== SECTION: お金の状況 ===== */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[12px] font-bold text-[#1A3A5C] mb-3">💰 お金の状況</p>

        {/* 手元資金（ヒーロー） */}
        <div className="text-center mb-4">
          <p className="text-[11px] text-gray-400">手元資金</p>
          <p className="text-[28px] font-black text-[#1A3A5C] leading-none">{state.dashboardMetrics[2]?.value}</p>
          <div className="flex items-center justify-center gap-2 mt-1.5">
            <span className="bg-emerald-50 text-emerald-600 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
              前月比 {state.dashboardMetrics[2]?.change}
            </span>
            <span className="text-[11px] text-gray-400">
              あと<strong className={months >= 6 ? 'text-emerald-600' : months >= 3 ? 'text-amber-600' : 'text-red-600'}>{months}ヶ月</strong>分
            </span>
          </div>
        </div>

        {/* 資金予測グラフ */}
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="flex items-end gap-2 h-[48px] mb-1" style={{ minWidth: `${bars.length * 56}px` }}>
            {bars.map(b => (
              <div key={b.label} className="flex-1 flex flex-col items-center gap-[2px] min-w-[44px]">
                <span className="text-[11px] font-bold text-[#1A3A5C] whitespace-nowrap">{b.v}万</span>
                <div
                  className={`w-full rounded-t-sm ${b.real ? 'bg-[#1A3A5C]' : 'border border-dashed border-blue-300 bg-blue-50'}`}
                  style={{ height: `${(b.v / mx) * 36}px` }}
                />
                <span className={`text-[11px] whitespace-nowrap ${b.real ? 'text-gray-400' : 'text-blue-400'}`}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 未回収アラート */}
        {unpaidAmount > 0 && (
          <Link href="/invoices" className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <span className="text-[13px]">⚠️</span>
            <p className="text-[12px] text-amber-700 flex-1">
              未入金 <strong>{formatAmount(unpaidAmount)}</strong>（{unpaidInvoices}件）
            </p>
            <span className="text-[11px] text-amber-600 font-bold">確認 →</span>
          </Link>
        )}
      </div>

      {/* ===== SECTION: 稼ぐ力 ===== */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex justify-between items-center mb-3">
          <p className="text-[12px] font-bold text-[#1A3A5C]">📊 稼ぐ力</p>
          <Link href="/reports" className="text-[11px] text-blue-600 font-medium">詳しく →</Link>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="text-center">
            <p className="text-[11px] text-gray-400">売上</p>
            <p className="text-[18px] font-black text-[#1A3A5C]">{state.dashboardMetrics[0]?.value}</p>
            <p className={`text-[11px] font-bold ${state.dashboardMetrics[0]?.changeType === 'positive' ? 'text-emerald-600' : 'text-red-500'}`}>
              {state.dashboardMetrics[0]?.change}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-gray-400">営業利益</p>
            <p className="text-[18px] font-black text-[#1A3A5C]">{state.dashboardMetrics[1]?.value}</p>
            <p className={`text-[11px] font-bold ${state.dashboardMetrics[1]?.changeType === 'positive' ? 'text-emerald-600' : 'text-red-500'}`}>
              {state.dashboardMetrics[1]?.change}
            </p>
          </div>
        </div>

        {/* 利益率と損益分岐 */}
        <div className="flex gap-2">
          <div className="bg-gray-50 rounded-xl p-2.5 text-center flex-1 min-w-0">
            <p className="text-[11px] text-gray-400 whitespace-nowrap">粗利率</p>
            <p className="text-[16px] font-black text-[#1A3A5C]">{grossMargin}%</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-2.5 text-center flex-1 min-w-0">
            <p className="text-[11px] text-gray-400 whitespace-nowrap">損益分岐まで</p>
            <p className={`text-[16px] font-black ${breakevenRatio >= 120 ? 'text-emerald-600' : breakevenRatio >= 100 ? 'text-amber-600' : 'text-red-600'}`}>
              {breakevenRatio}%
            </p>
            <p className="text-[11px] text-gray-400 whitespace-nowrap">{breakevenRatio >= 100 ? '余裕あり' : '⚠️ 赤字ライン'}</p>
          </div>
        </div>
      </div>

      {/* ===== SECTION: AIからの提案 ===== */}
      <div className="bg-sky-50 rounded-2xl border border-sky-100 p-4">
        <p className="text-[12px] font-bold text-sky-800 mb-2">🤖 AIからの提案</p>
        <div className="space-y-2">
          {/* 動的に生成すべきだが、まずは固定で */}
          <div className="flex items-start gap-2">
            <span className="text-[12px] mt-0.5">💡</span>
            <p className="text-[12px] text-sky-700 leading-relaxed">
              交際費が前月比+80%です。営業強化が理由なら問題ありませんが、確認をおすすめします。
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[12px] mt-0.5">📅</span>
            <p className="text-[12px] text-sky-700 leading-relaxed">
              消費税の中間納付期限が来月です。資金を確保しておいてください（約¥35万）。
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[12px] mt-0.5">💰</span>
            <p className="text-[12px] text-sky-700 leading-relaxed">
              山田工務店への請求書が5日超過しています。催促メールを送りますか？
            </p>
          </div>
        </div>
      </div>

      {/* ===== SECTION: 確認待ち ===== */}
      {pendingCount > 0 && (
        <Link href="/pending" className="block bg-amber-50 rounded-2xl border border-amber-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <span className="text-[20px]">⚠️</span>
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-amber-800">{pendingCount}件の確認待ち</p>
              <p className="text-[12px] text-amber-600">AIが判断に迷っています。1分で完了します</p>
            </div>
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </div>
        </Link>
      )}

      {/* ===== 機能リンク ===== */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { href: '/reports', icon: '📊', label: 'レポート' },
          { href: '/invoices', icon: '📄', label: '請求書' },
          { href: '/simulator', icon: '🔮', label: 'シミュレーション' },
          { href: '/cashflow', icon: '💰', label: '資金繰り' },
        ].map(l => (
          <Link key={l.href} href={l.href} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-2.5 hover:shadow-md transition-shadow">
            <span className="text-[20px]">{l.icon}</span>
            <p className="text-[13px] font-bold text-[#1A3A5C]">{l.label}</p>
          </Link>
        ))}
      </div>

      {/* ステータスライン */}
      <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400 py-1">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
        <span>AI自動処理 {autoRate}% ・ 正常稼働中</span>
      </div>

      {/* 免責・法的リンク */}
      <AiDisclaimer compact />
      <div className="flex justify-center gap-4 text-[11px] text-gray-400 pb-2">
        <Link href="/terms" className="underline">利用規約</Link>
        <Link href="/privacy" className="underline">プライバシーポリシー</Link>
      </div>
    </div>
  );
}
