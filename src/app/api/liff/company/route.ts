/**
 * GET /api/liff/company?t=<token>
 *   LIFFフォームから自社情報（請求書発行元）を取得
 *
 * POST /api/liff/company
 *   自社情報を更新
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLineUser, getCompanyInfo, updateCompanyInfo } from '@/lib/line-db';
import { verifyLiffToken } from '@/lib/liff-token';

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('t');
  const payload = token ? verifyLiffToken(token) : null;
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const user = await getLineUser(payload.lineUserId);
  if (!user?.company_id) {
    return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 });
  }

  const company = await getCompanyInfo(user.company_id);
  if (!company) {
    return NextResponse.json({ ok: false, error: 'company not found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    company: {
      name: company.name || '',
      representative_name: company.representative_name || company.owner_name || '',
      postal_code: company.postal_code || '',
      address: company.address || '',
      phone: company.phone || '',
      invoice_registration_number: company.invoice_registration_number || '',
      bank_account: company.bank_account || '',
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { token, ...updates } = body;
  const payload = token ? verifyLiffToken(token) : null;
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const user = await getLineUser(payload.lineUserId);
  if (!user?.company_id) {
    return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 });
  }

  // 許可フィールドのみ
  const allowed = [
    'name',
    'representative_name',
    'postal_code',
    'address',
    'phone',
    'invoice_registration_number',
    'bank_account',
  ];
  const filtered: Record<string, string> = {};
  for (const k of allowed) {
    if (typeof updates[k] === 'string') filtered[k] = updates[k];
  }

  await updateCompanyInfo(user.company_id, filtered);
  return NextResponse.json({ ok: true });
}
