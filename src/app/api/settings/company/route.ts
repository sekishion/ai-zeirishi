/**
 * 会社情報（請求書発行元）の取得・更新
 *
 * GET  /api/settings/company → ログインユーザーの会社情報を返す
 * POST /api/settings/company → 会社情報を更新
 *
 * 認証: Supabase Auth ログイン必須
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAuthedUser(req: NextRequest) {
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => { /* read-only */ },
      },
    }
  );
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

async function getOwnedCompany(userId: string) {
  const { data } = await adminSupabase
    .from('companies')
    .select('*')
    .eq('owner_id', userId)
    .maybeSingle();
  return data;
}

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const company = await getOwnedCompany(user.id);
  if (!company) return NextResponse.json({ ok: true, company: null });

  return NextResponse.json({
    ok: true,
    company: {
      id: company.id,
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
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const body = await req.json();

  // インボイス登録番号フォーマット検証
  const reg = String(body.invoice_registration_number || '').trim();
  if (reg && !/^T\d{13}$/.test(reg)) {
    return NextResponse.json({ ok: false, error: 'インボイス登録番号は T+13桁の数字 で入力してください' }, { status: 400 });
  }

  const updates = {
    name: String(body.name || '').trim(),
    representative_name: String(body.representative_name || '').trim(),
    postal_code: String(body.postal_code || '').trim(),
    address: String(body.address || '').trim(),
    phone: String(body.phone || '').trim(),
    invoice_registration_number: reg,
    bank_account: String(body.bank_account || '').trim(),
    updated_at: new Date().toISOString(),
  };

  // 既存の会社レコードを取得 or 新規作成
  const existing = await getOwnedCompany(user.id);
  if (existing) {
    const { error } = await adminSupabase
      .from('companies')
      .update(updates)
      .eq('id', existing.id);
    if (error) {
      console.error('[settings/company] update failed:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await adminSupabase
      .from('companies')
      .insert({
        ...updates,
        owner_id: user.id,
      });
    if (error) {
      console.error('[settings/company] insert failed:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
