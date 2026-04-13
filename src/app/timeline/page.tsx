'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/lib/store';
import { formatAmount } from '@/lib/format';
import Link from 'next/link';

type Filter = 'all' | 'income' | 'expense' | 'pending';

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
}

export default function Timeline() {
  const { state } = useApp();
  const [filter, setFilter] = useState<Filter>('all');

  // 利用可能な月リストを抽出
  const availableMonths = useMemo(() => {
    const months = [...new Set(state.transactions.map(t => t.date.slice(0, 7)))].sort().reverse();
    return months;
  }, [state.transactions]);

  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0] || new Date().toISOString().slice(0, 7));

  // 選択月のトランザクションをフィルタ
  const monthTransactions = useMemo(() => {
    return state.transactions.filter(t => t.date.startsWith(selectedMonth));
  }, [state.transactions, selectedMonth]);

  const filtered = monthTransactions.filter(t => {
    if (filter === 'income') return t.type === 'income';
    if (filter === 'expense') return t.type === 'expense';
    if (filter === 'pending') return t.status === 'pending';
    return true;
  });

  // 日付でグループ化
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const tx of filtered) {
      const group = map.get(tx.date) || [];
      group.push(tx);
      map.set(tx.date, group);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const total = monthTransactions.length;
  const processed = monthTransactions.filter(t => t.status === 'processed').length;
  const pendingCount = monthTransactions.filter(t => t.status === 'pending').length;

  const monthLabel = selectedMonth ? `${parseInt(selectedMonth.split('-')[1])}月` : '3月';

  const tabs: { id: Filter; label: string }[] = [
    { id: 'all', label: 'すべて' },
    { id: 'income', label: '入金' },
    { id: 'expense', label: '出金' },
    { id: 'pending', label: '確認待ち' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-[17px] font-bold text-[#1A3A5C]">取引</h1>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="text-[12px] text-[#1A3A5C] font-bold bg-transparent border border-gray-200 rounded-lg px-2 py-1 outline-none"
        >
          {availableMonths.map(m => (
            <option key={m} value={m}>{parseInt(m.split('-')[1])}月</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-200 rounded-[10px] p-[3px]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`flex-1 py-[7px] text-[12px] font-bold rounded-[8px] transition-all ${
              filter === t.id ? 'bg-white text-[#1A3A5C] shadow-sm' : 'text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="flex justify-between items-center text-[11px]">
        <span className="text-gray-500">{total}件中 {processed}件処理済み</span>
        {pendingCount > 0 && (
          <span className="inline-block px-3 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-[#D97706]">
            確認待ち {pendingCount}件
          </span>
        )}
      </div>

      {/* Date-grouped transaction list */}
      {grouped.map(([date, txs]) => (
        <div key={date}>
          <p className="text-[11px] font-bold text-gray-400 mb-1.5">{formatDateLabel(date)}</p>
          <div className="bg-white rounded-[14px] border border-gray-200 divide-y divide-gray-100">
            {txs.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold ${
                  tx.status === 'pending' ? 'bg-amber-50 text-[#D97706]' :
                  tx.type === 'income' ? 'bg-emerald-50 text-[#059669]' :
                  'bg-red-50 text-[#DC2626]'
                }`}>
                  {tx.status === 'pending' ? '？' : tx.type === 'income' ? '↓' : '↑'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#1A3A5C] truncate">{tx.counterparty}</p>
                  <p className={`text-[11px] ${tx.status === 'pending' ? 'text-[#D97706] font-medium' : 'text-gray-500'}`}>
                    {tx.status === 'pending' ? '確認待ち' : tx.categoryLabel}{' '}
                    <span className="text-gray-400">・ {tx.source.split(' ')[0]}</span>
                  </p>
                </div>
                <p className={`text-[14px] font-bold ${
                  tx.type === 'income' ? 'text-[#059669]' : 'text-[#1A3A5C]'
                }`}>
                  {tx.type === 'income' ? '+' : '-'}{formatAmount(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[32px] mb-2">&#x1F4ED;</p>
          <p className="text-[13px] text-gray-400">該当する取引はありません</p>
        </div>
      )}
    </div>
  );
}
