import { NextRequest, NextResponse } from 'next/server';
import { getLineUser, saveIncomeTransaction } from '@/lib/line-db';

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;

async function pushMessage(userId: string, messages: Record<string, unknown>[]) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to: userId, messages }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lineUserId, client, items, subtotal, tax, total, dueMonths, memo } = body;

    if (!lineUserId || !client || !total) {
      return NextResponse.json({ ok: false, error: '必須項目が不足しています' }, { status: 400 });
    }

    // ユーザー確認
    const user = await getLineUser(lineUserId);
    if (!user?.company_id) {
      return NextResponse.json({ ok: false, error: 'ユーザーが見つかりません' }, { status: 404 });
    }

    // 請求書番号
    const now = new Date();
    const invoiceNo = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

    // 支払期限
    const due = new Date(now);
    due.setMonth(due.getMonth() + (dueMonths || 1));
    due.setDate(0); // 月末
    const dueStr = `${due.getFullYear()}/${due.getMonth() + 1}/${due.getDate()}`;

    // 品目テキスト
    const itemsText = (items || [])
      .map((i: { name: string; quantity: number; unitPrice: number }) =>
        `${i.name} × ${i.quantity} = ¥${(i.unitPrice * i.quantity).toLocaleString()}`
      )
      .join('\n');

    // 売上として記録
    const description = items?.length > 0
      ? `${client} 請求書 (${items.map((i: { name: string }) => i.name).join(', ')})`
      : `${client} 請求書`;
    await saveIncomeTransaction(user.company_id, subtotal, client, description);

    // LINEにPushメッセージ
    await pushMessage(lineUserId, [{
      type: 'flex',
      altText: `請求書を作成しました: ${client} 宛 ¥${total.toLocaleString()}`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: '📄 請求書を作成しました', weight: 'bold', size: 'md', color: '#06C755' },
          ],
          paddingAll: '16px',
          backgroundColor: '#f0fdf4',
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            { type: 'text', text: `請求書番号: ${invoiceNo}`, size: 'xs', color: '#999999' },
            { type: 'text', text: `宛先: ${client}`, size: 'sm', weight: 'bold' },
            { type: 'separator', margin: 'md' },
            ...(items?.length > 0 ? [{
              type: 'text' as const,
              text: itemsText,
              size: 'sm' as const,
              wrap: true,
              color: '#555555',
            }] : []),
            { type: 'separator', margin: 'md' },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '小計', size: 'sm', color: '#555555', flex: 1 },
                { type: 'text', text: `¥${subtotal.toLocaleString()}`, size: 'sm', align: 'end', flex: 1 },
              ],
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '消費税 (10%)', size: 'sm', color: '#555555', flex: 1 },
                { type: 'text', text: `¥${tax.toLocaleString()}`, size: 'sm', align: 'end', flex: 1 },
              ],
            },
            { type: 'separator', margin: 'md' },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '合計', size: 'lg', weight: 'bold', flex: 1 },
                { type: 'text', text: `¥${total.toLocaleString()}`, size: 'lg', weight: 'bold', align: 'end', flex: 1 },
              ],
            },
            { type: 'text', text: `支払期限: ${dueStr}`, size: 'xs', color: '#999999', margin: 'md' },
            ...(memo ? [{ type: 'text' as const, text: `備考: ${memo}`, size: 'xs' as const, color: '#999999' as const, wrap: true }] : []),
            { type: 'text', text: '✅ 売上として自動記帳しました', size: 'xs', color: '#06C755', margin: 'lg' },
          ],
          paddingAll: '16px',
        },
      },
    }]);

    return NextResponse.json({ ok: true, invoiceNo, total });
  } catch (error) {
    console.error('[Invoice API] Error:', error);
    return NextResponse.json({ ok: false, error: 'サーバーエラー' }, { status: 500 });
  }
}
