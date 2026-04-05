import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { deepseek, SYSTEM_PROMPT } from '@/lib/deepseek';

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET!;
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;

// LINE署名検証
function validateSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac('SHA256', CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// LINEにメッセージを返信
async function replyMessage(replyToken: string, messages: { type: string; text: string }[]) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
}

// LINE画像取得
async function getImageContent(messageId: string): Promise<Buffer> {
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
  });
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// AIチャット応答
async function getAIResponse(userMessage: string): Promise<string> {
  try {
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1024,
      stream: false,
    });
    return response.choices[0]?.message?.content || 'すみません、回答を生成できませんでした。';
  } catch {
    return '接続に問題が発生しました。しばらくお待ちください。';
  }
}

// レシートOCR処理
async function processReceipt(imageBuffer: Buffer): Promise<string> {
  try {
    const base64Image = imageBuffer.toString('base64');
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'レシート画像から以下を読み取ってください: 金額、店名、日付、品目。結果はJSON形式で返してください: {"amount": 数値, "store": "店名", "date": "YYYY-MM-DD", "items": "品目", "category": "推定勘定科目"}',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'このレシートを読み取ってください。' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ] as any,
        },
      ],
      max_tokens: 512,
      stream: false,
    });

    const result = response.choices[0]?.message?.content || '';

    // JSONを抽出してユーザーフレンドリーな形に整形
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return `🧾 経費を記録しました\n\n💴 ${data.amount ? `¥${Number(data.amount).toLocaleString()}` : '読取中'}\n🏪 ${data.store || '不明'}\n📂 ${data.category || '未分類'}\n📅 ${data.date || '不明'}\n\n✅ この内容でOKですか？\n修正があれば教えてください。`;
    }
    return `🧾 レシートを確認しました。\n\n${result}\n\n修正があれば教えてください。`;
  } catch {
    return '🧾 レシートの読み取りに失敗しました。もう一度撮影してお送りください。';
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-line-signature') || '';

  // 署名検証
  if (!validateSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  const payload = JSON.parse(body);
  const events = payload.events || [];

  for (const event of events) {
    if (event.type !== 'message') continue;
    const replyToken = event.replyToken;

    if (event.message.type === 'text') {
      // テキストメッセージ → AIチャット応答
      const userText = event.message.text;
      const aiReply = await getAIResponse(userText);
      await replyMessage(replyToken, [{ type: 'text', text: aiReply }]);

    } else if (event.message.type === 'image') {
      // 画像メッセージ → レシートOCR
      const imageBuffer = await getImageContent(event.message.id);
      const ocrResult = await processReceipt(imageBuffer);
      await replyMessage(replyToken, [{ type: 'text', text: ocrResult }]);

    } else {
      // その他のメッセージ
      await replyMessage(replyToken, [{
        type: 'text',
        text: '📊 AI経理部長です！\n\nテキストで質問するか、レシートの写真を送ってください。\n\n💬 質問例:\n・今月の経費はいくら？\n・交際費の上限は？\n・確定申告はいつ？',
      }]);
    }
  }

  return NextResponse.json({ ok: true });
}
