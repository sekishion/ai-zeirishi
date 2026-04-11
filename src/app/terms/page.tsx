'use client';

import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/lp" className="text-blue-600 text-[13px] mb-4 inline-block">&larr; トップに戻る</Link>
      <h1 className="text-[20px] font-bold text-[#1A3A5C] mb-6">利用規約</h1>
      <p className="text-[12px] text-gray-400 mb-6">最終更新日: 2026年4月6日</p>

      <div className="space-y-6 text-[13px] text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">第1条（適用）</h2>
          <p>本規約は、中央総合株式会社（以下「当社」）が提供する「AI経理部長」サービス（以下「本サービス」）の利用に関する条件を定めるものです。利用者（以下「ユーザー」）は、本規約に同意のうえ本サービスを利用するものとします。</p>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">第2条（サービスの内容）</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>本サービスは、AIを活用した記帳代行、経費精算、月次レポート生成、請求書管理等の経理業務支援を提供します。</li>
            <li>本サービスは税理士業務（税務代理、税務書類の作成、税務相談）を行うものではありません。</li>
            <li>本サービスが提供する仕訳分類、経費分類、税額計算等の情報は参考値であり、最終的な判断はユーザーご自身、または資格を有する税理士にご確認ください。</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">第3条（AIによる処理に関する免責）</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>本サービスはAI（人工知能）を用いて取引の自動分類、レシートの読み取り（OCR）、チャットによる質問応答等を行いますが、その結果の正確性・完全性を保証するものではありません。</li>
            <li>AIによる仕訳提案は税理士法第2条に定める「税務相談」に該当しない、一般的な会計処理の提案です。個別の税務判断が必要な場合は、必ず税理士にご相談ください。</li>
            <li>AIの判断に基づく処理結果により生じた損害について、当社は故意または重大な過失がある場合を除き、責任を負いません。</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">第4条（ユーザーの責任）</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>ユーザーは、本サービスに入力する情報（取引データ、レシート画像等）の正確性について責任を負います。</li>
            <li>確定申告書の提出、納税等の税務手続きはユーザーご自身の責任で行うものとします。</li>
            <li>ユーザーは、マイナンバー（個人番号）を本サービスに入力しないでください。</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">第5条（外部サービスとの連携）</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>本サービスは、freee会計、マネーフォワードクラウド等の外部サービスとAPI連携する機能を提供する場合があります。</li>
            <li>外部サービスとの連携にあたり、ユーザーは当該外部サービスの利用規約にも従うものとします。</li>
            <li>外部サービスの仕様変更、障害等により連携機能が利用できない場合があります。</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">第6条（データの取り扱い）</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>ユーザーが入力した会計データは、本サービスの提供およびサービス改善の目的でのみ使用します。</li>
            <li>当社は、AIモデルの学習にユーザーの個別データを使用しません。</li>
            <li>データの保存・管理はSupabase（データベース）およびVercel（ホスティング）上で行われます。</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">第7条（電子帳簿保存法への対応）</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>本サービスは電子帳簿保存法に準拠した記録の保存に努めますが、法令で求められる全ての要件を満たすことを保証するものではありません。</li>
            <li>電子帳簿保存法に基づく帳簿の保存義務はユーザーが負うものとし、必要に応じて税理士にご確認ください。</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">第8条（利用料金）</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>本サービスの利用料金は、別途当社が定める料金表に従います。</li>
            <li>料金の変更は、30日前までにユーザーに通知します。</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">第9条（解約）</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>ユーザーは、当月末日までに当社に通知することで、翌月末日をもって本サービスを解約できます。</li>
            <li>解約後、ユーザーのデータは30日間保持した後、削除します。データのエクスポートは解約前に行ってください。</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">第10条（規約の変更）</h2>
          <p>当社は、本規約を変更する場合、変更内容を本サービス上で通知します。変更後に本サービスを利用した場合、変更後の規約に同意したものとみなします。</p>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-[#1A3A5C] mb-2">第11条（準拠法・裁判管轄）</h2>
          <p>本規約は日本法に準拠し、本サービスに関する紛争は東京地方裁判所を第一審の専属的合意管轄裁判所とします。</p>
        </section>

        <div className="border-t border-gray-200 pt-4 mt-8">
          <p className="text-[12px] text-gray-400">
            中央総合株式会社<br />
            お問い合わせ: support@chuo-sogo.co.jp
          </p>
        </div>
      </div>
    </div>
  );
}
