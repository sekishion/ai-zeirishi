'use client';

import { useApp } from '@/lib/store';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const { state, dispatch } = useApp();
  const searchParams = useSearchParams();
  const freeeConnected = searchParams.get('freee_connected') === 'true';
  const freeeError = searchParams.get('freee_error');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; total: number } | null>(null);

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

      {/* Account */}
      <p className="text-[11px] font-bold text-gray-400 tracking-wider">アカウント</p>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <div className="w-10 h-10 bg-[#1A3A5C] rounded-full text-white flex items-center justify-center font-bold text-[14px]">
            {state.ownerName?.[0] || '田'}
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-bold text-gray-800">{state.companyName || '田中建設 株式会社'}</p>
            <p className="text-[12px] text-gray-400">{state.ownerName || '田中太郎'} ・ スタンダードプラン</p>
          </div>
        </div>
      </div>

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
