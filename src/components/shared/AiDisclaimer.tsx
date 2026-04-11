'use client';

import { useState } from 'react';
import Link from 'next/link';

interface AiDisclaimerProps {
  compact?: boolean;
}

export function AiDisclaimer({ compact = false }: AiDisclaimerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  if (compact) {
    return (
      <p className="text-[11px] text-gray-400 text-center py-1">
        AIによる自動処理の結果です。税務判断は
        <Link href="/terms" className="text-blue-500 underline">税理士にご確認</Link>
        ください。
      </p>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
      <span className="text-[14px] mt-0.5 shrink-0">&#9888;&#65039;</span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-amber-800 leading-relaxed">
          本サービスのAIによる仕訳分類・税額計算は参考情報です。税理士法に基づく税務相談には該当しません。最終的な税務判断は税理士にご確認ください。
        </p>
        <Link href="/terms" className="text-[11px] text-amber-600 underline mt-1 inline-block">
          利用規約を確認
        </Link>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-400 hover:text-amber-600 shrink-0 p-1"
        aria-label="閉じる"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
