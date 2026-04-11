import { NextResponse } from 'next/server';
import { buildFreeeAuthUrl } from '@/lib/freee';
import { createClient } from '@supabase/supabase-js';

// GET /api/auth/freee — freee OAuth認可開始
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('company_id');

  if (!companyId) {
    return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
  }

  // stateにcompanyIdを埋め込み（CSRF対策 + 認可後の紐づけ用）
  const state = Buffer.from(JSON.stringify({
    companyId,
    nonce: crypto.randomUUID(),
  })).toString('base64url');

  const authUrl = buildFreeeAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
