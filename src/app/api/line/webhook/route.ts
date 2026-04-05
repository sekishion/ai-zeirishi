/**
 * LINE Bot Webhook — AI経理部長
 *
 * 設計思想:
 *   ユーザーは「撮って送るだけ」。Botが全てやる。
 *   OCR → 仕訳分類 → DB保存 → 確認ボタン1つ。
 *   テキスト質問にはDBの実データを元に回答。
 *
 * フロー:
 *   1. follow → オンボーディング（業種選択）
 *   2. 画像 → OCR + 自動仕訳 + DB保存 + 確認
 *   3. テキスト → 文脈付きAI回答 or 科目修正
 *   4. postback → 確認OK / 科目変更
 */

import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { deepseek } from '@/lib/deepseek';
import { buildGroundedPrompt, INDUSTRY_RULES, TAX_RULES_2026 } from '@/lib/grounding';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  getLineUser, createLineUser, updateLineUserOnboarding,
  saveReceiptTransaction, getCategoryMonthlyTotal,
  getMonthlyExpenseSummary, getRecentTransactions,
  updateTransactionCategory, saveIncomeTransaction,
  learnPattern, predictFromLearned,
  type LineUser, type ReceiptData,
} from '@/lib/line-db';
import { generateTaxAdvice } from '@/lib/tax-advisor';

export const maxDuration = 60;

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET!;
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ====== LINE API ヘルパー ======

function validateSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac('SHA256', CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

async function replyMessage(replyToken: string, messages: Record<string, unknown>[]) {
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[LINE Reply] FAILED ${res.status}: ${body}`);
  }
}

async function getImageContent(messageId: string): Promise<Buffer> {
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
  });
  return Buffer.from(await res.arrayBuffer());
}

async function getLineProfile(userId: string): Promise<{ displayName: string }> {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
    });
    if (res.ok) {
      const data = await res.json();
      return { displayName: data.displayName || '' };
    }
  } catch { /* ignore */ }
  return { displayName: '' };
}

// ====== テキストメッセージ（クイックリプライ付き） ======

function textMessage(text: string, quickReply?: { label: string; text: string }[]) {
  const msg: Record<string, unknown> = { type: 'text', text };
  if (quickReply && quickReply.length > 0) {
    msg.quickReply = {
      items: quickReply.map(q => ({
        type: 'action',
        action: { type: 'message', label: q.label, text: q.text },
      })),
    };
  }
  return msg;
}

// ====== 金額フォーマット ======

function yen(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

// ====== フロー1: 友だち追加（オンボーディング） ======

async function handleFollow(replyToken: string, lineUserId: string) {
  const profile = await getLineProfile(lineUserId);
  const user = await createLineUser(lineUserId, profile.displayName);

  const name = profile.displayName || 'はじめまして';

  await updateLineUserOnboarding(lineUserId, { onboarding_step: 'industry_asked' });

  await replyMessage(replyToken, [
    textMessage(
      `${name}さん、こんにちは！\nAI経理部長です 📊\n\nレシートの写真を送るだけで、仕訳・記帳を自動でやります。\n\nまず、業種を教えてください👇`,
      [
        { label: '🏗️ 建設業', text: '建設業' },
        { label: '🍽️ 飲食業', text: '飲食業' },
        { label: '💻 IT業', text: 'IT業' },
        { label: '📦 その他', text: 'その他' },
      ],
    ),
  ]);
}

// ====== フロー2: 業種選択（オンボーディング完了） ======

async function handleIndustrySelection(replyToken: string, lineUserId: string, industry: string) {
  // 有効な業種かチェック
  const validIndustries = ['建設業', '飲食業', 'IT業', 'その他'];
  const selectedIndustry = validIndustries.includes(industry) ? industry : '建設業';

  await updateLineUserOnboarding(lineUserId, {
    industry: selectedIndustry,
    onboarding_step: 'completed',
  });

  await replyMessage(replyToken, [
    textMessage(
      `${selectedIndustry}ですね！\n${selectedIndustry}の仕訳ルールで記帳します。\n\n使い方はかんたん:\n📸 レシートを撮って送る → 自動で記帳\n💬 質問をテキストで送る → AIが回答\n\nさっそくレシートを送ってみてください！`,
    ),
  ]);
}

// ====== フロー3: レシートOCR + 自動仕訳 + DB保存 ======

async function handleReceiptImage(
  replyToken: string,
  user: LineUser,
  messageId: string,
) {
  // 1. 画像を取得
  const imageBuffer = await getImageContent(messageId);
  console.log(`[Receipt] Image size: ${imageBuffer.length} bytes`);

  // 2. Gemini でOCR
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const industry = user.industry || '建設業';
  const industryRules = INDUSTRY_RULES[industry] || INDUSTRY_RULES['建設業'];

  // グラウンディング付きOCRプロンプト: 業種ルールを含めて正確に分類
  const ocrPrompt = `このレシート・領収書を読み取り、以下の業種ルールに基づいて仕訳分類してください。

## 業種: ${industry}
${industryRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

## 出力（JSON のみ返すこと）
{
  "amount": 税込金額（数値のみ。読めなければnull）,
  "store": "店名",
  "date": "YYYY-MM-DD（読めなければnull）",
  "items": "主な品目（短く）",
  "category": "勘定科目（上記ルールに従う）",
  "categoryLabel": "社長向け表示名（例: 材料費、交通費、接待費）",
  "confidence": 0.0〜1.0（ルールに明確に合致すれば高く、曖昧なら低く）
}`;

  const result = await model.generateContent([
    { inlineData: { mimeType: 'image/jpeg', data: imageBuffer.toString('base64') } },
    ocrPrompt,
  ]);

  const ocrText = result.response.text();
  console.log(`[Receipt OCR] ${ocrText.substring(0, 300)}`);

  const jsonMatch = ocrText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    await replyMessage(replyToken, [
      textMessage('読み取れませんでした。明るい場所でもう一度撮影してください 📸'),
    ]);
    return;
  }

  let receipt: ReceiptData;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    receipt = {
      amount: parsed.amount ? Number(parsed.amount) : null,
      store: parsed.store || null,
      date: parsed.date || null,
      items: parsed.items || null,
      category: parsed.category || '雑費',
      categoryLabel: parsed.categoryLabel || parsed.category || '雑費',
      confidence: parsed.confidence ? Number(parsed.confidence) : 0.7,
    };
  } catch {
    await replyMessage(replyToken, [
      textMessage('レシートの解析に失敗しました。もう一度送ってください 📸'),
    ]);
    return;
  }

  // 2.5. 学習済みパターンがあれば上書き（AIより過去の修正を優先）
  if (user.company_id && receipt.store) {
    const learned = await predictFromLearned(user.company_id, receipt.store, 'expense');
    if (learned && learned.confidence > receipt.confidence) {
      receipt.category = learned.category;
      receipt.categoryLabel = learned.categoryLabel;
      receipt.confidence = learned.confidence;
    }
  }

  // 3. DBに保存
  if (!user.company_id) {
    await replyMessage(replyToken, [
      textMessage('エラーが発生しました。もう一度友だち追加をお試しください。'),
    ]);
    return;
  }

  const txId = await saveReceiptTransaction(user.company_id, receipt);

  // 4. 同カテゴリの今月合計を取得
  const monthlyTotal = await getCategoryMonthlyTotal(user.company_id, receipt.category);

  // 5. Flex Messageカードで返信
  const amountStr = receipt.amount ? yen(receipt.amount) : '金額不明';
  const storeStr = receipt.store || '不明';
  const categoryStr = receipt.categoryLabel || receipt.category;
  const newTotal = monthlyTotal.total + (receipt.amount || 0);
  const newCount = monthlyTotal.count + 1;

  await replyMessage(replyToken, [{
    type: 'flex',
    altText: `✅ ${amountStr} ${storeStr} → ${categoryStr}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical',
        contents: [{ type: 'text', text: '✅ 記録しました', weight: 'bold', size: 'md', color: '#06C755' }],
        paddingAll: '16px', backgroundColor: '#f0fdf4',
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'md',
        contents: [
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: '金額', size: 'sm', color: '#888888', flex: 1 },
            { type: 'text', text: amountStr, size: 'xl', weight: 'bold', align: 'end', flex: 2 },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: '店名', size: 'sm', color: '#888888', flex: 1 },
            { type: 'text', text: storeStr, size: 'sm', align: 'end', flex: 2 },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: '勘定科目', size: 'sm', color: '#888888', flex: 1 },
            { type: 'text', text: categoryStr, size: 'sm', weight: 'bold', color: '#06C755', align: 'end', flex: 2 },
          ]},
          ...(receipt.items ? [{ type: 'box' as const, layout: 'horizontal' as const, contents: [
            { type: 'text' as const, text: '品目', size: 'sm' as const, color: '#888888', flex: 1 },
            { type: 'text' as const, text: receipt.items, size: 'sm' as const, align: 'end' as const, flex: 2, wrap: true },
          ]}] : []),
          { type: 'separator', margin: 'lg' },
          { type: 'text', text: `今月の${categoryStr}: ${yen(newTotal)}（${newCount}件）`, size: 'xs', color: '#888888', margin: 'md' },
          ...(receipt.confidence < 0.8 ? [{ type: 'text' as const, text: '⚠️ 分類に自信がありません', size: 'xs' as const, color: '#ff6b6b', margin: 'sm' as const }] : []),
        ],
        paddingAll: '16px',
      },
      footer: {
        type: 'box', layout: 'horizontal', spacing: 'md',
        contents: [
          { type: 'button', action: { type: 'message', label: '✓ OK', text: 'OK' }, style: 'primary', color: '#06C755', height: 'sm', flex: 1 },
          { type: 'button', action: { type: 'message', label: '科目を変更', text: `変更:${txId}` }, style: 'secondary', height: 'sm', flex: 1 },
        ],
        paddingAll: '12px',
      },
    },
  }]);
}

// ====== フロー4: 科目変更リクエスト ======

async function handleCategoryChange(replyToken: string, user: LineUser, txId: string) {
  const industry = user.industry || '建設業';
  const commonCategories = getCommonCategories(industry);

  await replyMessage(replyToken, [
    textMessage(
      '正しい勘定科目を選んでください👇',
      commonCategories.map(c => ({
        label: c.label,
        text: `科目:${txId}:${c.category}:${c.label}`,
      })),
    ),
  ]);
}

function getCommonCategories(industry: string): { category: string; label: string }[] {
  // 業種ごとのよく使う勘定科目（最大13個 = LINE quick replyの上限）
  const base = [
    { category: '材料仕入高', label: '材料費' },
    { category: '外注費', label: '外注費' },
    { category: '交際費', label: '接待費' },
    { category: '会議費', label: '会議費' },
    { category: '旅費交通費', label: '交通費' },
    { category: '消耗品費', label: '消耗品' },
    { category: '車両費', label: '車両費' },
    { category: '通信費', label: '通信費' },
    { category: '支払手数料', label: '手数料' },
    { category: '福利厚生費', label: '福利厚生' },
    { category: '地代家賃', label: '家賃' },
    { category: '雑費', label: '雑費' },
  ];

  if (industry === '飲食業') {
    return [
      { category: '材料仕入高', label: '食材仕入' },
      ...base.filter(b => b.category !== '材料仕入高'),
    ].slice(0, 12);
  }

  if (industry === 'IT業') {
    return [
      { category: '通信費', label: 'クラウド/通信' },
      { category: '外注費', label: '外注費' },
      { category: '支払手数料', label: 'SaaS費' },
      ...base.filter(b => !['通信費', '外注費', '支払手数料'].includes(b.category)),
    ].slice(0, 12);
  }

  return base.slice(0, 12);
}

// ====== フロー5: テキスト質問（DB実データ付き） ======

async function handleTextMessage(
  replyToken: string,
  user: LineUser,
  text: string,
) {
  if (!user.company_id) {
    await replyMessage(replyToken, [
      textMessage('まだ設定が完了していません。業種を教えてください👇', [
        { label: '🏗️ 建設業', text: '建設業' },
        { label: '🍽️ 飲食業', text: '飲食業' },
        { label: '💻 IT業', text: 'IT業' },
        { label: '📦 その他', text: 'その他' },
      ]),
    ]);
    return;
  }

  // DBから今月のサマリーと直近取引を取得
  const [summary, recent] = await Promise.all([
    getMonthlyExpenseSummary(user.company_id),
    getRecentTransactions(user.company_id, 15),
  ]);

  // 業種に応じたグラウンディングルール
  const industry = user.industry || '建設業';
  const industryRules = INDUSTRY_RULES[industry] || INDUSTRY_RULES['建設業'];

  // 節税アドバイスを生成（取引データから自動判定）
  const taxAdvices = recent.length > 0
    ? generateTaxAdvice(
        recent.map(t => ({ ...t, time: '', source: '', status: 'processed' as const, counterparty: '', confidence: 1, type: t.type as 'income' | 'expense' })),
        { capitalAmount: 0, employeeCount: 1, isSmallBusiness: true }
      ).filter(a => a.applicable).slice(0, 3)
    : [];

  const taxAdviceText = taxAdvices.length > 0
    ? `\n## この会社に適用できる節税策\n${taxAdvices.map(a => `- ${a.title}: ${a.description}（年間約¥${a.savingsEstimate.toLocaleString()}の節税効果）`).join('\n')}`
    : '';

  const systemPrompt = `あなたは「AI経理部長」です。この会社の実データに基づいて回答してください。

## 役割
- 経理・会計・税務の質問に答える
- 仕訳の分類を手伝う
- 経営数字の状況を伝える
- 節税のアドバイスをする

## この会社の情報
- 業種: ${industry}
- 今月の売上: ${yen(summary.totalIncome)}
- 今月の経費: ${yen(summary.totalExpense)}
- 今月の利益: ${yen(summary.totalIncome - summary.totalExpense)}
- 今月の取引件数: ${summary.transactionCount}件

## 今月の経費内訳
${summary.byCategory.length > 0
    ? summary.byCategory.map(c => `- ${c.label}: ${yen(c.amount)}（${c.count}件）`).join('\n')
    : '（まだデータがありません）'}

## 直近の取引
${recent.length > 0
    ? recent.map(t => `${t.date} ${t.type === 'income' ? '入金' : '出金'} ${yen(t.amount)} ${t.description} → ${t.categoryLabel}`).join('\n')
    : '（まだデータがありません）'}
${taxAdviceText}

## 業種別ルール（${industry}）
${industryRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

${TAX_RULES_2026}

## 回答スタイル
- LINEメッセージなので短く（200文字以内を目安）
- 数字は具体的に
- 社長が理解できる平易な言葉
- 結論を先に
- 法的判断は「税理士に確認してください」と付ける
- 節税の質問には上記の節税策データを元に回答

JSON形式は不要。自然な日本語で回答してください。`;

  try {
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.5,
      max_tokens: 512,
      stream: false,
    });

    const reply = response.choices[0]?.message?.content || 'すみません、回答できませんでした。';
    await replyMessage(replyToken, [textMessage(reply)]);
  } catch (e) {
    console.error('[DeepSeek] Error:', e);
    await replyMessage(replyToken, [
      textMessage('接続に問題が発生しました。しばらくお待ちください。'),
    ]);
  }
}

// ====== メインハンドラー ======

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-line-signature') || '';

    if (!validateSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(body);
    const events = payload.events || [];

    for (const event of events) {
      const lineUserId = event.source?.userId;
      if (!lineUserId) continue;

      const replyToken = event.replyToken;

      try {
        // --- follow イベント ---
        if (event.type === 'follow') {
          await handleFollow(replyToken, lineUserId);
          continue;
        }

        if (event.type !== 'message') continue;

        // ユーザーを取得（未登録なら自動登録）
        let user = await getLineUser(lineUserId);
        if (!user) {
          const profile = await getLineProfile(lineUserId);
          user = await createLineUser(lineUserId, profile.displayName);
        }

        // --- 画像メッセージ（レシート） ---
        if (event.message.type === 'image') {
          // オンボーディング未完了でもレシートは受け付ける（デフォルト建設業で処理）
          if (user.onboarding_step !== 'completed') {
            await updateLineUserOnboarding(lineUserId, { onboarding_step: 'completed' });
          }
          await handleReceiptImage(replyToken, user, event.message.id);
          continue;
        }

        // --- テキストメッセージ ---
        if (event.message.type === 'text') {
          const text = event.message.text.trim();

          // オンボーディング: 業種選択
          if (user.onboarding_step === 'new' || user.onboarding_step === 'industry_asked') {
            const industries = ['建設業', '飲食業', 'IT業', 'その他'];
            if (industries.includes(text)) {
              await handleIndustrySelection(replyToken, lineUserId, text);
              continue;
            }
          }

          // リッチメニュー: レシート撮影
          if (text === 'レシートを送りたい') {
            await replyMessage(replyToken, [
              textMessage('📸 レシートや領収書の写真を送ってください！\n\nスマホのカメラで撮影して、そのまま送信するだけでOKです。'),
            ]);
            continue;
          }

          // リッチメニュー: 今月のまとめ → Flex Message
          if (text === '今月のまとめを見せて') {
            if (!user.company_id) {
              await replyMessage(replyToken, [textMessage('まだデータがありません。レシートを送ってみてください 📸')]);
              continue;
            }
            const summary = await getMonthlyExpenseSummary(user.company_id);
            const now = new Date();
            const monthLabel = `${now.getMonth() + 1}月`;
            const profit = summary.totalIncome - summary.totalExpense;

            if (summary.transactionCount === 0) {
              await replyMessage(replyToken, [textMessage(`📊 ${monthLabel}はまだデータがありません。\nレシートを送って記帳を始めましょう 📸`)]);
              continue;
            }

            const breakdownContents = summary.byCategory.slice(0, 5).map(c => ({
              type: 'box' as const, layout: 'horizontal' as const, margin: 'sm' as const,
              contents: [
                { type: 'text' as const, text: c.label, size: 'sm' as const, color: '#555555', flex: 2 },
                { type: 'text' as const, text: yen(c.amount), size: 'sm' as const, align: 'end' as const, flex: 2 },
                { type: 'text' as const, text: `${c.count}件`, size: 'xs' as const, color: '#aaaaaa', align: 'end' as const, flex: 1 },
              ],
            }));

            await replyMessage(replyToken, [{
              type: 'flex',
              altText: `${monthLabel}のまとめ: 売上${yen(summary.totalIncome)} 経費${yen(summary.totalExpense)}`,
              contents: {
                type: 'bubble',
                header: {
                  type: 'box', layout: 'vertical',
                  contents: [{ type: 'text', text: `📊 ${monthLabel}のまとめ`, weight: 'bold', size: 'lg' }],
                  paddingAll: '16px',
                },
                body: {
                  type: 'box', layout: 'vertical', spacing: 'md',
                  contents: [
                    { type: 'box', layout: 'horizontal', contents: [
                      { type: 'text', text: '💰 売上', size: 'sm', flex: 1 },
                      { type: 'text', text: yen(summary.totalIncome), size: 'md', weight: 'bold', align: 'end', flex: 2 },
                    ]},
                    { type: 'box', layout: 'horizontal', contents: [
                      { type: 'text', text: '💸 経費', size: 'sm', flex: 1 },
                      { type: 'text', text: yen(summary.totalExpense), size: 'md', weight: 'bold', align: 'end', flex: 2 },
                    ]},
                    { type: 'box', layout: 'horizontal', contents: [
                      { type: 'text', text: '📈 利益', size: 'sm', flex: 1 },
                      { type: 'text', text: yen(profit), size: 'lg', weight: 'bold', color: profit >= 0 ? '#06C755' : '#ff4444', align: 'end', flex: 2 },
                    ]},
                    { type: 'separator', margin: 'lg' },
                    { type: 'text', text: '経費の内訳', size: 'sm', weight: 'bold', color: '#333333', margin: 'md' },
                    ...breakdownContents,
                    { type: 'text', text: `全${summary.transactionCount}件`, size: 'xs', color: '#aaaaaa', margin: 'lg', align: 'end' },
                  ],
                  paddingAll: '16px',
                },
              },
            }]);
            continue;
          }

          // リッチメニュー: 経理に質問
          if (text === '経理について質問があります') {
            await replyMessage(replyToken, [
              textMessage('💬 何でも聞いてください！\n\n例えば:\n・「交際費の上限は？」\n・「車検代は何費？」\n・「今月の経費いくら？」\n\nテキストで質問を送ってください。'),
            ]);
            continue;
          }

          // リッチメニュー: 請求書作成 → フォームを開く
          if (text === '請求書を作りたい') {
            const formUrl = `https://ai-zeirishi.vercel.app/liff/invoice?uid=${lineUserId}`;
            await replyMessage(replyToken, [{
              type: 'flex',
              altText: '請求書を作成する',
              contents: {
                type: 'bubble',
                body: {
                  type: 'box',
                  layout: 'vertical',
                  spacing: 'md',
                  contents: [
                    { type: 'text', text: '📄 請求書作成', weight: 'bold', size: 'lg' },
                    { type: 'text', text: '取引先・品目・金額を入力して\n請求書を作成できます。', size: 'sm', color: '#888888', wrap: true },
                  ],
                  paddingAll: '20px',
                },
                footer: {
                  type: 'box',
                  layout: 'vertical',
                  contents: [{
                    type: 'button',
                    action: { type: 'uri', label: '請求書を作成する', uri: formUrl },
                    style: 'primary',
                    color: '#06C755',
                    height: 'md',
                  }],
                  paddingAll: '16px',
                },
              },
            }]);
            continue;
          }

          // リッチメニュー: 入金記録 → フォームを開く
          if (text === '入金を記録したい') {
            const formUrl = `https://ai-zeirishi.vercel.app/liff/income?uid=${lineUserId}`;
            await replyMessage(replyToken, [{
              type: 'flex',
              altText: '入金を記録する',
              contents: {
                type: 'bubble',
                body: {
                  type: 'box', layout: 'vertical', spacing: 'md',
                  contents: [
                    { type: 'text', text: '💰 入金記録', weight: 'bold', size: 'lg' },
                    { type: 'text', text: '取引先と金額を入力して\n売上を記録できます。', size: 'sm', color: '#888888', wrap: true },
                  ],
                  paddingAll: '20px',
                },
                footer: {
                  type: 'box', layout: 'vertical',
                  contents: [{
                    type: 'button',
                    action: { type: 'uri', label: '入金を記録する', uri: formUrl },
                    style: 'primary', color: '#06C755', height: 'md',
                  }],
                  paddingAll: '16px',
                },
              },
            }]);
            continue;
          }

          // リッチメニュー: 仕訳履歴 → Flex Message
          if (text === '仕訳履歴を見せて') {
            if (!user.company_id) {
              await replyMessage(replyToken, [textMessage('まだデータがありません。レシートを送ってみてください 📸')]);
              continue;
            }
            const recent = await getRecentTransactions(user.company_id, 8);
            if (recent.length === 0) {
              await replyMessage(replyToken, [textMessage('📋 まだ取引がありません。\nレシートを送って記帳を始めましょう 📸')]);
              continue;
            }

            // 一覧表示 + 各取引に修正ボタン
            const txContents = recent.map(t => ({
              type: 'box' as const, layout: 'vertical' as const, margin: 'md' as const, spacing: 'xs' as const,
              contents: [
                { type: 'box' as const, layout: 'horizontal' as const, contents: [
                  { type: 'text' as const, text: t.date.slice(5), size: 'xs' as const, color: '#aaaaaa', flex: 1 },
                  { type: 'text' as const, text: `${t.type === 'income' ? '+' : '-'}${yen(t.amount)}`, size: 'sm' as const, weight: 'bold' as const, align: 'end' as const, flex: 2, color: t.type === 'income' ? '#06C755' : '#333333' },
                ]},
                { type: 'box' as const, layout: 'horizontal' as const, contents: [
                  { type: 'text' as const, text: `${t.description.slice(0, 14)} → ${t.categoryLabel}`, size: 'xs' as const, color: '#666666', flex: 3, wrap: false },
                  ...(t.type === 'expense' ? [{ type: 'text' as const, text: '修正', size: 'xxs' as const, color: '#06C755', align: 'end' as const, flex: 1, action: { type: 'message' as const, label: '修正', text: `変更:${t.id}` } }] : []),
                ]},
              ],
            }));

            await replyMessage(replyToken, [{
              type: 'flex',
              altText: '仕訳履歴',
              contents: {
                type: 'bubble',
                header: {
                  type: 'box', layout: 'vertical',
                  contents: [{ type: 'text', text: '📋 仕訳履歴', weight: 'bold', size: 'lg' }],
                  paddingAll: '16px',
                },
                body: {
                  type: 'box', layout: 'vertical',
                  contents: txContents,
                  paddingAll: '16px',
                },
              },
            }]);
            continue;
          }

          // 確認OK → 直近の取引を学習
          if (text === 'OK') {
            if (user.company_id) {
              const lastTx = await getRecentTransactions(user.company_id, 1);
              if (lastTx.length > 0 && lastTx[0].type === 'expense') {
                const t = lastTx[0];
                await learnPattern(user.company_id, t.description, t.description, t.category, t.categoryLabel, 'expense');
              }
            }
            await replyMessage(replyToken, [
              textMessage('👍 次のレシートがあれば送ってください！'),
            ]);
            continue;
          }

          // 科目変更リクエスト（「変更:txId」形式）
          if (text.startsWith('変更:')) {
            const txId = text.replace('変更:', '');
            await handleCategoryChange(replyToken, user, txId);
            continue;
          }

          // 科目選択（「科目:txId:category:label」形式）→ 学習も実行
          if (text.startsWith('科目:')) {
            const parts = text.split(':');
            if (parts.length >= 4 && user.company_id) {
              const txId = parts[1];
              const category = parts[2];
              const label = parts[3];
              await updateTransactionCategory(txId, category, label);
              // 取引先を取得して学習
              const recentTx = await getRecentTransactions(user.company_id, 20);
              const tx = recentTx.find(t => t.id === txId);
              if (tx) {
                await learnPattern(user.company_id, tx.description, tx.description, category, label, 'expense');
              }
              await replyMessage(replyToken, [
                textMessage(`✅ 「${label}」に変更しました！\n次回から同じ取引先は自動で「${label}」にします 📝`),
              ]);
              continue;
            }
          }

          // 通常のテキスト質問
          await handleTextMessage(replyToken, user, text);
          continue;
        }

        // --- その他のメッセージタイプ ---
        await replyMessage(replyToken, [
          textMessage(
            '📸 レシートの写真を送るか、\n💬 テキストで質問してください！',
          ),
        ]);

      } catch (eventError) {
        console.error('[Webhook] Event processing error:', eventError);
        try {
          await replyMessage(replyToken, [
            textMessage('エラーが発生しました。もう一度お試しください。'),
          ]);
        } catch { /* ignore reply failure */ }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Webhook] Fatal error:', error);
    return NextResponse.json({ ok: true });
  }
}
