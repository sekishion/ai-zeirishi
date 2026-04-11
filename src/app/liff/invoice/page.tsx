'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: string;
  taxRate: 10 | 8;
  priceMode: 'tax_excluded' | 'tax_included';  // 税抜入力 or 税込入力
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

interface CompanyInfo {
  name: string;
  representative_name: string;
  postal_code: string;
  address: string;
  phone: string;
  invoice_registration_number: string;
  bank_account: string;
}

function InvoiceForm() {
  const searchParams = useSearchParams();
  // 旧 ?uid= 生渡しを廃止。?t=<HMAC token> を使用
  const token = searchParams.get('t') || searchParams.get('uid') || '';

  const today = formatDate(new Date());

  // 取引先（請求先）情報
  const [client, setClient] = useState('');
  const [clientPostalCode, setClientPostalCode] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientRegistrationNumber, setClientRegistrationNumber] = useState('');
  const [showClientDetails, setShowClientDetails] = useState(false);

  // 自社（発行元）情報 - 設定から自動取得
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [companyMissing, setCompanyMissing] = useState<string[]>([]);

  const [issueDate, setIssueDate] = useState(today);
  const [items, setItems] = useState<InvoiceItem[]>([{ name: '', quantity: 1, unitPrice: '', taxRate: 10, priceMode: 'tax_excluded' }]);
  const [dueDate, setDueDate] = useState(formatDate(endOfMonth(addMonths(new Date(), 1))));
  const [dueDateMode, setDueDateMode] = useState<'preset' | 'custom'>('preset');
  const [selectedPreset, setSelectedPreset] = useState(1);
  const [bankInfo, setBankInfo] = useState('');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ total: number; invoiceNo: string } | null>(null);

  // 自社情報を取得
  useEffect(() => {
    if (!token) return;
    fetch(`/api/liff/company?t=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.company) {
          setCompanyInfo(data.company);
          // 銀行口座情報を自動セット
          if (data.company.bank_account) setBankInfo(data.company.bank_account);
          // 必須項目のチェック
          const missing: string[] = [];
          if (!data.company.name) missing.push('会社名');
          if (!data.company.address) missing.push('住所');
          if (!data.company.invoice_registration_number) missing.push('インボイス登録番号');
          setCompanyMissing(missing);
        }
      })
      .catch(() => { /* 取得失敗時はlocalStorageへフォールバック */ });

    // 振込先のlocalStorageフォールバック（自社設定が無い場合）
    try {
      const saved = localStorage.getItem(BANK_STORAGE_KEY);
      if (saved && !bankInfo) setBankInfo(saved);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const selectPreset = (months: number) => {
    setSelectedPreset(months);
    setDueDateMode('preset');
    setDueDate(formatDate(endOfMonth(addMonths(new Date(), months))));
  };

  const switchToCustom = () => {
    setDueDateMode('custom');
    setSelectedPreset(0);
  };

  const addItem = () => setItems([...items, { name: '', quantity: 1, unitPrice: '', taxRate: 10, priceMode: 'tax_excluded' }]);

  const removeItem = (i: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== i));
  };

  const updateItem = (i: number, field: string, value: string | number) => {
    setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  // 税率ごとに計算（税抜入力 / 税込入力 両対応）
  const calc = (() => {
    let subtotal10 = 0, subtotal8 = 0;
    let tax10 = 0, tax8 = 0;
    for (const item of items) {
      const price = parseInt(String(item.unitPrice).replace(/[,，]/g, ''), 10) || 0;
      const lineTotal = price * item.quantity;
      if (item.priceMode === 'tax_included') {
        // 税込入力: 内税計算で税抜きを逆算
        if (item.taxRate === 8) {
          const ex = Math.floor(lineTotal / 1.08);
          subtotal8 += ex;
          tax8 += lineTotal - ex;
        } else {
          const ex = Math.floor(lineTotal / 1.1);
          subtotal10 += ex;
          tax10 += lineTotal - ex;
        }
      } else {
        // 税抜入力: 外税で消費税を計算
        if (item.taxRate === 8) {
          subtotal8 += lineTotal;
          tax8 += Math.floor(lineTotal * 0.08);
        } else {
          subtotal10 += lineTotal;
          tax10 += Math.floor(lineTotal * 0.1);
        }
      }
    }
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
          token,
          client: client.trim(),
          clientPostalCode: clientPostalCode.trim(),
          clientAddress: clientAddress.trim(),
          clientRegistrationNumber: clientRegistrationNumber.trim(),
          issueDate,
          dueDate,
          items: items.filter(i => i.name && i.unitPrice).map(i => ({
            name: i.name,
            quantity: i.quantity,
            unitPrice: parseInt(String(i.unitPrice).replace(/[,，]/g, ''), 10),
            taxRate: i.taxRate,
            priceMode: i.priceMode,
          })),
          subtotal: calc.subtotal,
          subtotal10: calc.subtotal10,
          subtotal8: calc.subtotal8,
          tax: calc.tax,
          tax10: calc.tax10,
          tax8: calc.tax8,
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
        token,
        invoiceNo: result?.invoiceNo,
        client,
        clientPostalCode,
        clientAddress,
        clientRegistrationNumber,
        items: items.filter(i => i.name && i.unitPrice).map(i => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: parseInt(String(i.unitPrice).replace(/[,，]/g, ''), 10),
          taxRate: i.taxRate,
          priceMode: i.priceMode,
        })),
        subtotal: calc.subtotal,
        subtotal10: calc.subtotal10,
        subtotal8: calc.subtotal8,
        tax: calc.tax,
        tax10: calc.tax10,
        tax8: calc.tax8,
        total: calc.total,
        issueDate, dueDate, bankInfo,
        memo,
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
        {/* 適格請求書ガイダンス */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <p className="text-[12px] font-bold text-emerald-800 mb-1.5">📋 適格請求書（インボイス）対応</p>
          <p className="text-[11px] text-emerald-700 leading-relaxed">
            この請求書は2023年10月開始のインボイス制度に対応した形式で発行されます。<br/>
            • 軽減税率8%対象は<b>※マーク</b>と税率内訳が自動で出力されます<br/>
            • 自社のインボイス登録番号は<b>設定画面</b>から登録してください
          </p>
        </div>

        {/* 自社情報の不足警告 */}
        {companyMissing.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-[12px] font-bold text-amber-800 mb-1">⚠️ 自社情報が未設定</p>
            <p className="text-[11px] text-amber-700">
              {companyMissing.join('・')}が未設定です。発行前に <a href="/settings" className="underline font-bold">設定画面</a> で登録してください。<br/>
              特に<b>インボイス登録番号</b>は適格請求書の必須項目です。
            </p>
          </div>
        )}

        {companyInfo && companyMissing.length === 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <p className="text-[10px] text-gray-500 mb-1">発行者（自社）</p>
            <p className="text-[13px] font-bold text-gray-800">{companyInfo.name}</p>
            <p className="text-[11px] text-gray-600">{companyInfo.address}</p>
            <p className="text-[11px] text-emerald-700 font-mono mt-0.5">登録番号: {companyInfo.invoice_registration_number}</p>
          </div>
        )}

        {/* 取引先 */}
        <div>
          <label className="text-[12px] font-bold text-gray-500 block mb-1.5">取引先（請求先）*</label>
          <input
            type="text"
            value={client}
            onChange={e => setClient(e.target.value)}
            placeholder="例: ABC建設株式会社 御中"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-[16px] focus:border-[#06C755] focus:ring-1 focus:ring-[#06C755] outline-none"
          />

          <button
            type="button"
            onClick={() => setShowClientDetails(!showClientDetails)}
            className="text-[11px] text-[#06C755] font-bold mt-2 underline"
          >
            {showClientDetails ? '▼ 取引先の詳細を隠す' : '▶ 取引先の住所・登録番号を入力（任意）'}
          </button>

          {showClientDetails && (
            <div className="mt-2 space-y-2 bg-gray-50 rounded-xl p-3">
              <div>
                <span className="text-[10px] text-gray-500">郵便番号</span>
                <input
                  type="text"
                  value={clientPostalCode}
                  onChange={e => setClientPostalCode(e.target.value)}
                  placeholder="例: 150-0002"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[14px] focus:border-[#06C755] outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] text-gray-500">住所</span>
                <input
                  type="text"
                  value={clientAddress}
                  onChange={e => setClientAddress(e.target.value)}
                  placeholder="例: 東京都渋谷区渋谷1-2-3"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[14px] focus:border-[#06C755] outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] text-gray-500">取引先のインボイス登録番号</span>
                <input
                  type="text"
                  value={clientRegistrationNumber}
                  onChange={e => setClientRegistrationNumber(e.target.value)}
                  placeholder="T1234567890123（任意）"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[14px] font-mono focus:border-[#06C755] outline-none"
                />
              </div>
            </div>
          )}
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
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-gray-400">
                      単価（{item.priceMode === 'tax_included' ? '税込' : '税抜'}）
                    </span>
                    <button
                      type="button"
                      onClick={() => updateItem(i, 'priceMode', item.priceMode === 'tax_included' ? 'tax_excluded' : 'tax_included')}
                      className="text-[10px] text-[#06C755] font-bold underline"
                    >
                      {item.priceMode === 'tax_included' ? '→税抜' : '→税込'}
                    </button>
                  </div>
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
                      className={`flex-1 py-2 text-[12px] font-bold ${item.taxRate === 8 ? 'bg-amber-500 text-white' : 'text-gray-500'}`}
                    >8%※</button>
                  </div>
                </div>
              </div>
              {item.taxRate === 8 && (
                <p className="text-[10px] text-amber-700 mt-1">※ 軽減税率対象品目（飲食料品・新聞）</p>
              )}
              {(() => {
                const price = parseInt(String(item.unitPrice).replace(/[,，]/g, ''), 10) || 0;
                const lineTotal = price * item.quantity;
                return lineTotal > 0 ? (
                  <p className="text-right text-[13px] text-gray-500 mt-1.5">
                    小計: ¥{lineTotal.toLocaleString()}
                    <span className="text-[10px] text-gray-400 ml-1">
                      ({item.priceMode === 'tax_included' ? '税込' : '税抜'})
                    </span>
                  </p>
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
