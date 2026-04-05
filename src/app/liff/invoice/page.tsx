'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: string;
  taxRate: 10 | 8;
}

const BANK_STORAGE_KEY = 'ai-keiri-bank-info';

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function endOfMonth(d: Date): Date {
  const result = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return result;
}

function addMonths(d: Date, months: number): Date {
  const result = new Date(d);
  result.setMonth(result.getMonth() + months);
  return result;
}

function displayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

function InvoiceForm() {
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid') || '';

  const today = formatDate(new Date());

  const [client, setClient] = useState('');
  const [issueDate, setIssueDate] = useState(today);
  const [items, setItems] = useState<InvoiceItem[]>([{ name: '', quantity: 1, unitPrice: '', taxRate: 10 }]);
  const [dueDate, setDueDate] = useState(formatDate(endOfMonth(addMonths(new Date(), 1))));
  const [dueDateMode, setDueDateMode] = useState<'preset' | 'custom'>('preset');
  const [selectedPreset, setSelectedPreset] = useState(1);
  const [bankInfo, setBankInfo] = useState('');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ total: number; invoiceNo: string } | null>(null);

  // 振込先をlocalStorageから復元
  useEffect(() => {
    try {
      const saved = localStorage.getItem(BANK_STORAGE_KEY);
      if (saved) setBankInfo(saved);
    } catch { /* ignore */ }
  }, []);

  const selectPreset = (months: number) => {
    setSelectedPreset(months);
    setDueDateMode('preset');
    setDueDate(formatDate(endOfMonth(addMonths(new Date(), months))));
  };

  const switchToCustom = () => {
    setDueDateMode('custom');
    setSelectedPreset(0);
  };

  const addItem = () => setItems([...items, { name: '', quantity: 1, unitPrice: '', taxRate: 10 }]);

  const removeItem = (i: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== i));
  };

  const updateItem = (i: number, field: string, value: string | number) => {
    setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  // 税率ごとに計算
  const calc = (() => {
    let subtotal10 = 0, subtotal8 = 0;
    for (const item of items) {
      const price = parseInt(String(item.unitPrice).replace(/[,，]/g, ''), 10) || 0;
      const lineTotal = price * item.quantity;
      if (item.taxRate === 8) subtotal8 += lineTotal;
      else subtotal10 += lineTotal;
    }
    const tax10 = Math.floor(subtotal10 * 0.1);
    const tax8 = Math.floor(subtotal8 * 0.08);
    return {
      subtotal: subtotal10 + subtotal8,
      subtotal10, subtotal8,
      tax10, tax8,
      tax: tax10 + tax8,
      total: subtotal10 + subtotal8 + tax10 + tax8,
    };
  })();

  const handleSubmit = async () => {
    if (!client.trim()) { alert('取引先を入力してください'); return; }
    if (calc.subtotal <= 0) { alert('品目と金額を入力してください'); return; }

    // 振込先を保存
    if (bankInfo.trim()) {
      try { localStorage.setItem(BANK_STORAGE_KEY, bankInfo.trim()); } catch { /* ignore */ }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/liff/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: uid,
          client: client.trim(),
          issueDate,
          dueDate,
          items: items.filter(i => i.name && i.unitPrice).map(i => ({
            name: i.name,
            quantity: i.quantity,
            unitPrice: parseInt(String(i.unitPrice).replace(/[,，]/g, ''), 10),
            taxRate: i.taxRate,
          })),
          subtotal: calc.subtotal,
          tax: calc.tax,
          total: calc.total,
          bankInfo: bankInfo.trim(),
          memo: memo.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({ total: data.total, invoiceNo: data.invoiceNo });
        setDone(true);
      } else {
        alert(data.error || 'エラーが発生しました');
      }
    } catch {
      alert('送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const openInvoiceHTML = async () => {
    const res = await fetch('/api/liff/invoice-html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceNo: result?.invoiceNo,
        client,
        items: items.filter(i => i.name && i.unitPrice).map(i => ({
          name: i.name, quantity: i.quantity,
          unitPrice: parseInt(String(i.unitPrice).replace(/[,，]/g, ''), 10),
        })),
        subtotal: calc.subtotal, tax: calc.tax, total: calc.total,
        issueDate, dueDate, bankInfo,
        companyName: '',
      }),
    });
    const html = await res.text();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  if (done && result) {
    return (
      <div className="min-h-screen bg-[#f0fdf4] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 text-center shadow-lg max-w-sm w-full">
          <div className="text-[48px] mb-4">✅</div>
          <h2 className="text-[20px] font-black text-gray-900 mb-2">請求書を作成しました</h2>
          <p className="text-[14px] text-gray-600 mb-1">{client} 宛</p>
          <p className="text-[22px] font-black text-gray-900 mb-1">¥{result.total.toLocaleString()}</p>
          <p className="text-[12px] text-gray-400 mb-1">請求書番号: {result.invoiceNo}</p>
          <p className="text-[12px] text-gray-400 mb-4">支払期限: {displayDate(dueDate)}</p>
          <p className="text-[12px] text-[#06C755] mb-5">売上として自動記帳しました ✅</p>
          <button
            onClick={openInvoiceHTML}
            className="w-full bg-white border-2 border-[#06C755] text-[#06C755] font-bold py-3 rounded-full text-[14px] mb-2"
          >
            請求書を表示・印刷
          </button>
          <button onClick={() => window.close()} className="w-full bg-[#06C755] text-white font-bold py-3 rounded-full text-[15px]">
            LINEに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <h1 className="text-[17px] font-black text-gray-900">📄 請求書作成</h1>
      </div>

      <div className="px-4 py-4 space-y-5 pb-32">
        {/* 取引先 */}
        <div>
          <label className="text-[12px] font-bold text-gray-500 block mb-1.5">取引先 *</label>
          <input
            type="text"
            value={client}
            onChange={e => setClient(e.target.value)}
            placeholder="例: ABC建設株式会社"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-[16px] focus:border-[#06C755] focus:ring-1 focus:ring-[#06C755] outline-none"
          />
        </div>

        {/* 発行日 */}
        <div>
          <label className="text-[12px] font-bold text-gray-500 block mb-1.5">発行日</label>
          <input
            type="date"
            value={issueDate}
            onChange={e => setIssueDate(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-[15px] focus:border-[#06C755] outline-none"
          />
        </div>

        {/* 品目 */}
        <div>
          <label className="text-[12px] font-bold text-gray-500 block mb-1.5">品目 *</label>
          {items.map((item, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={item.name}
                  onChange={e => updateItem(i, 'name', e.target.value)}
                  placeholder="品目名（例: 外壁塗装工事）"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-[15px] focus:border-[#06C755] outline-none"
                />
                {items.length > 1 && (
                  <button onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-400 text-[20px] px-1">×</button>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <span className="text-[10px] text-gray-400">数量</span>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)}
                    min={1}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[15px] text-center focus:border-[#06C755] outline-none"
                  />
                </div>
                <div className="flex-[2]">
                  <span className="text-[10px] text-gray-400">単価（税抜）</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={item.unitPrice}
                    onChange={e => updateItem(i, 'unitPrice', e.target.value)}
                    placeholder="¥"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[15px] text-right focus:border-[#06C755] outline-none"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] text-gray-400">税率</span>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => updateItem(i, 'taxRate', 10)}
                      className={`flex-1 py-2 text-[12px] font-bold ${item.taxRate === 10 ? 'bg-[#06C755] text-white' : 'text-gray-500'}`}
                    >10%</button>
                    <button
                      onClick={() => updateItem(i, 'taxRate', 8)}
                      className={`flex-1 py-2 text-[12px] font-bold ${item.taxRate === 8 ? 'bg-[#06C755] text-white' : 'text-gray-500'}`}
                    >8%</button>
                  </div>
                </div>
              </div>
              {(() => {
                const price = parseInt(String(item.unitPrice).replace(/[,，]/g, ''), 10) || 0;
                const lineTotal = price * item.quantity;
                return lineTotal > 0 ? (
                  <p className="text-right text-[13px] text-gray-500 mt-1.5">小計: ¥{lineTotal.toLocaleString()}</p>
                ) : null;
              })()}
            </div>
          ))}
          <button onClick={addItem} className="text-[#06C755] text-[13px] font-bold">+ 品目を追加</button>
        </div>

        {/* 支払期限 */}
        <div>
          <label className="text-[12px] font-bold text-gray-500 block mb-1.5">支払期限 *</label>
          {/* ショートカット */}
          <div className="flex gap-2 mb-2">
            {[
              { m: 1, label: '翌月末' },
              { m: 2, label: '翌々月末' },
              { m: 3, label: '3ヶ月後末' },
            ].map(({ m, label }) => (
              <button
                key={m}
                onClick={() => selectPreset(m)}
                className={`flex-1 py-2 rounded-lg text-[12px] font-bold border ${
                  dueDateMode === 'preset' && selectedPreset === m
                    ? 'bg-[#06C755] text-white border-[#06C755]'
                    : 'bg-white text-gray-500 border-gray-300'
                }`}
              >{label}</button>
            ))}
            <button
              onClick={switchToCustom}
              className={`flex-1 py-2 rounded-lg text-[12px] font-bold border ${
                dueDateMode === 'custom'
                  ? 'bg-[#06C755] text-white border-[#06C755]'
                  : 'bg-white text-gray-500 border-gray-300'
              }`}
            >日付指定</button>
          </div>
          {/* カレンダー（常に表示、自由に変更可能） */}
          <input
            type="date"
            value={dueDate}
            onChange={e => { setDueDate(e.target.value); setDueDateMode('custom'); setSelectedPreset(0); }}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-[15px] focus:border-[#06C755] outline-none"
          />
          <p className="text-[11px] text-gray-400 mt-1">{displayDate(dueDate)}</p>
        </div>

        {/* 振込先 */}
        <div>
          <label className="text-[12px] font-bold text-gray-500 block mb-1.5">振込先口座</label>
          <textarea
            value={bankInfo}
            onChange={e => setBankInfo(e.target.value)}
            placeholder="例: みずほ銀行 渋谷支店 普通 1234567 タナカケンセツ（株）"
            rows={2}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-[14px] focus:border-[#06C755] outline-none resize-none"
          />
          <p className="text-[10px] text-gray-400 mt-0.5">次回から自動で入ります</p>
        </div>

        {/* 備考 */}
        <div>
          <label className="text-[12px] font-bold text-gray-500 block mb-1.5">備考（任意）</label>
          <input
            type="text"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="例: 3月分工事代金"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-[14px] focus:border-[#06C755] outline-none"
          />
        </div>

        {/* 金額サマリー */}
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex justify-between text-[14px] text-gray-600 mb-1">
            <span>小計</span>
            <span>¥{calc.subtotal.toLocaleString()}</span>
          </div>
          {calc.subtotal10 > 0 && (
            <div className="flex justify-between text-[13px] text-gray-500 mb-0.5 pl-2">
              <span>消費税 10%（対象 ¥{calc.subtotal10.toLocaleString()}）</span>
              <span>¥{calc.tax10.toLocaleString()}</span>
            </div>
          )}
          {calc.subtotal8 > 0 && (
            <div className="flex justify-between text-[13px] text-gray-500 mb-0.5 pl-2">
              <span>消費税 8%（対象 ¥{calc.subtotal8.toLocaleString()}）</span>
              <span>¥{calc.tax8.toLocaleString()}</span>
            </div>
          )}
          {calc.subtotal10 === 0 && calc.subtotal8 === 0 && (
            <div className="flex justify-between text-[13px] text-gray-500 mb-1">
              <span>消費税</span>
              <span>¥0</span>
            </div>
          )}
          <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between items-end">
            <span className="text-[16px] font-black text-gray-900">合計（税込）</span>
            <span className="text-[22px] font-black text-gray-900">¥{calc.total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 固定フッター */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <button
          onClick={handleSubmit}
          disabled={submitting || !client.trim() || calc.subtotal <= 0}
          className="w-full bg-[#06C755] text-white font-bold py-3.5 rounded-full text-[16px] disabled:opacity-40 active:scale-[0.98] transition-all"
        >
          {submitting ? '作成中...' : calc.total > 0 ? `請求書を作成（¥${calc.total.toLocaleString()}）` : '請求書を作成'}
        </button>
      </div>
    </div>
  );
}

export default function InvoicePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-gray-400">読み込み中...</p></div>}>
      <InvoiceForm />
    </Suspense>
  );
}
