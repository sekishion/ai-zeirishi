import { NextResponse } from 'next/server';
import { exchangeCodeForToken, getFreeeCompanies } from '@/lib/freee';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/auth/freee/callback — freee OAuth コールバック
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL('/settings?freee_error=denied', request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/settings?freee_error=missing_params', request.url));
  }

  // stateからcompanyIdを復元
  let companyId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    companyId = decoded.companyId;
  } catch {
    return NextResponse.redirect(new URL('/settings?freee_error=invalid_state', request.url));
  }

  try {
    // アクセストークン取得
    const tokenData = await exchangeCodeForToken(code);

    // freee側の事業所情報を取得
    const companies = await getFreeeCompanies(tokenData.access_token);
    const freeeCompanyId = companies[0]?.id; // 最初の事業所を使用

    // トークンをDBに保存
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    await supabase
      .from('external_connections')
      .upsert({
        company_id: companyId,
        platform: 'freee',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt,
        external_company_id: freeeCompanyId ? String(freeeCompanyId) : null,
        sync_status: 'idle',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'company_id,platform',
      });

    return NextResponse.redirect(new URL('/settings?freee_connected=true', request.url));
  } catch (err) {
    console.error('freee OAuth error:', err);
    return NextResponse.redirect(new URL('/settings?freee_error=token_failed', request.url));
  }
}
