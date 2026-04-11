import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getLineUser, saveIncomeTransaction, upsertPartner } from '@/lib/line-db';
import { verifyLiffToken } from '@/lib/liff-token';

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    const {
      token,
      client,
      clientPostalCode,
      clientAddress,
      clientRegistrationNumber,
      issueDate,
      dueDate,
      items,
      subtotal,
      subtotal10,
      subtotal8,
      tax,
      tax10,
      tax8,
      total,
      bankInfo,
      memo,
    } = body;

    // HMAC署名トークン検証
    const payload = token ? verifyLiffToken(token) : null;
    if (!payload) {
      return NextResponse.json({ ok: false, error: 'トークンが無効または期限切れです。LINEから再度ボタンを押してください。' }, { status: 401 });
    }
    const lineUserId = payload.lineUserId;

    if (!client || !total) {
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

    const dueStr = dueDate || `${now.getFullYear()}/${now.getMonth() + 2}/末`;

    // 取引先マスタにupsert（次回から自動入力できるように）
    let partnerId: string | null = null;
    try {
      partnerId = await upsertPartner(user.company_id, client, {
        postal_code: clientPostalCode || '',
        address: clientAddress || '',
        invoice_registration_number: clientRegistrationNumber || '',
      });
    } catch (e) {
      console.error('[Invoice] partner upsert failed:', e);
    }

    // 売上として記録
    const description = items?.length > 0
      ? `${client} 請求書 (${items.map((i: { name: string }) => i.name).join(', ')})`
      : `${client} 請求書`;
    await saveIncomeTransaction(user.company_id, subtotal, client, description);

    // invoices テーブルに保存
    try {
      await supabase.from('invoices').insert({
        company_id: user.company_id,
        invoice_no: invoiceNo,
        partner_id: partnerId,
        partner_name: client,
        partner_address: clientAddress || '',
        partner_registration_number: clientRegistrationNumber || '',
        issue_date: issueDate || now.toISOString().split('T')[0],
        due_date: dueDate || now.toISOString().split('T')[0],
        items: items || [],
        subtotal_10: subtotal10 || 0,
        subtotal_8: subtotal8 || 0,
        tax_10: tax10 || 0,
        tax_8: tax8 || 0,
        subtotal: subtotal || 0,
        tax: tax || 0,
        total: total || 0,
        bank_account: bankInfo || '',
        memo: memo || '',
        status: 'sent',
      });
    } catch (e) {
      console.error('[Invoice] invoices insert failed:', e);
    }

    // 品目テキスト（軽減税率※マーク付き）
    const itemsText = (items || [])
      .map((i: { name: string; quantity: number; unitPrice: number; taxRate?: number }) => {
        const mark = i.taxRate === 8 ? ' ※' : '';
        return `${i.name}${mark} × ${i.quantity} = ¥${(i.unitPrice * i.quantity).toLocaleString()}`;
      })
      .join('\n');

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
