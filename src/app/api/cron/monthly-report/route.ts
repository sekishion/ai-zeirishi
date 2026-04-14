import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;

function yen(n: number) { return `¥${n.toLocaleString()}`; }

async function pushMessage(userId: string, messages: Record<string, unknown>[]) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify({ to: userId, messages }),
  });
}

export async function GET(req: NextRequest) {
  // Vercel Cronの認証
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // JST基準で「先月」を計算（cronは毎月1日 00:00 UTC = JST 9時に実行 → 先月分を送る）
  const now = new Date();
  const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const lastMonth = new Date(jstNow.getFullYear(), jstNow.getMonth() - 1, 1);
  const month = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = `${lastMonth.getMonth() + 1}月`;

  // 全LINE ユーザーを取得
  const { data: users } = await supabase.from('line_users').select('line_user_id, company_id').not('company_id', 'is', null);
  if (!users || users.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;

  // 並列バッチ処理（5ユーザーずつ）でタイムアウトを防ぐ
  async function processUser(user: { line_user_id: string; company_id: string }): Promise<boolean> {
    // 先月の取引を集計（JST基準）
    const monthStart = `${month}-01`;
    const nextMonthDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 1);
    const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

    const { data: txs } = await supabase
      .from('transactions')
      .select('*')
      .eq('company_id', user.company_id)
      .gte('date', monthStart)
      .lt('date', nextMonth);

    // 0件の場合も「データなし」メッセージを送信
    if (!txs || txs.length === 0) {
      await pushMessage(user.line_user_id, [{
        type: 'text',
        text: `📊 ${monthLabel}の月次レポート\n\n今月はデータがありませんでした。\nレシートを送って記帳を始めましょう 📸`,
      }]);
      return true;
    }

    const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const profit = income - expense;

    // カテゴリ別集計
    const catMap = new Map<string, { label: string; amount: number }>();
    for (const t of txs.filter(t => t.type === 'expense')) {
      const k = t.category;
      const e = catMap.get(k);
      if (e) e.amount += Number(t.amount);
      else catMap.set(k, { label: t.category_label || k, amount: Number(t.amount) });
    }
    const cats = [...catMap.entries()].sort((a, b) => b[1].amount - a[1].amount).slice(0, 4);

    const breakdownContents = cats.map(([, c]) => ({
      type: 'box' as const, layout: 'horizontal' as const, margin: 'sm' as const,
      contents: [
        { type: 'text' as const, text: c.label, size: 'sm' as const, color: '#555555', flex: 2 },
        { type: 'text' as const, text: yen(c.amount), size: 'sm' as const, align: 'end' as const, flex: 2 },
      ],
    }));

    await pushMessage(user.line_user_id, [{
      type: 'flex',
      altText: `📊 ${monthLabel}の月次レポート: 売上${yen(income)} 経費${yen(expense)} 利益${yen(profit)}`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box', layout: 'vertical',
          contents: [
            { type: 'text', text: `📊 ${monthLabel}の月次レポート`, weight: 'bold', size: 'lg', color: '#06C755' },
          ],
          paddingAll: '16px', backgroundColor: '#f0fdf4',
        },
        body: {
          type: 'box', layout: 'vertical', spacing: 'md',
          contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '売上', size: 'sm', flex: 1 },
              { type: 'text', text: yen(income), size: 'md', weight: 'bold', align: 'end', flex: 2 },
            ]},
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '経費', size: 'sm', flex: 1 },
              { type: 'text', text: yen(expense), size: 'md', weight: 'bold', align: 'end', flex: 2 },
            ]},
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '利益', size: 'sm', flex: 1 },
              { type: 'text', text: yen(profit), size: 'lg', weight: 'bold', color: profit >= 0 ? '#06C755' : '#ff4444', align: 'end', flex: 2 },
            ]},
            { type: 'separator', margin: 'lg' },
            { type: 'text', text: '経費の内訳', size: 'sm', weight: 'bold', margin: 'md' },
            ...breakdownContents,
            { type: 'text', text: `全${txs.length}件の取引`, size: 'xs', color: '#aaaaaa', margin: 'lg', align: 'end' },
          ],
          paddingAll: '16px',
        },
      },
    }]);

    return true;
  }

  // バッチサイズ5で並列処理
  const BATCH_SIZE = 5;
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (user) => {
        try {
          return await processUser(user);
        } catch (e) {
          console.error(`[Monthly Report] Error for ${user.line_user_id}:`, e);
          return false;
        }
      })
    );
    sent += results.filter(Boolean).length;
  }

  return NextResponse.json({ ok: true, sent, total: users.length });
}
