import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { deepseek, SYSTEM_PROMPT } from '@/lib/deepseek';

// Vercelサーバーレス関数のタイムアウトを延長（最大60秒）
export const maxDuration = 60;

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
  try {
    const body = await req.text();
    const signature = req.headers.get('x-line-signature') || '';

    console.log(`[LINE Webhook] Body length: ${body.length}, Signature: ${signature ? 'present' : 'missing'}`);

    // 署名検証
    if (!validateSignature(body, signature)) {
      console.error('[LINE Webhook] Invalid signature');
      console.error('[LINE Webhook] Expected:', crypto.createHmac('SHA256', CHANNEL_SECRET).update(body).digest('base64'));
      console.error('[LINE Webhook] Got:', signature);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(body);
    const events = payload.events || [];

    console.log(`[LINE Webhook] Received ${events.length} events`);

    for (const event of events) {
      if (event.type !== 'message') {
        console.log(`[LINE Webhook] Skipping event type: ${event.type}`);
        continue;
      }

      const replyToken = event.replyToken;
      console.log(`[LINE Webhook] Processing ${event.message.type} message`);

      try {
        if (event.message.type === 'text') {
          const userText = event.message.text;
          console.log(`[LINE Webhook] User text: ${userText.substring(0, 50)}`);
          const aiReply = await getAIResponse(userText);
          console.log(`[LINE Webhook] AI reply length: ${aiReply.length}`);
          await replyMessage(replyToken, [{ type: 'text', text: aiReply }]);
          console.log('[LINE Webhook] Reply sent successfully');

        } else if (event.message.type === 'image') {
          console.log('[LINE Webhook] Image received');
          await replyMessage(replyToken, [{
            type: 'text',
            text: '🧾 レシートを受け取りました！\n\n読み取り機能は現在準備中です。\nお手数ですが、以下をテキストで教えてください：\n\n💴 金額（例: 1280円）\n🏪 店名（例: スターバックス）\n📂 何の費用か（例: 打ち合わせのコーヒー代）\n\n入力例:\n「スタバ 1280円 打ち合わせ」',
          }]);
          console.log('[LINE Webhook] Image receipt reply sent');

        } else {
          await replyMessage(replyToken, [{
            type: 'text',
            text: '📊 AI経理部長です！\n\nテキストで質問するか、レシートの写真を送ってください。\n\n💬 質問例:\n・今月の経費はいくら？\n・交際費の上限は？\n・確定申告はいつ？',
          }]);
        }
      } catch (eventError) {
        console.error(`[LINE Webhook] Error processing event:`, eventError);
        // 個別イベントのエラーでも他のイベントは処理続行
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
    return NextResponse.json({ ok: true, ts: Date.now() }); // LINEに200を返さないとリトライが来る
  }
}
