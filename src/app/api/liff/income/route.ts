import { NextRequest, NextResponse } from 'next/server';
import { getLineUser, saveIncomeTransaction, getMonthlyExpenseSummary } from '@/lib/line-db';

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
    const { lineUserId, client, amount, memo } = await req.json();

    if (!lineUserId || !client || !amount) {
      return NextResponse.json({ ok: false, error: '必須項目が不足' }, { status: 400 });
    }

    const user = await getLineUser(lineUserId);
    if (!user?.company_id) {
      return NextResponse.json({ ok: false, error: 'ユーザー不明' }, { status: 404 });
    }

    const description = memo ? `${client} ${memo}` : `${client}からの入金`;
    await saveIncomeTransaction(user.company_id, amount, client, description);

    const summary = await getMonthlyExpenseSummary(user.company_id);
    const monthlyIncome = summary.totalIncome + amount;

    await pushMessage(lineUserId, [{
      type: 'flex',
      altText: `入金 ¥${amount.toLocaleString()} を記録しました`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: '✅ 入金を記録しました', weight: 'bold', size: 'md', color: '#06C755' },
          ],
          paddingAll: '16px',
          backgroundColor: '#f0fdf4',
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            {
              type: 'box', layout: 'horizontal',
              contents: [
                { type: 'text', text: '入金額', size: 'sm', color: '#888888', flex: 1 },
                { type: 'text', text: `¥${amount.toLocaleString()}`, size: 'lg', weight: 'bold', align: 'end', flex: 2 },
              ],
            },
            {
              type: 'box', layout: 'horizontal',
              contents: [
                { type: 'text', text: '取引先', size: 'sm', color: '#888888', flex: 1 },
                { type: 'text', text: client, size: 'sm', align: 'end', flex: 2 },
              ],
            },
            ...(memo ? [{
              type: 'box' as const, layout: 'horizontal' as const,
              contents: [
                { type: 'text' as const, text: 'メモ', size: 'sm' as const, color: '#888888', flex: 1 },
                { type: 'text' as const, text: memo, size: 'sm' as const, align: 'end' as const, flex: 2, wrap: true },
              ],
            }] : []),
            { type: 'separator', margin: 'lg' },
            {
              type: 'box', layout: 'horizontal', margin: 'md',
              contents: [
                { type: 'text', text: '今月の売上合計', size: 'xs', color: '#888888', flex: 1 },
                { type: 'text', text: `¥${monthlyIncome.toLocaleString()}`, size: 'sm', weight: 'bold', color: '#06C755', align: 'end', flex: 1 },
              ],
            },
          ],
          paddingAll: '16px',
        },
      },
    }]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Income API] Error:', error);
    return NextResponse.json({ ok: false, error: 'サーバーエラー' }, { status: 500 });
  }
}
