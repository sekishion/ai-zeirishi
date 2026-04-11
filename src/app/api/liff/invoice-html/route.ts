import { NextRequest, NextResponse } from 'next/server';
import { generateInvoiceHTML, type Invoice } from '@/lib/financial-statements';
import { verifyLiffToken } from '@/lib/liff-token';
import { getLineUser, getCompanyInfo } from '@/lib/line-db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      token,
      invoiceNo,
      client,
      clientPostalCode,
      clientAddress,
      clientRegistrationNumber,
      items,
      subtotal,
      subtotal10,
      subtotal8,
      tax,
      tax10,
      tax8,
      total,
      issueDate,
      dueDate,
      bankInfo,
      memo,
    } = body;

    // 認証
    const payload = token ? verifyLiffToken(token) : null;
    if (!payload) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // 自社情報を取得
    const user = await getLineUser(payload.lineUserId);
    const company = user?.company_id ? await getCompanyInfo(user.company_id) : null;

    const invoice: Invoice = {
      id: invoiceNo || `INV-${Date.now()}`,
      client: client || '',
      clientPostalCode: clientPostalCode || '',
      clientAddress: clientAddress || '',
      clientRegistrationNumber: clientRegistrationNumber || '',
      items: (items || []).map((i: { name: string; quantity: number; unitPrice: number; taxRate?: 8 | 10; priceMode?: 'tax_excluded' | 'tax_included' }) => ({
        description: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        amount: i.quantity * i.unitPrice,
        taxRate: i.taxRate || 10,
        priceMode: i.priceMode || 'tax_excluded',
      })),
      subtotal: subtotal || 0,
      subtotal10: subtotal10 || 0,
      subtotal8: subtotal8 || 0,
      tax: tax || 0,
      tax10: tax10 || 0,
      tax8: tax8 || 0,
      total: total || 0,
      issueDate: issueDate || new Date().toISOString().split('T')[0],
      dueDate: dueDate || '',
      status: 'draft',
      companyName: company?.name || '',
      companyPostalCode: company?.postal_code || '',
      companyAddress: company?.address || '',
      companyPhone: company?.phone || '',
      companyRepresentative: company?.representative_name || company?.owner_name || '',
      registrationNumber: company?.invoice_registration_number || '',
      bankAccount: bankInfo || company?.bank_account || '',
      memo: memo || '',
    };

    const html = generateInvoiceHTML(invoice);

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('[Invoice HTML] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
