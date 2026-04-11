'use client';

import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/lp" className="text-blue-600 text-[13px] mb-4 inline-block">&larr; トップに戻る</Link>
      <h1 className="text-[20px] font-bold text-[#1A3A5C] mb-6">プライバシーポリシー</h1>
      <p className="text-[12px] text-gray-400 mb-6">最終更新日: 2026年4月6日</p>

      <div className="space-y-6 text-[13px] text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">1. 事業者情報</h2>
          <p>中央総合株式会社（以下「当社」）は、「AI経理部長」サービス（以下「本サービス」）における個人情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。</p>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">2. 収集する情報</h2>
          <p>当社は、本サービスの提供にあたり、以下の情報を収集します。</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>アカウント情報</strong>: メールアドレス、氏名、会社名</li>
            <li><strong>会計データ</strong>: 取引明細、レシート画像、請求書データ、勘定科目情報</li>
            <li><strong>LINE情報</strong>: LINE表示名、LINEユーザーID（LINE連携時）</li>
            <li><strong>利用ログ</strong>: アクセス日時、利用機能、エラー情報</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">3. 収集しない情報</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>マイナンバー（個人番号）</strong>: 本サービスではマイナンバーを一切収集・保存しません。入力しないでください。</li>
            <li><strong>クレジットカード番号</strong>: 決済処理は外部決済サービスを利用し、当社ではカード情報を保持しません。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">4. 情報の利用目的</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>本サービスの提供（記帳代行、仕訳分類、レポート生成等）</li>
            <li>AIモデルの精度向上のための統計的分析（個人を特定しない形で）</li>
            <li>サービスの改善・新機能の開発</li>
            <li>ユーザーへの重要なお知らせの通知</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">5. 外部サービスへのデータ送信</h2>
          <p>本サービスでは、以下の外部サービスにデータを送信します。</p>
          <div className="mt-2 bg-gray-50 rounded-xl p-3 space-y-2">
            <div>
              <p className="font-bold text-[12px]">AI処理</p>
              <p className="text-[12px] text-gray-500">取引の説明文・レシート画像をAIモデル（DeepSeek, Google Gemini）に送信し、仕訳分類・OCR処理を行います。送信データは一時的に処理され、学習データとしては使用されません。</p>
            </div>
            <div>
              <p className="font-bold text-[12px]">データベース</p>
              <p className="text-[12px] text-gray-500">Supabase（PostgreSQL）にデータを保存します。データセンターはAWS上で運用されています。</p>
            </div>
            <div>
              <p className="font-bold text-[12px]">外部会計ソフト連携（任意）</p>
              <p className="text-[12px] text-gray-500">ユーザーが連携を許可した場合、freee会計・マネーフォワードクラウドとOAuth認証を通じてデータを送受信します。</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">6. データの保管と安全管理</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>データはSSL/TLSで暗号化された通信を通じて送受信されます。</li>
            <li>データベースへのアクセスはRow Level Security（RLS）により、ユーザーごとに分離されています。</li>
            <li>APIキー等の機密情報は環境変数として管理し、ソースコードには含みません。</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">7. データの保存期間</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>サービス利用中: ユーザーのデータはサービス利用期間中保存されます。</li>
            <li>解約後: 解約申請から30日後にデータを削除します。</li>
            <li>法令上の保存義務がある場合は、当該義務期間中保存を継続します。</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">8. 第三者提供</h2>
          <p>当社は、以下の場合を除き、ユーザーの個人情報を第三者に提供しません。</p>
          <ol className="list-decimal pl-5 space-y-1 mt-2">
            <li>ユーザーの同意がある場合</li>
            <li>法令に基づく場合</li>
            <li>人の生命・身体・財産の保護に必要な場合</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">9. ユーザーの権利</h2>
          <p>ユーザーは、当社に対し以下の請求を行うことができます。</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>保有する個人情報の開示</li>
            <li>個人情報の訂正・追加・削除</li>
            <li>個人情報の利用停止</li>
            <li>データのエクスポート（CSV形式）</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">10. お問い合わせ</h2>
          <p>個人情報の取り扱いに関するお問い合わせは、以下までご連絡ください。</p>
          <div className="mt-2 bg-gray-50 rounded-xl p-3">
            <p className="text-[12px]">中央総合株式会社</p>
            <p className="text-[12px] text-gray-500">メール: support@chuo-sogo.co.jp</p>
          </div>
        </section>
      </div>
    </div>
  );
}
