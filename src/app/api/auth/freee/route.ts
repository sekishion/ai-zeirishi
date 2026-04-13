import { NextResponse } from 'next/server';
import { buildFreeeAuthUrl } from '@/lib/freee';

// GET /api/auth/freee — freee OAuth認可開始
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('company_id');

  if (!companyId) {
    return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
  }

  // stateにcompanyIdとnonceを埋め込み（CSRF対策 + 認可後の紐づけ用）
  const nonce = crypto.randomUUID();
  const state = Buffer.from(JSON.stringify({
    companyId,
    nonce,
  })).toString('base64url');

  const authUrl = buildFreeeAuthUrl(state);
  const response = NextResponse.redirect(authUrl);

  // nonceをhttpOnly cookieに保存（CSRF保護用、5分で失効）
  response.cookies.set('freee_oauth_nonce', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300, // 5分
    path: '/',
  });

  return response;
}
