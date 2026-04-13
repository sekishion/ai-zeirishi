'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';
import { useRouter } from 'next/navigation';

const INDUSTRIES = ['建設業', '飲食業', '小売業', 'IT・Web', '不動産', '製造業', '医療・クリニック', 'コンサル', 'その他'];

export default function OnboardingPage() {
  const { dispatch } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [industry, setIndustry] = useState('');

  const handleComplete = () => {
    dispatch({
      type: 'COMPLETE_SETUP',
      companyName: companyName || '',
      ownerName: ownerName || '',
      companyInfo: {
        industry: industry || '建設業',
        employeeCount: 10,
        annualRevenue: '1億',
        fiscalYearEnd: 3,
        capitalAmount: 10000000,
      },
    });
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Progress */}
      <div className="px-6 pt-12 pb-4">
        <div className="flex gap-2">
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex-1 h-1 rounded-full ${s <= step ? 'bg-[#1A3A5C]' : 'bg-gray-200'}`} />
          ))}
        </div>
        <p className="text-[12px] text-gray-400 mt-2 text-right">{step} / 3</p>
      </div>

      <div className="flex-1 px-6 flex flex-col">
        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="flex-1 flex flex-col justify-center">
            <div className="text-center mb-12">
              <div className="w-20 h-20 bg-[#1A3A5C] rounded-2xl mx-auto flex items-center justify-center mb-6">
                <span className="text-[36px]">📊</span>
              </div>
              <h1 className="text-[22px] font-black text-[#1A3A5C]">AI経理部長</h1>
              <p className="text-[14px] text-gray-500 mt-2">経理のことは全部おまかせください</p>
            </div>

            <div className="space-y-3 mb-8">
              {['銀行明細から自動で仕訳', 'レシートを撮るだけで経費記録', '月次レポートが自動で届く', '経理の質問にAIが即答'].map(t => (
                <div key={t} className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-emerald-50 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-[12px]">✓</span>
                  </div>
                  <p className="text-[14px] text-gray-700">{t}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full py-4 bg-[#1A3A5C] text-white rounded-2xl text-[16px] font-bold"
            >
              はじめる
            </button>
            <p className="text-center text-[12px] text-gray-400 mt-3">3ステップ・1分で完了</p>
          </div>
        )}

        {/* Step 2: Company info */}
        {step === 2 && (
          <div className="flex-1 flex flex-col">
            <h2 className="text-[20px] font-bold text-[#1A3A5C] mt-4">会社について教えてください</h2>
            <p className="text-[13px] text-gray-400 mt-1 mb-8">AIがあなたの会社に合わせて最適化します</p>

            <div className="space-y-5 flex-1">
              <div>
                <label className="text-[13px] font-bold text-gray-600 block mb-2">会社名</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="例: 田中建設 株式会社"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-[#1A3A5C] focus:ring-2 focus:ring-[#1A3A5C]/10"
                />
              </div>

              <div>
                <label className="text-[13px] font-bold text-gray-600 block mb-2">あなたのお名前</label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  placeholder="例: 田中"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-[#1A3A5C] focus:ring-2 focus:ring-[#1A3A5C]/10"
                />
              </div>

              <div>
                <label className="text-[13px] font-bold text-gray-600 block mb-2">業種</label>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRIES.map(i => (
                    <button
                      key={i}
                      onClick={() => setIndustry(i)}
                      className={`px-4 py-2 rounded-full text-[13px] font-medium transition-colors ${
                        industry === i
                          ? 'bg-[#1A3A5C] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="py-6">
              <button
                onClick={() => setStep(3)}
                disabled={!companyName || !ownerName || !industry}
                className="w-full py-4 bg-[#1A3A5C] text-white rounded-2xl text-[16px] font-bold disabled:opacity-30"
              >
                次へ
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Ready */}
        {step === 3 && (
          <div className="flex-1 flex flex-col justify-center">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-emerald-50 rounded-full mx-auto flex items-center justify-center mb-6">
                <span className="text-[40px]">🎉</span>
              </div>
              <h2 className="text-[20px] font-bold text-[#1A3A5C]">準備完了！</h2>
              <p className="text-[14px] text-gray-500 mt-2">{companyName}の経理、任せてください</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-5 mb-8">
              <p className="text-[12px] font-bold text-gray-400 mb-3">次にやること</p>
              {[
                { num: '1', text: '銀行口座を連携する', desc: '明細を自動で取り込みます' },
                { num: '2', text: 'LINEで友だち追加する', desc: 'レシートや質問はLINEで' },
                { num: '3', text: '月末まで待つだけ', desc: 'AIが自動で処理します' },
              ].map(item => (
                <div key={item.num} className="flex items-start gap-3 mb-3 last:mb-0">
                  <div className="w-6 h-6 bg-[#1A3A5C] rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[12px] font-bold">{item.num}</span>
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-gray-800">{item.text}</p>
                    <p className="text-[12px] text-gray-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleComplete}
              className="w-full py-4 bg-[#1A3A5C] text-white rounded-2xl text-[16px] font-bold"
            >
              ダッシュボードを見る
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 text-gray-400 text-[13px] mt-2"
            >
              あとで設定する
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
