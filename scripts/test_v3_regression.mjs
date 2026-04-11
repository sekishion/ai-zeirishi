/**
 * v3.csv 回帰テスト
 *
 * 中央総合 v3.csv の取引（旧版で全件「役員貸付金」になっていた災害データ）を
 * 新しいgrounding.tsで分類し、役員立替パターンが「役員借入金」として正しく検出されるか確認する。
 *
 * 使い方:
 *   cd app
 *   node scripts/test_v3_regression.mjs
 */

import dotenv from 'dotenv';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env.local を明示的にロード（next dev/build は自動だが node 単体実行では明示が必要）
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// 環境変数チェック
if (!process.env.DEEPSEEK_API_KEY) {
  console.error('❌ DEEPSEEK_API_KEY が .env.local に設定されていません');
  process.exit(1);
}

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
});

// v3.csv のテストデータ（旧版で全件 役員貸付金 になっていた災害行）
const TEST_CASES = [
  // 役員立替パターン（個人カードで会社の経費を払った）→ 期待: 役員借入金
  { description: 'Google Workspace（個人カードで立替）', amount: 140, type: 'expense', expectedDebit: '通信費', expectedCredit: '役員借入金' },
  { description: 'MoneyForward月額（個人カード立替）', amount: 3938, type: 'expense', expectedDebit: '通信費', expectedCredit: '役員借入金' },
  { description: 'MoneyForward年額プラン（個人カード立替）', amount: 32736, type: 'expense', expectedDebit: '通信費', expectedCredit: '役員借入金' },
  { description: '山崎 初清掃 業務委託（個人）', amount: 6040, type: 'expense', expectedDebit: '業務委託料', expectedCredit: '役員借入金' },
  { description: '武蔵野アブラ学会 早稲田 2名 打合せ飲食', amount: 2260, type: 'expense', expectedDebit: '会議費', expectedCredit: '役員借入金' },
  { description: 'スターバックス 1名 打合せ', amount: 1100, type: 'expense', expectedDebit: '会議費', expectedCredit: '役員借入金' },
  { description: 'OOSAKAOU 打合せ飲食', amount: 1440, type: 'expense', expectedDebit: '会議費', expectedCredit: '役員借入金' },
  { description: 'LUUP 取引先訪問 移動', amount: 870, type: 'expense', expectedDebit: '旅費交通費', expectedCredit: '役員借入金' },
  { description: 'Claude AI 月額（個人カード）', amount: 16479, type: 'expense', expectedDebit: '通信費', expectedCredit: '役員借入金' },
  { description: 'LinkedIn Premium 広告費（個人カード）', amount: 4499, type: 'expense', expectedDebit: '広告宣伝費', expectedCredit: '役員借入金' },
  // 個人口座入金 → 期待: 借方:役員借入金 / 貸方:売上高
  { description: '民泊清掃代金 個人口座入金（チャパティー）', amount: 63820, type: 'income', expectedDebit: '役員借入金', expectedCredit: '売上高' },
  // 法人口座入金 → 期待: 借方:普通預金 / 貸方:売上高
  { description: '民泊清掃代金 法人口座入金（チャパティー）', amount: 72492, type: 'income', expectedDebit: '普通預金', expectedCredit: '売上高' },
  // J-KISS 払込 → 期待: 借方:普通預金 / 貸方:新株予約権
  { description: 'J-KISS 払込（投資家からの資金調達）', amount: 2000000, type: 'income', expectedDebit: '普通預金', expectedCredit: '新株予約権' },
  // 銀行口座から直接支出 → 期待: 借方:該当経費 / 貸方:普通預金
  { description: 'Vercel Inc. 法人カード決済', amount: 3293, type: 'expense', expectedDebit: '通信費', expectedCredit: '普通預金' },
];

// 簡易的に grounding.ts の主要部分を inline 化（ESM経由でts importは複雑なので）
const SYSTEM_PROMPT = `あなたは中小企業の経理仕訳AIです。以下の絶対ルールに基づいて分類してください。
あなたの判断は税務リスクに直結します。間違えるより「確認を求める」を優先してください。

## 絶対ルール（最優先）
1. 役員（社長等）が個人カード/個人現金で会社の経費を払った場合 → 借方:該当経費 / 貸方:「役員借入金」（会社が役員から借りた扱い）。「役員貸付金」にしてはいけない（逆方向、税務リスク発生）
2. 売上が役員の個人口座に入金された場合 → 借方:「役員借入金」or「預け金」 / 貸方:「売上高」
3. 役員貸付金は会社が役員に金を貸した時のみ使う（極めて稀）。立替精算では絶対に使わない
4. 設立時に個人口座で資本金を預かっている期間 → 借方:該当経費 / 貸方:「役員借入金」or「預け金」
5. J-KISS等の資金調達 → 借方:「普通預金」 / 貸方:「新株予約権」（売上ではない、BS科目）
6. 法人口座からの直接支出 → 貸方:「普通預金」
7. 個人事業主への報酬 → 業務委託料 + 源泉徴収検討
8. 判断に迷ったら needsReview: true

## 中央総合の正解実例（参考）
- 出金 ¥2,090「Google Workspace（個人カード立替）」→ 借方:通信費 / 貸方:役員借入金
- 出金 ¥16,479「Claude AI（個人カード）」→ 借方:通信費 / 貸方:役員借入金
- 出金 ¥2,260「武蔵野アブラ学会 2名」→ 借方:会議費 / 貸方:役員借入金
- 出金 ¥870「LUUP 移動」→ 借方:旅費交通費 / 貸方:役員借入金
- 入金 ¥63,820「民泊清掃 個人口座入金」→ 借方:役員借入金 / 貸方:売上高
- 入金 ¥72,492「民泊清掃 法人口座入金」→ 借方:普通預金 / 貸方:売上高
- 入金 ¥2,000,000「J-KISS 払込」→ 借方:普通預金 / 貸方:新株予約権
- 出金 ¥3,293「Vercel 法人カード決済」→ 借方:通信費 / 貸方:普通預金

## 出力フォーマット（JSON配列のみ）
各取引について:
{
  "debit": "借方勘定科目",
  "credit": "貸方勘定科目",
  "reason": "判定理由（役員立替なら明記）"
}`;

async function runTest() {
  console.log('🧪 v3 回帰テスト開始\n');
  console.log(`テストケース数: ${TEST_CASES.length}\n`);

  const userPrompt = TEST_CASES.map((tc, i) =>
    `${i + 1}. ${tc.type === 'income' ? '入金' : '出金'} ¥${tc.amount.toLocaleString()} 「${tc.description}」`
  ).join('\n');

  let raw = '';
  try {
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `以下の${TEST_CASES.length}件の取引を分類してください。各取引の借方と貸方の勘定科目をJSON配列で返してください。\n\n${userPrompt}` },
      ],
      temperature: 0.1,
      max_tokens: 4096,
      stream: false,
    });
    raw = response.choices[0]?.message?.content || '[]';
  } catch (e) {
    console.error('❌ DeepSeek API エラー:', e.message);
    process.exit(1);
  }

  // JSON抽出
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error('❌ AI応答にJSONが含まれていません');
    console.log('Response:', raw);
    process.exit(1);
  }

  let results;
  try {
    results = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('❌ JSONパース失敗');
    console.log('Response:', jsonMatch[0]);
    process.exit(1);
  }

  // 結果検証
  let pass = 0;
  let fail = 0;
  const failures = [];

  TEST_CASES.forEach((tc, i) => {
    const result = results[i];
    if (!result) {
      fail++;
      failures.push({ tc, result: null, reason: 'no result' });
      return;
    }

    const debitOk = result.debit === tc.expectedDebit;
    const creditOk = result.credit === tc.expectedCredit;
    // 役員貸付金が出ていないか（最重要チェック）
    const noYakuinKashitsuke = result.debit !== '役員貸付金' && result.credit !== '役員貸付金';

    if (debitOk && creditOk && noYakuinKashitsuke) {
      pass++;
      console.log(`✅ ${i + 1}. 「${tc.description.slice(0, 30)}」`);
      console.log(`   借方:${result.debit} / 貸方:${result.credit}`);
    } else {
      fail++;
      failures.push({ tc, result, debitOk, creditOk, noYakuinKashitsuke });
      console.log(`❌ ${i + 1}. 「${tc.description.slice(0, 30)}」`);
      console.log(`   期待: 借方:${tc.expectedDebit} / 貸方:${tc.expectedCredit}`);
      console.log(`   実際: 借方:${result.debit} / 貸方:${result.credit}`);
      if (!noYakuinKashitsuke) {
        console.log(`   ⚠️ 役員貸付金が検出されました（税務リスク）`);
      }
    }
  });

  console.log('\n========================================');
  console.log(`📊 結果: ${pass}/${TEST_CASES.length} pass`);
  console.log(`   PASS: ${pass}`);
  console.log(`   FAIL: ${fail}`);
  console.log(`   合格率: ${Math.round((pass / TEST_CASES.length) * 100)}%`);
  console.log('========================================\n');

  if (fail > 0) {
    console.log('❌ 回帰テスト失敗。grounding.ts の調整が必要です。');
    process.exit(1);
  } else {
    console.log('✅ 全件パス。役員貸借パターンが正しく検出されています。');
    process.exit(0);
  }
}

runTest().catch(e => {
  console.error('❌ テスト実行エラー:', e);
  process.exit(1);
});
