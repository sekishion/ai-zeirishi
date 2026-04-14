import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <p className="text-[64px] mb-4">🔍</p>
        <h1 className="text-[22px] font-black text-[#1A3A5C] mb-2">ページが見つかりません</h1>
        <p className="text-[14px] text-gray-500 mb-8 leading-relaxed">
          お探しのページは移動または削除された可能性があります。
        </p>
        <div className="space-y-3">
          <Link
            href="/"
            className="block w-full py-3.5 bg-[#1A3A5C] text-white rounded-2xl text-[15px] font-bold text-center"
          >
            ダッシュボードに戻る
          </Link>
          <Link
            href="/lp"
            className="block w-full py-3.5 bg-white border-2 border-gray-200 text-gray-600 rounded-2xl text-[14px] font-bold text-center"
          >
            トップページを見る
          </Link>
        </div>
      </div>
    </div>
  );
}
