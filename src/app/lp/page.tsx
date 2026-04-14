const LINE_ADD_URL = 'https://line.me/R/ti/p/@494bfzwz';
const LINE_BOT_ID = '@494bfzwz';

export const metadata = {
  title: 'AI経理部長 | レシート撮るだけ、経理おわり。',
  description: '中小企業の社長向けAI経理サービス。LINEでレシートを撮るだけで仕訳・記帳・月次レポートまで自動化。',
};

// ====== 共通パーツ ======

function LineAddButton({ size = 'large' }: { size?: 'large' | 'medium' }) {
  const padding = size === 'large' ? 'px-8 py-4 text-[16px]' : 'px-6 py-3.5 text-[15px]';
  return (
    <a
      href={LINE_ADD_URL}
      className={`inline-flex items-center justify-center gap-3 bg-[#06C755] text-white font-bold ${padding} rounded-full shadow-lg hover:bg-[#05b34c] active:scale-[0.98] transition-all w-full max-w-xs`}
    >
      <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
      </svg>
      友だち追加して始める
    </a>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold text-[#06C755] bg-[#f0fdf4] px-3 py-1 rounded-full inline-block mb-3">
      {children}
    </p>
  );
}

function PhoneMockup({ children, caption }: { children: React.ReactNode; caption: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-[280px] border-[3px] border-gray-800 rounded-[28px] overflow-hidden shadow-xl bg-white">
        {/* Status bar */}
        <div className="bg-gray-800 text-white text-[10px] flex justify-between items-center px-4 py-1">
          <span>9:41</span>
          <div className="flex gap-1 items-center">
            <span className="text-[8px]">●●●●</span>
            <span className="text-[8px]">🔋</span>
          </div>
        </div>
        {children}
      </div>
      <p className="text-[12px] text-gray-500 mt-3 text-center">{caption}</p>
    </div>
  );
}

// ====== アプリ画面モックアップ ======

function LineChatMockup() {
  return (
    <PhoneMockup caption="LINEでレシートを送るだけ">
      {/* LINE Header */}
      <div className="bg-[#06C755] text-white px-3 py-2 flex items-center gap-2">
        <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-[12px]">📊</div>
        <span className="text-[13px] font-bold">AI経理部長</span>
      </div>
      {/* Chat */}
      <div className="px-3 py-3 space-y-2.5 bg-[#7ECBF5] min-h-[240px]" style={{ background: 'linear-gradient(180deg, #8FD3F8, #7ECBF5)' }}>
        {/* User sends receipt */}
        <div className="flex justify-end">
          <div className="w-[90px] h-[65px] bg-gray-200 rounded-xl rounded-br-sm flex items-center justify-center text-[20px] shadow-sm">🧾</div>
        </div>
        {/* Bot responds */}
        <div className="flex items-end gap-1.5">
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-[10px] flex-shrink-0 self-start">📊</div>
          <div className="bg-white rounded-xl rounded-bl-sm px-2.5 py-2 shadow-sm max-w-[190px]">
            <p className="text-[11px] text-gray-800 font-medium">✅ 記録しました！</p>
            <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
              ¥3,280 スターバックス<br />→ 会議費<br />
              <span className="text-[10px] text-gray-400">（今月の会議費 計¥12,400 / 4件）</span>
            </p>
          </div>
        </div>
        {/* Quick reply */}
        <div className="flex justify-end gap-1.5 pt-0.5">
          <span className="bg-white text-[#06C755] text-[10px] font-bold px-3 py-1 rounded-full shadow-sm border border-[#06C755]/20">✓ OK</span>
          <span className="bg-white text-gray-500 text-[10px] font-bold px-3 py-1 rounded-full shadow-sm border border-gray-200">✏️ 変更</span>
        </div>
        {/* User asks question */}
        <div className="flex justify-end">
          <div className="bg-[#06C755] text-white px-2.5 py-1.5 rounded-xl rounded-br-sm text-[11px]">今月の経費いくら？</div>
        </div>
        {/* Bot answers with real data */}
        <div className="flex items-end gap-1.5">
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-[10px] flex-shrink-0 self-start">📊</div>
          <div className="bg-white rounded-xl rounded-bl-sm px-2.5 py-2 shadow-sm max-w-[190px]">
            <p className="text-[11px] text-gray-700 leading-relaxed">
              今月の経費は<span className="font-bold">¥248,500</span>です。<br />
              <span className="text-[10px] text-gray-400">材料仕入 ¥180,000<br />交際費 ¥42,000<br />会議費 ¥12,400</span>
            </p>
          </div>
        </div>
      </div>
    </PhoneMockup>
  );
}

function DashboardMockup() {
  return (
    <PhoneMockup caption="経営数字が一目でわかる">
      {/* App Header */}
      <div className="px-4 pt-3 pb-2 bg-white">
        <p className="text-[10px] text-gray-400">あなたの会社</p>
        <p className="text-[14px] font-black text-gray-900">ダッシュボード</p>
      </div>
      <div className="px-3 pb-4 bg-gray-50 space-y-2.5">
        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          {[
            { label: '売上', value: '350万', change: '+12.0%', color: 'text-green-600' },
            { label: '利益', value: '140万', change: '+8.5%', color: 'text-green-600' },
            { label: '手元資金', value: '1,084万', change: '', color: 'text-gray-600' },
          ].map(m => (
            <div key={m.label} className="bg-white rounded-lg p-2 shadow-sm">
              <p className="text-[9px] text-gray-400">{m.label}</p>
              <p className="text-[14px] font-black text-gray-900">{m.value}</p>
              {m.change && <p className={`text-[9px] font-bold ${m.color}`}>{m.change}</p>}
            </div>
          ))}
        </div>
        {/* Notices */}
        <div className="bg-white rounded-lg p-2.5 shadow-sm space-y-1.5">
          <p className="text-[10px] font-bold text-gray-700">お知らせ</p>
          <div className="flex items-start gap-1.5">
            <span className="text-[8px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">INFO</span>
            <p className="text-[10px] text-gray-600">3月の帳簿づけ、47件中44件を自動処理しました</p>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-[8px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold">確認</span>
            <p className="text-[10px] text-gray-600">3件、確認をお願いしたい取引があります</p>
          </div>
        </div>
        {/* AI Accuracy */}
        <div className="bg-white rounded-lg p-2.5 shadow-sm">
          <div className="flex justify-between items-center">
            <p className="text-[10px] font-bold text-gray-700">AI仕訳精度</p>
            <p className="text-[14px] font-black text-[#06C755]">94%</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5">
            <div className="bg-[#06C755] h-1.5 rounded-full" style={{ width: '94%' }} />
          </div>
        </div>
      </div>
    </PhoneMockup>
  );
}

function ReportMockup() {
  return (
    <PhoneMockup caption="月次レポートが自動で届く">
      <div className="px-4 pt-3 pb-2 bg-white">
        <p className="text-[10px] text-gray-400">あなたの会社</p>
        <p className="text-[14px] font-black text-gray-900">3月のレポート</p>
      </div>
      <div className="px-3 pb-4 bg-gray-50 space-y-2.5">
        {/* P/L Summary */}
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: '売上', value: '350万', sub: '+12.0%', color: 'text-green-600' },
              { label: '経費', value: '210万', sub: '+3.2%', color: 'text-red-500' },
              { label: '利益', value: '140万', sub: '+24.5%', color: 'text-green-600' },
            ].map(m => (
              <div key={m.label}>
                <p className="text-[9px] text-gray-400">{m.label}</p>
                <p className="text-[14px] font-black text-gray-900">{m.value}</p>
                <p className={`text-[9px] font-bold ${m.color}`}>{m.sub}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Expense Breakdown */}
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <p className="text-[10px] font-bold text-gray-700 mb-2">経費内訳</p>
          {[
            { name: '材料仕入', pct: 45, amount: '94.5万' },
            { name: '外注費', pct: 25, amount: '52.5万' },
            { name: '交際費', pct: 12, amount: '25.2万' },
            { name: 'その他', pct: 18, amount: '37.8万' },
          ].map(e => (
            <div key={e.name} className="flex items-center gap-2 mb-1.5">
              <p className="text-[10px] text-gray-600 w-14">{e.name}</p>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className="bg-[#06C755] h-2 rounded-full" style={{ width: `${e.pct}%` }} />
              </div>
              <p className="text-[10px] text-gray-500 w-12 text-right">{e.amount}</p>
            </div>
          ))}
        </div>
        {/* AI Comment */}
        <div className="bg-[#f0fdf4] rounded-lg p-2.5">
          <p className="text-[10px] text-gray-700 leading-relaxed">
            💡 交際費が先月の2倍です。ゴルフ場利用が2件ありました。年800万円の枠にはまだ余裕があります。
          </p>
        </div>
      </div>
    </PhoneMockup>
  );
}

// ====== メインLP ======

export default function LPPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ====== Hero ====== */}
      <section className="bg-gradient-to-b from-[#f0fdf4] to-white px-4 pt-10 pb-12">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-[26px] sm:text-[30px] font-black text-gray-900 leading-tight mb-3">
            レシート撮るだけ、<br />経理おわり。
          </h1>
          <p className="text-[14px] text-gray-500 leading-relaxed mb-8">
            LINEで写真を送るだけ。<br />
            AIが仕訳・記帳・月次レポートまで全部やります。
          </p>
          <LineAddButton />
          <p className="text-[11px] text-gray-400 mt-2">無料・登録不要・LINEだけでOK</p>
        </div>
      </section>

      {/* ====== 機能紹介 1: LINE体験 ====== */}
      <section className="px-4 py-12 max-w-lg mx-auto">
        <div className="text-center mb-6">
          <SectionLabel>機能 1</SectionLabel>
          <h2 className="text-[20px] font-black text-gray-900">LINEでレシートを送るだけ</h2>
          <p className="text-[13px] text-gray-500 mt-1">AIが金額・店名を読み取り、業種ルールで自動仕訳。OKを押すだけで記帳完了。</p>
        </div>
        <LineChatMockup />
      </section>

      {/* ====== 機能紹介 2: ダッシュボード ====== */}
      <section className="bg-gray-50 px-4 py-12">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-6">
            <SectionLabel>機能 2</SectionLabel>
            <h2 className="text-[20px] font-black text-gray-900">経営数字が一目でわかる</h2>
            <p className="text-[13px] text-gray-500 mt-1">売上・利益・手元資金をリアルタイムで表示。AIが自動で帳簿をつけています。</p>
          </div>
          <DashboardMockup />
        </div>
      </section>

      {/* ====== 機能紹介 3: 月次レポート ====== */}
      <section className="px-4 py-12">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-6">
            <SectionLabel>機能 3</SectionLabel>
            <h2 className="text-[20px] font-black text-gray-900">月次レポートが自動で届く</h2>
            <p className="text-[13px] text-gray-500 mt-1">経費の内訳、利益の推移、AIからの気づき。税理士に渡せるレベルのレポート。</p>
          </div>
          <ReportMockup />
        </div>
      </section>

      {/* ====== 仕組み ====== */}
      <section className="bg-gray-50 px-4 py-12">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-[20px] font-black text-gray-900">やることは3つだけ</h2>
          </div>
          <div className="space-y-5">
            {[
              { n: '1', icon: '📸', title: 'レシートを撮って送る', desc: 'LINEでパシャッと撮って送信。' },
              { n: '2', icon: '👍', title: '「OK」を押す', desc: 'AIの仕訳結果を確認。合ってたらOKだけ。' },
              { n: '3', icon: '📊', title: '月末にレポートを見る', desc: '売上・経費・利益のサマリーが届きます。' },
            ].map(({ n, icon, title, desc }) => (
              <div key={n} className="flex gap-3 items-start">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[20px] shadow-sm flex-shrink-0">{icon}</div>
                <div className="pt-0.5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold text-white bg-[#06C755] w-5 h-5 rounded-full flex items-center justify-center">{n}</span>
                    <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
                  </div>
                  <p className="text-[13px] text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== 対象ユーザー ====== */}
      <section className="px-4 py-12">
        <div className="max-w-lg mx-auto">
          <h2 className="text-[20px] font-black text-center text-gray-900 mb-6">こんな社長さんへ</h2>
          <div className="space-y-2.5">
            {[
              { q: 'レシートが財布にたまっている', a: '→ 撮って送ればその場で終わり' },
              { q: '現場に出ていて事務作業する時間がない', a: '→ スマホだけで完結します' },
              { q: '記帳代行を頼みたいけど月5万は高い', a: '→ AIなので月¥0（先行体験中）' },
              { q: '「これ何費？」が毎回わからない', a: '→ 業種別ルールでAIが自動判定（精度94%）' },
              { q: 'freeeやMFを入れたけど結局使ってない', a: '→ LINEだけ。アプリ不要です' },
            ].map(({ q, a }, i) => (
              <div key={i} className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-[13px] font-bold text-gray-800">{q}</p>
                <p className="text-[12px] text-[#06C755] mt-0.5">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== 料金 ====== */}
      <section className="bg-gray-50 px-4 py-12">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-[20px] font-black text-gray-900 mb-6">料金</h2>
          <div className="bg-white border-2 border-[#06C755] rounded-2xl p-6 shadow-sm">
            <p className="text-[12px] font-bold text-[#06C755] mb-2">先行体験プラン</p>
            <div className="flex items-end justify-center gap-1 mb-1">
              <span className="text-[42px] font-black text-gray-900 leading-none">¥0</span>
              <span className="text-[14px] text-gray-400 pb-1">/月</span>
            </div>
            <p className="text-[11px] text-gray-400 mb-5">正式リリースまで無料</p>
            <div className="text-left space-y-1.5 mb-6">
              {[
                'レシート撮影 → 自動仕訳・記帳',
                'AIチャットで経理相談し放題',
                '月次レポート自動配信',
                '銀行明細CSV取り込み',
              ].map((f, i) => (
                <p key={i} className="flex items-start gap-2 text-[13px] text-gray-700">
                  <span className="text-[#06C755] font-bold flex-shrink-0">✓</span>{f}
                </p>
              ))}
            </div>
            <LineAddButton size="medium" />
          </div>
        </div>
      </section>

      {/* ====== FAQ ====== */}
      <section className="px-4 py-12">
        <div className="max-w-lg mx-auto">
          <h2 className="text-[20px] font-black text-center text-gray-900 mb-6">よくある質問</h2>
          <div className="space-y-3">
            {[
              { q: '税理士の代わりになりますか？', a: 'いいえ。記帳・仕訳の自動化ツールです。税務申告は税理士にご相談ください。記帳を自動化した上で税理士に渡す使い方がおすすめです。' },
              { q: 'freeeやマネーフォワードとの違いは？', a: '「入力」が不要です。freeeやMFは自分でソフトに入力する前提。AI経理部長はLINEでレシート撮るだけで仕訳まで終わります。' },
              { q: 'データは安全ですか？', a: 'Supabase（AWS）で暗号化保存。アカウントごとにデータは完全に分離されています。' },
              { q: '本当に無料？', a: '先行体験中は完全無料です。正式リリース時に継続するか判断いただけます。' },
            ].map(({ q, a }, i) => (
              <details key={i} className="bg-gray-50 rounded-xl overflow-hidden group">
                <summary className="px-4 py-3 text-[14px] font-bold text-gray-800 cursor-pointer list-none flex items-center justify-between gap-2">
                  <span className="flex-1">{q}</span>
                  <span className="text-gray-300 text-[10px] group-open:rotate-180 transition-transform flex-shrink-0">▼</span>
                </summary>
                <p className="px-4 pb-3 text-[13px] text-gray-600 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ====== Final CTA ====== */}
      <section className="bg-gradient-to-b from-white to-[#f0fdf4] px-4 py-14 text-center">
        <div className="max-w-lg mx-auto">
          <p className="text-[22px] font-black text-gray-900 leading-tight mb-2">
            経理を、LINEで終わらせよう。
          </p>
          <p className="text-[13px] text-gray-500 mb-6">
            友だち追加して、レシートを1枚送ってみてください。
          </p>
          <LineAddButton />
          <p className="text-[11px] text-gray-400 mt-3">LINE ID: {LINE_BOT_ID}</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-4 py-5 text-center">
        <p className="text-[11px] text-gray-400">中央総合株式会社</p>
      </footer>
    </div>
  );
}
