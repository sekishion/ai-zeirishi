'use client';

import Link from 'next/link';

interface FilingStep {
  num: number;
  title: string;
  description: string;
  status: 'done' | 'current' | 'upcoming';
  action?: string;
}

const steps: FilingStep[] = [
  { num: 1, title: '月次帳簿の確定', description: '1〜3月の仕訳がすべて完了しているか確認', status: 'done' },
  { num: 2, title: '決算整理仕訳', description: '減価償却・引当金・前払費用などの決算仕訳をAIが自動作成', status: 'done' },
  { num: 3, title: '決算書の作成', description: '貸借対照表・損益計算書・株主資本等変動計算書をAIが生成', status: 'current', action: '確認する' },
  { num: 4, title: '税理士レビュー', description: '提携税理士が決算書と申告書をチェック', status: 'upcoming' },
  { num: 5, title: '法人税申告書の作成', description: 'AIが下書き → 税理士が最終確認 → 電子申告', status: 'upcoming' },
  { num: 6, title: '消費税申告書の作成', description: '課税区分の集計 → 申告書生成 → 提出', status: 'upcoming' },
  { num: 7, title: '納付', description: '法人税・消費税・地方税の納付', status: 'upcoming' },
];

export default function FilingPage() {
  const currentStep = steps.find(s => s.status === 'current');
  const progress = Math.round((steps.filter(s => s.status === 'done').length / steps.length) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/analysis" className="text-[#1A3A5C] p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-[17px] font-bold text-[#1A3A5C]">確定申告・決算</h1>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex justify-between items-center mb-2">
          <p className="text-[13px] font-bold text-[#1A3A5C]">2025年度 法人決算</p>
          <span className="text-[12px] font-bold text-[#1A3A5C]">{progress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
          <div className="bg-[#1A3A5C] h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-[12px] text-gray-400">
          申告期限: <strong className="text-gray-600">2026年5月31日</strong>（あと{Math.max(0, Math.ceil((new Date('2026-05-31').getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}日）
        </p>
      </div>

      {/* Current step highlight */}
      {currentStep && (
        <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-[14px] font-black text-blue-600">
              {currentStep.num}
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-blue-800">次にやること: {currentStep.title}</p>
              <p className="text-[12px] text-blue-600">{currentStep.description}</p>
            </div>
          </div>
          {currentStep.action && (
            <button className="w-full mt-3 py-3 bg-[#1A3A5C] text-white rounded-xl text-[14px] font-bold">
              {currentStep.action} →
            </button>
          )}
        </div>
      )}

      {/* Steps */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[12px] font-bold text-gray-400 mb-3">申告ステップ</p>
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-start gap-3 mb-4 last:mb-0">
            {/* Connector line */}
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 ${
                s.status === 'done' ? 'bg-emerald-100 text-emerald-600' :
                s.status === 'current' ? 'bg-[#1A3A5C] text-white' :
                'bg-gray-100 text-gray-400'
              }`}>
                {s.status === 'done' ? '✓' : s.num}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-0.5 h-8 ${s.status === 'done' ? 'bg-emerald-200' : 'bg-gray-200'}`} />
              )}
            </div>
            <div className={`flex-1 ${s.status === 'upcoming' ? 'opacity-40' : ''}`}>
              <p className={`text-[13px] font-bold ${s.status === 'current' ? 'text-[#1A3A5C]' : 'text-gray-700'}`}>
                {s.title}
              </p>
              <p className="text-[12px] text-gray-400">{s.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* AI note */}
      <div className="bg-sky-50 rounded-2xl border border-sky-100 p-4">
        <p className="text-[12px] font-bold text-sky-800 mb-1">🤖 AIからのお知らせ</p>
        <p className="text-[12px] text-sky-700 leading-relaxed">
          1〜3月の帳簿は95%自動処理済みです。決算整理仕訳も下書きが完了しています。
          次は決算書を確認して、税理士にレビューを依頼してください。
        </p>
      </div>
    </div>
  );
}
