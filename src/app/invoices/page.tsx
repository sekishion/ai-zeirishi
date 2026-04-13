'use client';

import { useState } from 'react';
import { formatAmount } from '@/lib/format';
import Link from 'next/link';

interface Invoice {
  id: string;
  client: string;
  total: number;
  issueDate: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

// 旧実装は山田工務店・ABC建設等の建設業の架空データを認証ユーザーにも表示していたため除去。
// 請求書管理画面のDB連携は次のアップデートで提供。現在は LINE のリッチメニューから作成可能。
const mockInvoices: Invoice[] = [];

const statusConfig = {
  overdue: { label: '期限超過', color: 'bg-red-50 text-red-600' },
  sent: { label: '未入金', color: 'bg-amber-50 text-amber-600' },
  draft: { label: '下書き', color: 'bg-gray-50 text-gray-500' },
  paid: { label: '入金済み', color: 'bg-emerald-50 text-emerald-600' },
};

type Mode = 'list' | 'create' | 'preview' | 'sent';

export default function InvoicesPage() {
  const [mode, setMode] = useState<Mode>('list');
  const [client, setClient] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([{ description: '', quantity: 1, unitPrice: 0 }]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);

  const unpaid = mockInvoices.filter(i => i.status !== 'paid');
  const paid = mockInvoices.filter(i => i.status === 'paid');

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const tax = Math.floor(subtotal * 0.1);
  const total = subtotal + tax;

  const updateItem = (idx: number, field: keyof InvoiceItem, val: string | number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const resetForm = () => {
    setClient('');
    setItems([{ description: '', quantity: 1, unitPrice: 0 }]);
    setDueDate(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
    setMode('list');
  };

  // === LIST MODE ===
  if (mode === 'list') {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-[#1A3A5C] p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-[17px] font-bold text-[#1A3A5C] flex-1">請求書</h1>
          <button onClick={() => setMode('create')} className="bg-[#1A3A5C] text-white text-[13px] font-bold px-4 py-2 rounded-xl">
            + 新規作成
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            <p className="text-[11px] text-gray-400">未入金</p>
            <p className="text-[18px] font-black text-red-600">{formatAmount(unpaid.reduce((s, i) => s + i.total, 0))}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            <p className="text-[11px] text-gray-400">入金済み</p>
            <p className="text-[18px] font-black text-emerald-600">{formatAmount(paid.reduce((s, i) => s + i.total, 0))}</p>
          </div>
        </div>

        {unpaid.length > 0 && <p className="text-[11px] font-bold text-red-500">未入金</p>}
        {unpaid.map(inv => {
          const sc = statusConfig[inv.status];
          return (
            <div key={inv.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[14px] font-bold text-gray-800">{inv.client}</p>
                  <p className="text-[11px] text-gray-400">{inv.id}</p>
                </div>
                <p className="text-[16px] font-black text-[#1A3A5C]">{formatAmount(inv.total)}</p>
              </div>
              <div className="flex justify-between items-center">
                <span className={`${sc.color} text-[11px] font-bold px-2 py-0.5 rounded-full`}>{sc.label}</span>
                {inv.status === 'overdue' && (
                  <span className="text-[11px] text-blue-600 font-medium">催促メール →</span>
                )}
              </div>
            </div>
          );
        })}

        {paid.length > 0 && <p className="text-[11px] font-bold text-emerald-600 mt-2">入金済み</p>}
        {paid.map(inv => (
          <div key={inv.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 opacity-60">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[14px] font-bold text-gray-800">{inv.client}</p>
                <p className="text-[11px] text-gray-400">{inv.id}</p>
              </div>
              <p className="text-[16px] font-black text-[#1A3A5C]">{formatAmount(inv.total)}</p>
            </div>
            <span className="bg-emerald-50 text-emerald-600 text-[11px] font-bold px-2 py-0.5 rounded-full mt-2 inline-block">入金確認済み</span>
          </div>
        ))}
      </div>
    );
  }

  // === CREATE MODE ===
  if (mode === 'create') {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode('list')} className="text-[#1A3A5C] p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-[17px] font-bold text-[#1A3A5C]">請求書を作成</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          {/* Client */}
          <div>
            <label className="text-[12px] font-bold text-gray-500 block mb-1">宛先</label>
            <input
              type="text"
              value={client}
              onChange={e => setClient(e.target.value)}
              placeholder="会社名を入力"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] outline-none focus:border-[#1A3A5C]"
            />
            {/* Quick select - populated from transaction counterparties when available */}
          </div>

          {/* Items */}
          <div>
            <label className="text-[12px] font-bold text-gray-500 block mb-2">品目</label>
            {items.map((item, idx) => (
              <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[11px] font-bold text-gray-400">品目 {idx + 1}</span>
                  {items.length > 1 && (
                    <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="text-[11px] text-red-500">削除</button>
                  )}
                </div>
                <input
                  type="text"
                  value={item.description}
                  onChange={e => updateItem(idx, 'description', e.target.value)}
                  placeholder="品目名（例: コンサルティング）"
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-[13px] mb-2 outline-none focus:border-[#1A3A5C]"
                />
                <div className="flex gap-2">
                  <div className="w-20">
                    <p className="text-[11px] text-gray-400 mb-0.5">数量</p>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-[13px] text-right outline-none focus:border-[#1A3A5C]"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] text-gray-400 mb-0.5">単価</p>
                    <input
                      type="number"
                      value={item.unitPrice || ''}
                      onChange={e => updateItem(idx, 'unitPrice', parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-[13px] text-right outline-none focus:border-[#1A3A5C]"
                    />
                  </div>
                  <div className="w-24 flex items-end">
                    <p className="text-[13px] font-bold text-[#1A3A5C] pb-2">¥{(item.quantity * item.unitPrice).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={() => setItems(prev => [...prev, { description: '', quantity: 1, unitPrice: 0 }])}
              className="text-[13px] text-[#1A3A5C] font-bold w-full py-2"
            >
              + 品目を追加
            </button>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <div className="flex justify-between text-[13px] text-gray-500 mb-1">
              <span>小計</span><span>¥{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[13px] text-gray-500 mb-2">
              <span>消費税（10%）</span><span>¥{tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[16px] font-black text-[#1A3A5C] border-t border-gray-200 pt-2">
              <span>合計</span><span>¥{total.toLocaleString()}</span>
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className="text-[12px] font-bold text-gray-500 block mb-1">支払期限</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] outline-none focus:border-[#1A3A5C]"
            />
          </div>
        </div>

        <button
          onClick={() => setMode('preview')}
          disabled={!client || subtotal === 0}
          className="w-full py-4 bg-[#1A3A5C] text-white rounded-2xl text-[15px] font-bold disabled:opacity-30"
        >
          プレビューを確認 →
        </button>
        <button onClick={() => setMode('list')} className="w-full py-3 text-gray-400 text-[13px]">キャンセル</button>
      </div>
    );
  }

  // === PREVIEW MODE ===
  if (mode === 'preview') {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode('create')} className="text-[#1A3A5C] p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-[17px] font-bold text-[#1A3A5C]">請求書プレビュー</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="text-center mb-4">
            <p className="text-[12px] text-gray-400">請求書</p>
            <p className="text-[20px] font-black text-[#1A3A5C] mt-1">¥{total.toLocaleString()}</p>
          </div>

          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-400">宛先</span>
              <span className="font-medium">{client}</span>
            </div>
            {items.map((item, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-400">{item.description || `品目 ${i + 1}`}</span>
                <span className="font-medium">¥{(item.quantity * item.unitPrice).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-400">消費税</span>
              <span className="font-medium">¥{tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-400">支払期限</span>
              <span className="font-medium">{dueDate}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setMode('sent')}
          className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-[15px] font-bold"
        >
          📧 メールで送信
        </button>
        <button onClick={() => setMode('create')} className="w-full py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl text-[13px]">
          修正する
        </button>
      </div>
    );
  }

  // === SENT MODE ===
  return (
    <div className="text-center space-y-6 py-12 animate-fade-in">
      <div className="w-20 h-20 mx-auto bg-emerald-50 rounded-full flex items-center justify-center">
        <span className="text-[36px]">✅</span>
      </div>
      <div>
        <p className="text-[18px] font-bold text-[#1A3A5C]">送信しました！</p>
        <p className="text-[13px] text-gray-400 mt-2">{client} 宛 ¥{total.toLocaleString()}</p>
        <p className="text-[12px] text-gray-400 mt-1">入金期限: {dueDate}</p>
        <p className="text-[11px] text-emerald-600 mt-3">入金があったら自動でお知らせします</p>
      </div>
      <div className="space-y-2">
        <button onClick={resetForm} className="w-full py-3 bg-[#1A3A5C] text-white rounded-2xl text-[14px] font-bold">
          もう1通作る
        </button>
        <Link href="/" className="block w-full py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl text-[13px] text-center">
          ホームに戻る
        </Link>
      </div>
    </div>
  );
}
