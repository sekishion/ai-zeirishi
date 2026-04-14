'use client';

import { useApp } from '@/lib/store';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';

interface CompanyForm {
  name: string;
  representative_name: string;
  postal_code: string;
  address: string;
  phone: string;
  invoice_registration_number: string;
  bank_account: string;
}

function SettingsContent() {
  const { state, dispatch } = useApp();
  const searchParams = useSearchParams();
  const freeeConnected = searchParams.get('freee_connected') === 'true';
  const freeeError = searchParams.get('freee_error');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; total: number } | null>(null);

  // 会社情報フォーム（請求書発行元情報）
  const [companyForm, setCompanyForm] = useState<CompanyForm>({
    name: '',
    representative_name: '',
    postal_code: '',
    address: '',
    phone: '',
    invoice_registration_number: '',
    bank_account: '',
  });
  const [companyLoaded, setCompanyLoaded] = useState(false);
  const [companySaving, setCompanySaving] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);
  const [companyExpanded, setCompanyExpanded] = useState(true);

  // 初期ロード
  useEffect(() => {
    fetch('/api/settings/company')
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.company) {
          setCompanyForm({
            name: data.company.name || '',
            representative_name: data.company.representative_name || '',
            postal_code: data.company.postal_code || '',
            address: data.company.address || '',
            phone: data.company.phone || '',
            invoice_registration_number: data.company.invoice_registration_number || '',
            bank_account: data.company.bank_account || '',
          });
        }
        setCompanyLoaded(true);
      })
      .catch(() => setCompanyLoaded(true));
  }, []);

  const handleCompanySave = async () => {
    setCompanySaving(true);
    setCompanySaved(false);
    try {
      const res = await fetch('/api/settings/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyForm),
      });
      const data = await res.json();
      if (data.ok) {
        setCompanySaved(true);
        setTimeout(() => setCompanySaved(false), 3000);
      } else {
        alert(data.error || '保存に失敗しました');
      }
    } catch {
      alert('保存に失敗しました');
    } finally {
      setCompanySaving(false);
    }
  };

  const validateRegNumber = (s: string) => !s || /^T\d{13}$/.test(s);
  const regNumberOk = validateRegNumber(companyForm.invoice_registration_number);

  const handleFreeeConnect = () => {
    if (!state.companyId) {
      alert('会社情報の設定を先に完了してください');
      return;
    }
    window.location.href = `/api/auth/freee?company_id=${state.companyId}`;
  };

  const handleFreeeSync = async () => {
    if (!state.companyId) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/freee/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: state.companyId, months: 3 }),
      });
      const data = await res.json();
      if (data.ok) {
        setSyncResult({ synced: data.synced, total: data.total });
      } else {
        alert(`同期エラー: ${data.error}`);
      }
    } catch {
      alert('同期に失敗しました');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-[17px] font-bold text-[#1A3A5C]">設定</h1>

      {/* freee連携通知 */}
      {freeeConnected && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[12px] text-emerald-800">
          freee会計との連携が完了しました。「データを同期」ボタンで取引データを取り込めます。
        </div>
      )}
      {freeeError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-[12px] text-red-800">
          freee連携エラー: {freeeError === 'denied' ? '認可が拒否されました' : freeeError === 'token_failed' ? 'トークンの取得に失敗しました' : freeeError}
        </div>
      )}

      {/* 会社情報（請求書発行元） */}
      <p className="text-[11px] font-bold text-gray-400 tracking-wider">会社情報（請求書発行元）</p>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setCompanyExpanded(!companyExpanded)}
          className="w-full flex items-center gap-3 p-4 text-left"
        >
          <div className="w-10 h-10 bg-[#1A3A5C] rounded-full text-white flex items-center justify-center font-bold text-[14px]">
            {companyForm.name?.[0] || '?'}
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-bold text-gray-800">{companyForm.name || '（未設定）'}</p>
            <p className="text-[12px] text-gray-400">
              {companyForm.invoice_registration_number
                ? <span className="text-emerald-600">登録番号: {companyForm.invoice_registration_number}</span>
                : <span className="text-amber-600">⚠️ インボイス登録番号 未設定</span>}
            </p>
          </div>
          <span className="text-gray-400">{companyExpanded ? '▼' : '▶'}</span>
        </button>

        {companyExpanded && companyLoaded && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-[11px] text-blue-800 leading-relaxed">
                ここに登録した情報は<b>請求書の発行元</b>として自動で表示されます。<br/>
                インボイス登録番号は <b>T+13桁</b> の数字。
                <a href="https://www.invoice-kohyo.nta.go.jp/" target="_blank" rel="noopener" className="underline">国税庁の確認ページ</a>
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-500 block mb-1">会社名 *</label>
              <input
                type="text"
                value={companyForm.name}
                onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })}
                placeholder="例: 田中建設 株式会社"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-[14px] focus:border-[#06C755] focus:ring-1 focus:ring-[#06C755] outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-500 block mb-1">代表者名</label>
              <input
                type="text"
                value={companyForm.representative_name}
                onChange={e => setCompanyForm({ ...companyForm, representative_name: e.target.value })}
                placeholder="例: 田中太郎"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-[14px] focus:border-[#06C755] outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-500 block mb-1">郵便番号</label>
              <input
                type="text"
                value={companyForm.postal_code}
                onChange={e => setCompanyForm({ ...companyForm, postal_code: e.target.value })}
                placeholder="例: 150-0002"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-[14px] focus:border-[#06C755] outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-500 block mb-1">住所 *</label>
              <input
                type="text"
                value={companyForm.address}
                onChange={e => setCompanyForm({ ...companyForm, address: e.target.value })}
                placeholder="例: 東京都渋谷区渋谷1-2-3"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-[14px] focus:border-[#06C755] outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-500 block mb-1">電話番号</label>
              <input
                type="tel"
                value={companyForm.phone}
                onChange={e => setCompanyForm({ ...companyForm, phone: e.target.value })}
                placeholder="例: 03-1234-5678"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-[14px] focus:border-[#06C755] outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-500 block mb-1">
                インボイス登録番号 *
                <span className="text-[10px] text-gray-400 ml-1">適格請求書の必須項目</span>
              </label>
              <input
                type="text"
                value={companyForm.invoice_registration_number}
                onChange={e => setCompanyForm({ ...companyForm, invoice_registration_number: e.target.value })}
                placeholder="T1234567890123"
                className={`w-full border rounded-xl px-4 py-2.5 text-[14px] font-mono focus:ring-1 outline-none ${
                  regNumberOk ? 'border-gray-300 focus:border-[#06C755]' : 'border-red-300 focus:border-red-500'
                }`}
              />
              {!regNumberOk && (
                <p className="text-[10px] text-red-500 mt-0.5">T+13桁の数字を入力してください（例: T1234567890123）</p>
              )}
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-500 block mb-1">振込先口座</label>
              <textarea
                value={companyForm.bank_account}
                onChange={e => setCompanyForm({ ...companyForm, bank_account: e.target.value })}
                placeholder="例: みずほ銀行 渋谷支店&#10;普通 1234567&#10;タナカケンセツ（カ）"
                rows={3}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-[14px] focus:border-[#06C755] outline-none resize-none"
              />
            </div>

            <button
              onClick={handleCompanySave}
              disabled={companySaving || !companyForm.name || !companyForm.address || !regNumberOk}
              className="w-full bg-[#06C755] text-white font-bold py-3 rounded-xl text-[14px] disabled:opacity-40"
            >
              {companySaving ? '保存中...' : companySaved ? '✓ 保存しました' : '会社情報を保存'}
            </button>
          </div>
        )}
      </div>

      {/* LINE連携 */}
      <p className="text-[11px] font-bold text-gray-400 tracking-wider">LINE連携</p>
      <LineLinkSection />

      {/* 会計ソフト連携 */}
      <p className="text-[11px] font-bold text-gray-400 tracking-wider">会計ソフト連携</p>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* freee */}
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#2D8C3C] rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-[11px]">freee</span>
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-gray-800">freee会計</p>
              <p className="text-[11px] text-gray-400">取引データを自動同期</p>
            </div>
            {freeeConnected ? (
              <span className="bg-emerald-50 text-emerald-600 text-[11px] font-bold px-2 py-0.5 rounded-full">接続済み</span>
            ) : (
              <button
                onClick={handleFreeeConnect}
                className="bg-[#2D8C3C] text-white text-[12px] font-bold px-3 py-1.5 rounded-lg hover:bg-[#246F30] transition-colors"
              >
                連携する
              </button>
            )}
          </div>
          {freeeConnected && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={handleFreeeSync}
                disabled={syncing}
                className="w-full bg-gray-50 text-[#1A3A5C] text-[12px] font-bold py-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {syncing ? '同期中...' : 'データを同期（直近3ヶ月）'}
              </button>
              {syncResult && (
                <p className="text-[11px] text-emerald-600 mt-2 text-center">
                  {syncResult.synced}件の新規取引を取り込みました（全{syncResult.total}件中）
                </p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-50" />

        {/* マネーフォワード（今後対応） */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-10 h-10 bg-[#3B7DE9] rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-[9px]">MF</span>
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-medium text-gray-800">マネーフォワード クラウド</p>
            <p className="text-[11px] text-gray-400">近日対応予定</p>
          </div>
          <span className="bg-gray-100 text-gray-400 text-[11px] font-bold px-2 py-0.5 rounded-full">準備中</span>
        </div>
      </div>

      {/* Notifications */}
      <p className="text-[11px] font-bold text-gray-400 tracking-wider">通知</p>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
        {[
          { name: '週次レポート（LINE）', on: true },
          { name: '月次レポート（LINE）', on: true },
          { name: '入金通知（LINE）', on: true },
          { name: '異常値アラート', on: true },
        ].map((item) => (
          <div key={item.name} className="flex items-center gap-3 px-4 py-3">
            <p className="flex-1 text-[13px] text-gray-700">{item.name}</p>
            <div className={`w-[44px] h-[26px] rounded-full relative cursor-pointer ${item.on ? 'bg-[#06C755]' : 'bg-gray-300'}`}>
              <div className={`w-[22px] h-[22px] bg-white rounded-full absolute top-[2px] transition-all ${item.on ? 'right-[2px]' : 'left-[2px]'}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Plan */}
      <p className="text-[11px] font-bold text-gray-400 tracking-wider">プラン</p>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
        <p className="text-[13px] font-bold text-[#1A3A5C]">スタンダードプラン</p>
        <p className="text-[24px] font-black text-[#1A3A5C] mt-1">¥5,000<span className="text-[13px] font-normal text-gray-400">/月</span></p>
        <p className="text-[11px] text-gray-400 mt-1">次回請求: 2026年5月1日</p>
      </div>

      {/* Data management */}
      <p className="text-[11px] font-bold text-gray-400 tracking-wider">データ管理</p>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => {
            if (confirm('すべてのデータをリセットしますか？この操作は取り消せません。')) {
              dispatch({ type: 'RESET_DATA' });
              window.location.href = '/onboarding';
            }
          }}
          className="w-full flex items-center gap-3 px-4 py-3 text-left"
        >
          <span className="text-[18px]">🗑️</span>
          <div className="flex-1">
            <p className="text-[13px] font-medium text-red-600">データをリセット</p>
            <p className="text-[11px] text-gray-400">すべての取引・設定を初期化します</p>
          </div>
        </button>
      </div>

      {/* 法的リンク */}
      <div className="flex justify-center gap-4 text-[11px] text-gray-400 py-2">
        <Link href="/terms" className="underline">利用規約</Link>
        <Link href="/privacy" className="underline">プライバシーポリシー</Link>
      </div>

      <div className="h-4" />
    </div>
  );
}

function LineLinkSection() {
  const [linkCode, setLinkCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkResult, setLinkResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleLink = async () => {
    if (linkCode.length !== 6) return;
    setLinking(true);
    setLinkResult(null);
    try {
      const res = await fetch('/api/account/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: linkCode.toUpperCase() }),
      });
      const data = await res.json();
      setLinkResult({ ok: data.ok, message: data.message || data.error });
      if (data.ok) {
        setLinkCode('');
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch {
      setLinkResult({ ok: false, message: '通信エラー' });
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-[#06C755] rounded-xl flex items-center justify-center">
          <span className="text-white font-bold text-[14px]">L</span>
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-bold text-gray-800">LINEアカウント連携</p>
          <p className="text-[11px] text-gray-400">LINEで登録した取引をWebで見れるようにする</p>
        </div>
      </div>

      <div className="bg-blue-50 rounded-xl p-3 mb-3">
        <p className="text-[11px] text-blue-800 leading-relaxed">
          <b>手順:</b><br/>
          1. LINEで AI経理部長 に「<b>アカウント連携</b>」と送信<br/>
          2. 表示された6桁コードを下に入力<br/>
          3. LINEの取引データがこのWebアプリに表示されます
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={linkCode}
          onChange={e => setLinkCode(e.target.value.toUpperCase().slice(0, 6))}
          placeholder="6桁コード"
          maxLength={6}
          className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-[16px] font-mono text-center tracking-widest focus:border-[#06C755] outline-none uppercase"
        />
        <button
          onClick={handleLink}
          disabled={linking || linkCode.length !== 6}
          className="bg-[#06C755] text-white font-bold px-4 py-2.5 rounded-xl text-[13px] disabled:opacity-40"
        >
          {linking ? '...' : '連携'}
        </button>
      </div>

      {linkResult && (
        <div className={`mt-2 rounded-lg p-2 text-[12px] ${linkResult.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
          {linkResult.message}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-gray-400">読み込み中...</p></div>}>
      <SettingsContent />
    </Suspense>
  );
}
