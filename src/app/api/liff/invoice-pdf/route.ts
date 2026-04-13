/**
 * POST /api/liff/invoice-pdf
 *   請求書PDFを生成して返す
 *   Content-Type: application/pdf
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyLiffToken } from '@/lib/liff-token';
import { getLineUser, getCompanyInfo } from '@/lib/line-db';
import { generateInvoicePdf, type InvoicePdfData } from '@/lib/invoice-pdf';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    const payload = token ? verifyLiffToken(token) : null;
    if (!payload) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const user = await getLineUser(payload.lineUserId);
    const company = user?.company_id ? await getCompanyInfo(user.company_id) : null;

    const data: InvoicePdfData = {
      id: body.invoiceNo || `INV-${Date.now()}`,
      client: body.client || '',
      clientPostalCode: body.clientPostalCode || '',
      clientAddress: body.clientAddress || '',
      clientRegistrationNumber: body.clientRegistrationNumber || '',
      items: (body.items || []).map((i: { name: string; quantity: number; unitPrice: number; taxRate?: number }) => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        taxRate: (i.taxRate === 8 ? 8 : 10) as 8 | 10,
      })),
      subtotal: body.subtotal || 0,
      subtotal10: body.subtotal10 || 0,
      subtotal8: body.subtotal8 || 0,
      tax: body.tax || 0,
      tax10: body.tax10 || 0,
      tax8: body.tax8 || 0,
      total: body.total || 0,
      issueDate: body.issueDate || new Date().toISOString().split('T')[0],
      dueDate: body.dueDate || '',
      companyName: company?.name || '',
      companyPostalCode: company?.postal_code || '',
      companyAddress: company?.address || '',
      companyPhone: company?.phone || '',
      companyRepresentative: company?.representative_name || company?.owner_name || '',
      registrationNumber: company?.invoice_registration_number || '',
      bankAccount: body.bankInfo || company?.bank_account || '',
      memo: body.memo || '',
    };

    const pdfBuffer = await generateInvoicePdf(data);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${data.id}.pdf"`,
      },
    });
  } catch (error) {
    console.error('[Invoice PDF] Error:', error);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
