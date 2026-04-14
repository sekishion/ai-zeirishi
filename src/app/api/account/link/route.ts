/**
 * POST /api/account/link
 * LINE ↔ Web アカウント連携
 *
 * Web側（Supabase Auth ログイン済み）からLINE連携コードを送信し、
 * LINE側のcompanyをWeb側のユーザーに紐づける。
 *
 * フロー:
 * 1. LINEで「アカウント連携」と送る → Bot が6桁コードを発行（5分有効）
 * 2. Webの設定画面でコードを入力 → このAPIを呼ぶ
 * 3. line_users.link_code が一致 → companies.owner_id を設定
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  // 1. Supabase Auth 認証
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {},
      },
    }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });
  }

  // 2. コード取得
  const { code } = await req.json();
  if (!code || typeof code !== 'string' || code.length !== 6) {
    return NextResponse.json({ ok: false, error: '6桁の連携コードを入力してください' }, { status: 400 });
  }

  // 3. line_users から一致するコードを検索（有効期限内）
  const { data: lineUser, error: findErr } = await adminSupabase
    .from('line_users')
    .select('id, company_id, display_name, link_code_expires_at')
    .eq('link_code', code.toUpperCase())
    .single();

  if (findErr || !lineUser) {
    return NextResponse.json({ ok: false, error: '連携コードが見つかりません。LINEで「アカウント連携」と送って新しいコードを取得してください。' }, { status: 404 });
  }

  // 4. 有効期限チェック
  if (lineUser.link_code_expires_at && new Date(lineUser.link_code_expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: 'コードの有効期限が切れました。LINEで「アカウント連携」と送って新しいコードを取得してください。' }, { status: 410 });
  }

  // 5. リンク済みチェック（既に他のWebユーザーに紐付いている場合は拒否）
  if (lineUser.company_id) {
    const { data: existingCompany } = await adminSupabase
      .from('companies')
      .select('owner_id')
      .eq('id', lineUser.company_id)
      .single();
    if (existingCompany?.owner_id && existingCompany.owner_id !== user.id) {
      return NextResponse.json({ ok: false, error: 'このLINEアカウントは既に別のWebアカウントに連携されています。' }, { status: 409 });
    }
    if (existingCompany?.owner_id === user.id) {
      return NextResponse.json({ ok: true, message: '既に連携済みです。' });
    }
  }

  // 6. company の owner_id を設定
  if (lineUser.company_id) {
    // 既存のWeb側companyがあれば削除（取引0件の場合のみ）
    const { data: existingWebCompany } = await adminSupabase
      .from('companies')
      .select('id')
      .eq('owner_id', user.id)
      .neq('id', lineUser.company_id)
      .single();

    if (existingWebCompany) {
      // 取引がある場合はマージが必要（複雑なのでエラーにする）
      const { count } = await adminSupabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', existingWebCompany.id);

      if (count && count > 0) {
        return NextResponse.json({ ok: false, error: 'Web側に既存の取引データがあります。サポートにお問い合わせください��' }, { status: 409 });
      }

      // 取引0件なら削除
      await adminSupabase.from('companies').delete().eq('id', existingWebCompany.id);
    }

    // LINE側のcompanyにowner_idを設定
    await adminSupabase
      .from('companies')
      .update({ owner_id: user.id })
      .eq('id', lineUser.company_id);
  }

  // 6. コードを無効化
  await adminSupabase
    .from('line_users')
    .update({ link_code: null, link_code_expires_at: null })
    .eq('id', lineUser.id);

  return NextResponse.json({
    ok: true,
    message: `LINE アカウント「${lineUser.display_name || 'LINE'}」と連携しました。LINEで登録した取引がWebアプリで見れるようになります。`,
  });
}
