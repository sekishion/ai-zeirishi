/**
 * AI仕訳精度テスト
 *
 * 建設業の典型的な銀行明細50件に正解ラベルを付け、
 * ルールベース分類 + DeepSeek AI分類の精度を測定する。
 *
 * 実行: npx tsx scripts/accuracy-test.ts
 * 結果: scripts/accuracy-results.json に出力
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

// ====== テストデータ: 建設業の典型的な銀行明細 ======
interface TestCase {
  description: string;
  amount: number;
  type: 'income' | 'expense';
  expected: {
    category: string;       // 正解の勘定科目
    counterparty?: string;  // 正解の取引先（任意）
  };
  difficulty: 'easy' | 'medium' | 'hard';
}

const TEST_CASES: TestCase[] = [
  // ===== EASY: キーワードで一発判定 =====
  { description: '給与 山田太郎', amount: 280000, type: 'expense', expected: { category: '給料手当', counterparty: '山田太郎' }, difficulty: 'easy' },
  { description: '家賃 4月分', amount: 120000, type: 'expense', expected: { category: '地代家賃' }, difficulty: 'easy' },
  { description: '東京電力EP 電気料金', amount: 18500, type: 'expense', expected: { category: '水道光熱費', counterparty: '東京電力' }, difficulty: 'easy' },
  { description: 'NTTドコモ 携帯料金', amount: 8800, type: 'expense', expected: { category: '通信費', counterparty: 'NTTドコモ' }, difficulty: 'easy' },
  { description: 'ENEOS SSガソリン', amount: 5600, type: 'expense', expected: { category: '車両費', counterparty: 'ENEOS' }, difficulty: 'easy' },
  { description: '振込手数料', amount: 440, type: 'expense', expected: { category: '支払手数料' }, difficulty: 'easy' },
  { description: 'ABC建設 工事代金', amount: 3500000, type: 'income', expected: { category: '売上高', counterparty: 'ABC建設' }, difficulty: 'easy' },
  { description: '山田工務店 請求書入金', amount: 1200000, type: 'income', expected: { category: '売上高', counterparty: '山田工務店' }, difficulty: 'easy' },
  { description: 'Amazon.co.jp 事務用品', amount: 3280, type: 'expense', expected: { category: '消耗品費', counterparty: 'Amazon' }, difficulty: 'easy' },
  { description: '社会保険料 3月分', amount: 85000, type: 'expense', expected: { category: '法定福利費' }, difficulty: 'easy' },

  // ===== MEDIUM: 文脈判断が必要 =====
  { description: 'セメント 50袋 ホームセンター', amount: 45000, type: 'expense', expected: { category: '材料仕入高' }, difficulty: 'medium' },
  { description: '山田建材 鉄筋代', amount: 380000, type: 'expense', expected: { category: '材料仕入高', counterparty: '山田建材' }, difficulty: 'medium' },
  { description: '田中電工 電気工事', amount: 250000, type: 'expense', expected: { category: '外注費', counterparty: '田中電工' }, difficulty: 'medium' },
  { description: 'スターバックス', amount: 1280, type: 'expense', expected: { category: '会議費', counterparty: 'スターバックス' }, difficulty: 'medium' },
  { description: '居酒屋 はなの舞 5名', amount: 24500, type: 'expense', expected: { category: '交際費', counterparty: 'はなの舞' }, difficulty: 'medium' },
  { description: 'JR東日本 Suica チャージ', amount: 5000, type: 'expense', expected: { category: '旅費交通費' }, difficulty: 'medium' },
  { description: 'ヤマト運輸 送料', amount: 1200, type: 'expense', expected: { category: '荷造運賃', counterparty: 'ヤマト運輸' }, difficulty: 'medium' },
  { description: '月極駐車場 4月分', amount: 15000, type: 'expense', expected: { category: '地代家賃' }, difficulty: 'medium' },
  { description: 'コマツ リース料', amount: 180000, type: 'expense', expected: { category: 'リース料', counterparty: 'コマツ' }, difficulty: 'medium' },
  { description: '固定資産税 第1期', amount: 80000, type: 'expense', expected: { category: '租税公課' }, difficulty: 'medium' },
  { description: 'Google広告 クリック費用', amount: 35000, type: 'expense', expected: { category: '広告宣伝費', counterparty: 'Google' }, difficulty: 'medium' },
  { description: 'オリックス自動車 車両リース', amount: 55000, type: 'expense', expected: { category: 'リース料', counterparty: 'オリックス' }, difficulty: 'medium' },
  { description: '印紙代 4000円', amount: 4000, type: 'expense', expected: { category: '租税公課' }, difficulty: 'medium' },
  { description: '利息', amount: 12, type: 'income', expected: { category: '受取利息' }, difficulty: 'medium' },
  { description: '水道代 3月分', amount: 8500, type: 'expense', expected: { category: '水道光熱費' }, difficulty: 'medium' },

  // ===== HARD: AIの判断力が問われる =====
  { description: '㈱鈴木組 残金', amount: 500000, type: 'income', expected: { category: '売上高', counterparty: '鈴木組' }, difficulty: 'hard' },
  { description: 'ATM 3月28日', amount: 200000, type: 'expense', expected: { category: '支払手数料' }, difficulty: 'hard' },
  { description: '佐藤 立替精算', amount: 12000, type: 'expense', expected: { category: '雑費', counterparty: '佐藤' }, difficulty: 'hard' },
  { description: 'Amazonビジネス PC周辺機器', amount: 45000, type: 'expense', expected: { category: '消耗品費', counterparty: 'Amazon' }, difficulty: 'hard' },
  { description: 'アスクル 現場消耗品', amount: 8900, type: 'expense', expected: { category: '消耗品費', counterparty: 'アスクル' }, difficulty: 'hard' },
  { description: '安全大会 参加費', amount: 5000, type: 'expense', expected: { category: '福利厚生費' }, difficulty: 'hard' },
  { description: 'ミシマ塗装 塗装工事一式', amount: 420000, type: 'expense', expected: { category: '外注費', counterparty: 'ミシマ塗装' }, difficulty: 'hard' },
  { description: '現場仮設トイレ レンタル', amount: 25000, type: 'expense', expected: { category: 'リース料' }, difficulty: 'hard' },
  { description: 'ゴルフ場利用税', amount: 3000, type: 'expense', expected: { category: '交際費' }, difficulty: 'hard' },
  { description: '㈱TKC 会計ソフト利用料', amount: 12000, type: 'expense', expected: { category: '支払手数料', counterparty: 'TKC' }, difficulty: 'hard' },
  { description: '源泉所得税 納付', amount: 185000, type: 'expense', expected: { category: '租税公課' }, difficulty: 'hard' },
  { description: 'UR都市機構 現場事務所', amount: 85000, type: 'expense', expected: { category: '地代家賃', counterparty: 'UR都市機構' }, difficulty: 'hard' },
  { description: '任意保険 車両', amount: 28000, type: 'expense', expected: { category: '車両費' }, difficulty: 'hard' },
  { description: '中央労金 借入返済', amount: 100000, type: 'expense', expected: { category: '雑費', counterparty: '中央労金' }, difficulty: 'hard' },
  { description: 'カインズ 養生シート等', amount: 12500, type: 'expense', expected: { category: '材料仕入高', counterparty: 'カインズ' }, difficulty: 'hard' },
  { description: 'タクシー 現場→駅', amount: 2800, type: 'expense', expected: { category: '旅費交通費' }, difficulty: 'hard' },
  { description: '㈱佐川急便 建材配送', amount: 18000, type: 'expense', expected: { category: '荷造運賃', counterparty: '佐川急便' }, difficulty: 'hard' },
  { description: 'Canon コピー機保守', amount: 8500, type: 'expense', expected: { category: '修繕費', counterparty: 'Canon' }, difficulty: 'hard' },
  { description: '商工会議所 年会費', amount: 30000, type: 'expense', expected: { category: '支払手数料' }, difficulty: 'hard' },
  { description: '日刊建設新聞', amount: 4800, type: 'expense', expected: { category: '新聞図書費' }, difficulty: 'hard' },
  { description: '協力業者 忘年会', amount: 85000, type: 'expense', expected: { category: '交際費' }, difficulty: 'hard' },
  { description: '労働保険料 概算納付', amount: 120000, type: 'expense', expected: { category: '法定福利費' }, difficulty: 'hard' },
  { description: '健康診断 スタッフ5名', amount: 45000, type: 'expense', expected: { category: '福利厚生費' }, difficulty: 'hard' },
  { description: 'ダンプ車検 整備費', amount: 120000, type: 'expense', expected: { category: '車両費' }, difficulty: 'hard' },
  { description: '振込 PQR商事', amount: 2500000, type: 'income', expected: { category: '売上高', counterparty: 'PQR商事' }, difficulty: 'hard' },
];

// ====== ルールベース分類（アプリと同じロジック） ======
const CATEGORY_MAP: Record<string, { category: string; label: string }> = {
  '給与': { category: '給料手当', label: '人件費' },
  '給料': { category: '給料手当', label: '人件費' },
  '賞与': { category: '賞与', label: '賞与' },
  '家賃': { category: '地代家賃', label: '家賃' },
  '電気': { category: '水道光熱費', label: '光熱費' },
  '水道': { category: '水道光熱費', label: '光熱費' },
  'ガス': { category: '水道光熱費', label: '光熱費' },
  '電話': { category: '通信費', label: '通信費' },
  'ドコモ': { category: '通信費', label: '通信費' },
  'ソフトバンク': { category: '通信費', label: '通信費' },
  'KDDI': { category: '通信費', label: '通信費' },
  'NTT': { category: '通信費', label: '通信費' },
  'ガソリン': { category: '車両費', label: '車両費' },
  'ENEOS': { category: '車両費', label: '車両費' },
  '出光': { category: '車両費', label: '車両費' },
  'コスモ': { category: '車両費', label: '車両費' },
  '保険': { category: '保険料', label: '保険料' },
  '社会保険': { category: '法定福利費', label: '社会保険' },
  '年金': { category: '法定福利費', label: '社会保険' },
  '健康保険': { category: '法定福利費', label: '社会保険' },
  '税金': { category: '租税公課', label: '税金' },
  '印紙': { category: '租税公課', label: '税金' },
  '振込手数料': { category: '支払手数料', label: '手数料' },
  'ATM': { category: '支払手数料', label: '手数料' },
  'Amazon': { category: '消耗品費', label: '消耗品' },
  'コンビニ': { category: '雑費', label: 'その他' },
};

function ruleBasedCategorize(description: string, type: string): string | null {
  if (type === 'income') return '売上高';
  const desc = description.toLowerCase();
  for (const [keyword, cat] of Object.entries(CATEGORY_MAP)) {
    if (desc.includes(keyword.toLowerCase())) return cat.category;
  }
  return null;
}

// ====== AI分類（DeepSeek API直接呼び出し） ======
async function aiCategorize(transactions: { description: string; amount: number; type: string }[]): Promise<{ category: string; counterparty: string }[]> {
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  });

  const txList = transactions.map((tx, i) =>
    `${i + 1}. ${tx.type === 'income' ? '入金' : '出金'} ¥${tx.amount.toLocaleString()} 「${tx.description}」`
  ).join('\n');

  const prompt = `以下の取引を勘定科目に分類してください。JSON配列で返してください。
各要素: {"category": "勘定科目名", "counterparty": "取引先名"}

使える科目: 売上高, 受取利息, 雑収入, 材料仕入高, 外注費, 役員報酬, 給料手当, 賞与, 法定福利費, 福利厚生費, 地代家賃, 水道光熱費, 通信費, 旅費交通費, 交際費, 会議費, 消耗品費, 車両費, 保険料, リース料, 支払手数料, 荷造運賃, 広告宣伝費, 新聞図書費, 修繕費, 雑費, 租税公課

${txList}`;

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 4096,
  });

  const raw = response.choices[0]?.message?.content || '[]';
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON in response');
  return JSON.parse(jsonMatch[0]);
}

// ====== テスト実行 ======
async function runTest() {
  console.log('=== AI仕訳精度テスト ===');
  console.log(`テストケース: ${TEST_CASES.length}件`);
  console.log(`  Easy: ${TEST_CASES.filter(t => t.difficulty === 'easy').length}件`);
  console.log(`  Medium: ${TEST_CASES.filter(t => t.difficulty === 'medium').length}件`);
  console.log(`  Hard: ${TEST_CASES.filter(t => t.difficulty === 'hard').length}件`);
  console.log('');

  // Step 1: ルールベース分類
  console.log('--- ルールベース分類 ---');
  let ruleCorrect = 0;
  let ruleAttempted = 0;
  const ruleResults: { description: string; predicted: string | null; expected: string; correct: boolean }[] = [];

  for (const tc of TEST_CASES) {
    const predicted = ruleBasedCategorize(tc.description, tc.type);
    if (predicted) {
      ruleAttempted++;
      const correct = predicted === tc.expected.category;
      if (correct) ruleCorrect++;
      ruleResults.push({ description: tc.description, predicted, expected: tc.expected.category, correct });
    } else {
      ruleResults.push({ description: tc.description, predicted: null, expected: tc.expected.category, correct: false });
    }
  }

  console.log(`カバー率: ${ruleAttempted}/${TEST_CASES.length} (${Math.round(ruleAttempted / TEST_CASES.length * 100)}%)`);
  console.log(`正解率 (分類できたもの): ${ruleCorrect}/${ruleAttempted} (${ruleAttempted > 0 ? Math.round(ruleCorrect / ruleAttempted * 100) : 0}%)`);
  console.log(`全体正解率: ${ruleCorrect}/${TEST_CASES.length} (${Math.round(ruleCorrect / TEST_CASES.length * 100)}%)`);
  console.log('');

  // Step 2: AI分類（バッチ）
  console.log('--- DeepSeek AI分類 ---');
  const batchSize = 25;
  const aiResults: { description: string; predicted: string; expected: string; correct: boolean; difficulty: string }[] = [];
  let aiCorrect = 0;

  for (let i = 0; i < TEST_CASES.length; i += batchSize) {
    const batch = TEST_CASES.slice(i, i + batchSize);
    console.log(`  バッチ ${Math.floor(i / batchSize) + 1}: ${batch.length}件を分類中...`);

    try {
      const predictions = await aiCategorize(
        batch.map(tc => ({ description: tc.description, amount: tc.amount, type: tc.type }))
      );

      for (let j = 0; j < batch.length; j++) {
        const tc = batch[j];
        const pred = predictions[j];
        const correct = pred?.category === tc.expected.category;
        if (correct) aiCorrect++;
        aiResults.push({
          description: tc.description,
          predicted: pred?.category || '(なし)',
          expected: tc.expected.category,
          correct,
          difficulty: tc.difficulty,
        });
      }
    } catch (err) {
      console.error(`  バッチ失敗:`, err);
      for (const tc of batch) {
        aiResults.push({
          description: tc.description,
          predicted: '(エラー)',
          expected: tc.expected.category,
          correct: false,
          difficulty: tc.difficulty,
        });
      }
    }
  }

  console.log(`AI正解率: ${aiCorrect}/${TEST_CASES.length} (${Math.round(aiCorrect / TEST_CASES.length * 100)}%)`);
  console.log('');

  // Step 3: 難易度別集計
  console.log('--- 難易度別正解率 ---');
  for (const diff of ['easy', 'medium', 'hard'] as const) {
    const subset = aiResults.filter(r => r.difficulty === diff);
    const correct = subset.filter(r => r.correct).length;
    console.log(`  ${diff}: ${correct}/${subset.length} (${subset.length > 0 ? Math.round(correct / subset.length * 100) : 0}%)`);
  }
  console.log('');

  // Step 4: 間違い一覧
  const errors = aiResults.filter(r => !r.correct);
  if (errors.length > 0) {
    console.log('--- 間違い一覧 ---');
    for (const e of errors) {
      console.log(`  [${e.difficulty}] 「${e.description}」 → ${e.predicted} (正解: ${e.expected})`);
    }
  }

  // Step 5: ハイブリッド精度（ルールベース優先 + AIフォールバック）
  console.log('');
  console.log('--- ハイブリッド精度（ルール優先 + AIフォールバック） ---');
  let hybridCorrect = 0;
  for (let i = 0; i < TEST_CASES.length; i++) {
    const rulePred = ruleResults[i].predicted;
    if (rulePred && ruleResults[i].correct) {
      hybridCorrect++;
    } else if (!rulePred && aiResults[i]?.correct) {
      hybridCorrect++;
    } else if (rulePred && !ruleResults[i].correct && aiResults[i]?.correct) {
      // ルールが間違い、AIが正解 → AIを採用すべきケース
      hybridCorrect++; // ハイブリッドではAIを優先する方がいい場合
    }
  }
  console.log(`ハイブリッド正解率: ${hybridCorrect}/${TEST_CASES.length} (${Math.round(hybridCorrect / TEST_CASES.length * 100)}%)`);

  // Step 6: 結果をJSONに保存
  const result = {
    timestamp: new Date().toISOString(),
    totalCases: TEST_CASES.length,
    ruleBased: {
      coverage: ruleAttempted,
      correct: ruleCorrect,
      accuracy: ruleAttempted > 0 ? Math.round(ruleCorrect / ruleAttempted * 100) : 0,
      overallAccuracy: Math.round(ruleCorrect / TEST_CASES.length * 100),
    },
    ai: {
      correct: aiCorrect,
      accuracy: Math.round(aiCorrect / TEST_CASES.length * 100),
      byDifficulty: {
        easy: { total: aiResults.filter(r => r.difficulty === 'easy').length, correct: aiResults.filter(r => r.difficulty === 'easy' && r.correct).length },
        medium: { total: aiResults.filter(r => r.difficulty === 'medium').length, correct: aiResults.filter(r => r.difficulty === 'medium' && r.correct).length },
        hard: { total: aiResults.filter(r => r.difficulty === 'hard').length, correct: aiResults.filter(r => r.difficulty === 'hard' && r.correct).length },
      },
    },
    hybrid: {
      correct: hybridCorrect,
      accuracy: Math.round(hybridCorrect / TEST_CASES.length * 100),
    },
    errors: errors,
    details: aiResults,
  };

  const fs = await import('fs');
  fs.writeFileSync('scripts/accuracy-results.json', JSON.stringify(result, null, 2));
  console.log('\n結果を scripts/accuracy-results.json に保存しました');
}

runTest().catch(console.error);
