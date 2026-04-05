/**
 * DeepSeek + グラウンディング精度テスト
 * 比較用: グラウンディングだけでどこまで精度が上がるか測定
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import OpenAI from 'openai';
import { buildGroundedPrompt } from '../src/lib/grounding';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
});

const TESTS = [
  {d:'給与 山田太郎',a:280000,t:'expense',e:'給料手当',df:'easy'},
  {d:'家賃 4月分',a:120000,t:'expense',e:'地代家賃',df:'easy'},
  {d:'東京電力EP 電気料金',a:18500,t:'expense',e:'水道光熱費',df:'easy'},
  {d:'NTTドコモ 携帯料金',a:8800,t:'expense',e:'通信費',df:'easy'},
  {d:'ENEOS SSガソリン',a:5600,t:'expense',e:'車両費',df:'easy'},
  {d:'振込手数料',a:440,t:'expense',e:'支払手数料',df:'easy'},
  {d:'ABC建設 工事代金',a:3500000,t:'income',e:'売上高',df:'easy'},
  {d:'山田工務店 請求書入金',a:1200000,t:'income',e:'売上高',df:'easy'},
  {d:'Amazon.co.jp 事務用品',a:3280,t:'expense',e:'消耗品費',df:'easy'},
  {d:'社会保険料 3月分',a:85000,t:'expense',e:'法定福利費',df:'easy'},
  {d:'セメント 50袋 ホームセンター',a:45000,t:'expense',e:'材料仕入高',df:'medium'},
  {d:'山田建材 鉄筋代',a:380000,t:'expense',e:'材料仕入高',df:'medium'},
  {d:'田中電工 電気工事',a:250000,t:'expense',e:'外注費',df:'medium'},
  {d:'スターバックス',a:1280,t:'expense',e:'会議費',df:'medium'},
  {d:'居酒屋 はなの舞 5名',a:24500,t:'expense',e:'交際費',df:'medium'},
  {d:'JR東日本 Suica チャージ',a:5000,t:'expense',e:'旅費交通費',df:'medium'},
  {d:'ヤマト運輸 送料',a:1200,t:'expense',e:'荷造運賃',df:'medium'},
  {d:'月極駐車場 4月分',a:15000,t:'expense',e:'地代家賃',df:'medium'},
  {d:'コマツ リース料',a:180000,t:'expense',e:'リース料',df:'medium'},
  {d:'固定資産税 第1期',a:80000,t:'expense',e:'租税公課',df:'medium'},
  {d:'Google広告 クリック費用',a:35000,t:'expense',e:'広告宣伝費',df:'medium'},
  {d:'オリックス自動車 車両リース',a:55000,t:'expense',e:'リース料',df:'medium'},
  {d:'印紙代 4000円',a:4000,t:'expense',e:'租税公課',df:'medium'},
  {d:'利息',a:12,t:'income',e:'受取利息',df:'medium'},
  {d:'水道代 3月分',a:8500,t:'expense',e:'水道光熱費',df:'medium'},
  {d:'㈱鈴木組 残金',a:500000,t:'income',e:'売上高',df:'hard'},
  {d:'ATM 3月28日',a:200000,t:'expense',e:'支払手数料',df:'hard'},
  {d:'佐藤 立替精算',a:12000,t:'expense',e:'雑費',df:'hard'},
  {d:'Amazonビジネス PC周辺機器',a:45000,t:'expense',e:'消耗品費',df:'hard'},
  {d:'アスクル 現場消耗品',a:8900,t:'expense',e:'消耗品費',df:'hard'},
  {d:'安全大会 参加費',a:5000,t:'expense',e:'福利厚生費',df:'hard'},
  {d:'ミシマ塗装 塗装工事一式',a:420000,t:'expense',e:'外注費',df:'hard'},
  {d:'現場仮設トイレ レンタル',a:25000,t:'expense',e:'リース料',df:'hard'},
  {d:'ゴルフ場利用税',a:3000,t:'expense',e:'交際費',df:'hard'},
  {d:'㈱TKC 会計ソフト利用料',a:12000,t:'expense',e:'支払手数料',df:'hard'},
  {d:'源泉所得税 納付',a:185000,t:'expense',e:'租税公課',df:'hard'},
  {d:'UR都市機構 現場事務所',a:85000,t:'expense',e:'地代家賃',df:'hard'},
  {d:'任意保険 車両',a:28000,t:'expense',e:'車両費',df:'hard'},
  {d:'中央労金 借入返済',a:100000,t:'expense',e:'雑費',df:'hard'},
  {d:'カインズ 養生シート等',a:12500,t:'expense',e:'材料仕入高',df:'hard'},
  {d:'タクシー 現場→駅',a:2800,t:'expense',e:'旅費交通費',df:'hard'},
  {d:'㈱佐川急便 建材配送',a:18000,t:'expense',e:'荷造運賃',df:'hard'},
  {d:'Canon コピー機保守',a:8500,t:'expense',e:'修繕費',df:'hard'},
  {d:'商工会議所 年会費',a:30000,t:'expense',e:'支払手数料',df:'hard'},
  {d:'日刊建設新聞',a:4800,t:'expense',e:'新聞図書費',df:'hard'},
  {d:'協力業者 忘年会',a:85000,t:'expense',e:'交際費',df:'hard'},
  {d:'労働保険料 概算納付',a:120000,t:'expense',e:'法定福利費',df:'hard'},
  {d:'健康診断 スタッフ5名',a:45000,t:'expense',e:'福利厚生費',df:'hard'},
  {d:'ダンプ車検 整備費',a:120000,t:'expense',e:'車両費',df:'hard'},
  {d:'振込 PQR商事',a:2500000,t:'income',e:'売上高',df:'hard'},
];

async function run() {
  const systemPrompt = buildGroundedPrompt('建設業');
  console.log('=== DeepSeek + グラウンディング版 ===');
  console.log(`テストケース: ${TESTS.length}件\n`);

  let correct = 0;
  const results: { d: string; pred: string; exp: string; ok: boolean; df: string }[] = [];
  const batchSize = 25;

  for (let i = 0; i < TESTS.length; i += batchSize) {
    const batch = TESTS.slice(i, i + batchSize);
    console.log(`  バッチ ${Math.floor(i / batchSize) + 1}: ${batch.length}件...`);

    const txList = batch.map((tc, j) =>
      `${i + j + 1}. ${tc.t === 'income' ? '入金' : '出金'} ¥${tc.a.toLocaleString()} 「${tc.d}」`
    ).join('\n');

    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `以下の${batch.length}件を分類。JSON配列のみ。各要素: {"category": "勘定科目名", "counterparty": "取引先名"}\n\n${txList}` },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    });

    const raw = response.choices[0]?.message?.content || '[]';
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    const preds = JSON.parse(jsonMatch ? jsonMatch[0] : '[]');

    for (let j = 0; j < batch.length; j++) {
      const tc = batch[j];
      const pred = preds[j];
      const ok = pred?.category === tc.e;
      if (ok) correct++;
      results.push({ d: tc.d, pred: pred?.category || '(なし)', exp: tc.e, ok, df: tc.df });
    }
  }

  console.log(`\n正解率: ${correct}/${TESTS.length} (${Math.round(correct / TESTS.length * 100)}%)`);

  console.log('\n--- 難易度別 ---');
  for (const diff of ['easy', 'medium', 'hard']) {
    const s = results.filter(r => r.df === diff);
    const c = s.filter(r => r.ok).length;
    console.log(`  ${diff}: ${c}/${s.length} (${Math.round(c / s.length * 100)}%)`);
  }

  const errors = results.filter(r => !r.ok);
  if (errors.length > 0) {
    console.log('\n--- 間違い ---');
    for (const e of errors) {
      console.log(`  [${e.df}] 「${e.d}」 → ${e.pred} (正解: ${e.exp})`);
    }
  }
}

run().catch(console.error);
