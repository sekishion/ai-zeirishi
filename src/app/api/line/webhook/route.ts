import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { deepseek, SYSTEM_PROMPT } from '@/lib/deepseek';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60;

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET!;
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  const resBody = await res.text();
  console.log(`[LINE Reply] Status: ${res.status}, Body: ${resBody}`);
  if (!res.ok) {
    console.error(`[LINE Reply] FAILED: ${res.status} ${resBody}`);
  }
}

// LINE画像取得
async function getImageContent(messageId: string): Promise<Buffer> {
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
  });
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// AIチャット応答（DeepSeek）
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
  } catch (e) {
    console.error('[DeepSeek] Error:', e);
    return '接続に問題が発生しました。しばらくお待ちください。';
  }
}

// レシートOCR処理（Gemini Flash）
async function processReceipt(imageBuffer: Buffer): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBuffer.toString('base64'),
        },
      },
      `このレシート・領収書の画像から以下の情報を読み取って、必ずJSON形式で返してください。

{
  "amount": 税込金額（数値のみ）,
  "store": "店名",
  "date": "YYYY-MM-DD",
  "items": "主な品目",
  "category": "推定勘定科目（会議費/交際費/消耗品費/旅費交通費/通信費/車両費/地代家賃/水道光熱費/福利厚生費/雑費のいずれか）"
}

読み取れない項目はnullにしてください。JSON以外のテキストは不要です。`,
    ]);

    const text = result.response.text();
    console.log(`[Gemini OCR] Response: ${text.substring(0, 200)}`);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return `🧾 レシートを読み取りました！\n\n💴 ${data.amount ? `¥${Number(data.amount).toLocaleString()}` : '読取不可'}\n🏪 ${data.store || '不明'}\n📂 ${data.category || '未分類'}\n📅 ${data.date || '不明'}\n🛒 ${data.items || '-'}\n\n✅ この内容でOKですか？\n修正があれば教えてください。`;
    }

    return `🧾 レシートを確認しました。\n\n${text}\n\n修正があれば教えてください。`;
  } catch (e) {
    console.error('[Gemini OCR] Error:', e);
    return '🧾 レシートの読み取りに失敗しました。明るい場所でもう一度撮影してお送りください。';
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-line-signature') || '';

    if (!validateSignature(body, signature)) {
      console.error('[LINE Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(body);
    const events = payload.events || [];

    console.log(`[LINE Webhook] Received ${events.length} events`);

    for (const event of events) {
      if (event.type !== 'message') continue;

      const replyToken = event.replyToken;
      console.log(`[LINE Webhook] Processing ${event.message.type} message`);

      try {
        if (event.message.type === 'text') {
          const userText = event.message.text;
          const aiReply = await getAIResponse(userText);
          await replyMessage(replyToken, [{ type: 'text', text: aiReply }]);

        } else if (event.message.type === 'image') {
          console.log('[LINE Webhook] Fetching image for Gemini OCR...');
          const imageBuffer = await getImageContent(event.message.id);
          console.log(`[LINE Webhook] Image size: ${imageBuffer.length} bytes`);
          const ocrResult = await processReceipt(imageBuffer);
          await replyMessage(replyToken, [{ type: 'text', text: ocrResult }]);

        } else {
          await replyMessage(replyToken, [{
            type: 'text',
            text: '📊 AI経理部長です！\n\nテキストで質問するか、レシートの写真を送ってください。\n\n💬 質問例:\n・今月の経費はいくら？\n・交際費の上限は？\n・確定申告はいつ？',
          }]);
        }
      } catch (eventError) {
        console.error(`[LINE Webhook] Error processing event:`, eventError);
        try {
          await replyMessage(replyToken, [{
            type: 'text',
            text: '申し訳ありません、処理中にエラーが発生しました。もう一度お試しください。',
          }]);
        } catch { /* reply失敗は無視 */ }
      }
    }

    return NextResponse.json({ ok: true, ts: Date.now() });
  } catch (error) {
    console.error('[LINE Webhook] Fatal error:', error);
    return NextResponse.json({ ok: true, ts: Date.now() });
  }
}
