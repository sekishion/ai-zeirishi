import { NextRequest, NextResponse } from 'next/server';
import { generateInvoiceHTML, type Invoice } from '@/lib/financial-statements';
import { verifyLiffToken } from '@/lib/liff-token';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, invoiceNo, client, items, subtotal, tax, total, issueDate, dueDate, bankInfo, companyName } = body;

    // HTMLプレビューにも認証を入れる（請求書情報の漏洩防止）
    const payload = token ? verifyLiffToken(token) : null;
    if (!payload) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const invoice: Invoice = {
      id: invoiceNo || `INV-${Date.now()}`,
      client: client || '',
      items: (items || []).map((i: { name: string; quantity: number; unitPrice: number }) => ({
        description: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        amount: i.quantity * i.unitPrice,
      })),
      subtotal: subtotal || 0,
      tax: tax || 0,
      total: total || 0,
      issueDate: issueDate || new Date().toISOString().split('T')[0],
      dueDate: dueDate || '',
      status: 'draft',
      companyName: companyName || '',
    };

    let html = generateInvoiceHTML(invoice);

    // 振込先情報を追加
    if (bankInfo) {
      html = html.replace(
        '</body>',
        `<div style="margin-top:20px;padding:16px;background:#f8f9fb;border-radius:8px;font-size:12px;color:#555">
          <p style="margin:0 0 4px 0;font-weight:bold">振込先</p>
          <p style="margin:0;white-space:pre-wrap">${bankInfo}</p>
        </div></body>`
      );
    }

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('[Invoice HTML] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
