'use client';

import { useApp } from '@/lib/store';
import { formatAmount } from '@/lib/format';
import Link from 'next/link';

export default function AnalysisPage() {
  const { state } = useApp();
  const r = state.report;
  const months = state.cashForecast.monthsRemaining;

  return (
    <div className="space-y-4">
      <h1 className="text-[17px] font-bold text-[#1A3A5C]">分析</h1>

      {/* Mini metrics */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center min-w-[100px] flex-1">
          <p className="text-[11px] text-gray-400 whitespace-nowrap">利益率</p>
          <p className="text-[18px] font-black text-[#1A3A5C]">{r.pl.revenue > 0 ? Math.round((r.pl.profit / r.pl.revenue) * 100) : 0}%</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center min-w-[100px] flex-1">
          <p className="text-[11px] text-gray-400 whitespace-nowrap">資金安全度</p>
          <p className="text-[18px] font-black text-emerald-600 whitespace-nowrap">{months}ヶ月</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center min-w-[100px] flex-1">
          <p className="text-[11px] text-gray-400 whitespace-nowrap">AI精度</p>
          <p className="text-[18px] font-black text-[#1A3A5C]">{((state.accuracyLogs[state.accuracyLogs.length - 1]?.accuracy || 0) * 100).toFixed(1)}%</p>
        </div>
      </div>

      {/* Navigation cards */}
      <div className="space-y-2">
        {[
          { href: '/reports', icon: '📊', title: '月次レポート', desc: `${r.month ? `${parseInt(r.month.split('-')[1])}月` : '—'}: 売上${formatAmount(r.pl.revenue)} / 利益${formatAmount(r.pl.profit)}`, color: 'border-l-blue-500' },
          { href: '/cashflow', icon: '💰', title: '資金繰り予測', desc: `あと${months}ヶ月分の運転資金。${state.cashForecast.level === 'safe' ? '安全です' : '注意が必要です'}`, color: 'border-l-emerald-500' },
          { href: '/simulator', icon: '🔮', title: 'シミュレーション', desc: 'What-if分析、決算予測、節税チェック', color: 'border-l-purple-500' },
          { href: '/invoices', icon: '📄', title: '請求書・入金管理', desc: '未入金の追跡と催促', color: 'border-l-amber-500' },
          { href: '/expense', icon: '🧾', title: '経費精算', desc: '従業員の経費申請の承認・管理', color: 'border-l-orange-500' },
          { href: '/tax-calendar', icon: '📅', title: '税務カレンダー', desc: '納付・届出の期限リマインド', color: 'border-l-red-500' },
          { href: '/filing', icon: '📋', title: '確定申告・決算', desc: '申告ステップの進捗管理', color: 'border-l-indigo-500' },
        ].map(item => (
          <Link key={item.href} href={item.href} className={`block bg-white rounded-xl border border-gray-100 border-l-4 ${item.color} shadow-sm p-4 hover:shadow-md transition-shadow`}>
            <div className="flex items-center gap-3">
              <span className="text-[24px]">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-[#1A3A5C]">{item.title}</p>
                <p className="text-[12px] text-gray-400 truncate">{item.desc}</p>
              </div>
              <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
