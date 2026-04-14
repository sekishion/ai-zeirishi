import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import {
  getFreeeDeals,
  convertFreeeDealToTransaction,
  refreshFreeeToken,
} from '@/lib/freee';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/freee/sync — freee取引データを同期
// 認証必須: Supabase Auth ログイン + 該当 company の owner 検証
export async function POST(request: NextRequest) {
  // 認証チェック
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => { /* read-only */ },
      },
    }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const body = await request.json();
  const { companyId, months = 3 } = body as { companyId: string; months?: number };

  if (!companyId) {
    return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
  }

  // owner 検証: この user が指定 companyId のオーナーか
  const { data: companyOwnerCheck } = await supabase
    .from('companies')
    .select('id, owner_id')
    .eq('id', companyId)
    .eq('owner_id', user.id)
    .single();
  if (!companyOwnerCheck) {
    return NextResponse.json({ error: 'この会社のデータにアクセスする権限がありません' }, { status: 403 });
  }

  // DB から freee接続情報を取得
  const { data: conn, error: connErr } = await supabase
    .from('external_connections')
    .select('*')
    .eq('company_id', companyId)
    .eq('platform', 'freee')
    .single();

  if (connErr || !conn) {
    return NextResponse.json({ error: 'freee connection not found' }, { status: 404 });
  }

  // トークンの有効期限チェック → リフレッシュ
  let accessToken = conn.access_token;
  const expiresAt = new Date(conn.token_expires_at);

  if (expiresAt <= new Date()) {
    try {
      const newToken = await refreshFreeeToken(conn.refresh_token);
      accessToken = newToken.access_token;
      const newExpiresAt = new Date(Date.now() + newToken.expires_in * 1000).toISOString();

      await supabase
        .from('external_connections')
        .update({
          access_token: newToken.access_token,
          refresh_token: newToken.refresh_token,
          token_expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conn.id);
    } catch {
      await supabase
        .from('external_connections')
        .update({ sync_status: 'error', sync_error: 'token_refresh_failed' })
        .eq('id', conn.id);
      return NextResponse.json({ error: 'token refresh failed' }, { status: 401 });
    }
  }

  // 同期開始マーク
  await supabase
    .from('external_connections')
    .update({ sync_status: 'syncing', sync_error: null })
    .eq('id', conn.id);

  try {
    const freeeCompanyId = parseInt(conn.external_company_id);
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    // ページング対応で全件取得
    let allDeals: Awaited<ReturnType<typeof getFreeeDeals>>['deals'] = [];
    let offset = 0;
    const limit = 100;
    let totalCount = 0;

    do {
      const result = await getFreeeDeals(accessToken, freeeCompanyId, startDate, endDate, offset, limit);
      allDeals = allDeals.concat(result.deals);
      totalCount = result.meta.total_count;
      offset += limit;
    } while (offset < totalCount);

    // 既存のfreee取引を取得（freee同士の重複チェック用）
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('external_id')
      .eq('company_id', companyId)
      .eq('synced_from', 'freee')
      .not('external_id', 'is', null);

    const existingIds = new Set((existingTx || []).map(t => t.external_id));

    // LINE経由の取引を取得（freee↔LINE クロスチェック用）
    const { data: lineTx } = await supabase
      .from('transactions')
      .select('id, date, amount, type, counterparty, external_id')
      .eq('company_id', companyId)
      .is('synced_from', null)  // LINE経由（synced_fromがnull）
      .is('deleted_at', null);

    const lineTransactions = lineTx || [];

    // 新規取引のみ挿入（freee同士 + freee↔LINE の両方でチェック）
    const newDeals = allDeals.filter(d => !existingIds.has(String(d.id)));
    let skippedAsLineDuplicate = 0;
    const transactions: Array<Record<string, unknown>> = [];

    for (const deal of newDeals) {
      const tx = convertFreeeDealToTransaction(deal);

      // freee↔LINE クロスチェック: 日付±1日 × 金額一致 × 同タイプ でマッチ
      const matchedLineTx = lineTransactions.find(lt => {
        if (lt.type !== tx.type) return false;
        if (Number(lt.amount) !== tx.amount) return false;
        // 日付±1日
        const ltDate = new Date(lt.date as string).getTime();
        const txDate = new Date(tx.date).getTime();
        return Math.abs(ltDate - txDate) <= 86400000; // 1日 = 86400000ms
      });

      if (matchedLineTx && !matchedLineTx.external_id) {
        // LINE取引にfreeeのexternal_idを紐付け（マージ）
        await supabase
          .from('transactions')
          .update({
            external_id: tx.externalId,
            synced_from: 'freee_matched',
          })
          .eq('id', matchedLineTx.id);

        // マッチ済みのLINE取引はリストから除外（同じものに2回マッチしない）
        const idx = lineTransactions.indexOf(matchedLineTx);
        if (idx >= 0) lineTransactions.splice(idx, 1);

        skippedAsLineDuplicate++;
        continue; // 新規insertしない
      }

      transactions.push({
        company_id: companyId,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        category_label: tx.categoryLabel,
        counterparty: tx.counterparty,
        source: 'freee連携',
        status: 'processed',
        confidence: 1.0,
        external_id: tx.externalId,
        synced_from: 'freee',
      });
    }

    if (transactions.length > 0) {
      const { error: insertErr } = await supabase
        .from('transactions')
        .insert(transactions);

      if (insertErr) {
        throw new Error(`insert failed: ${insertErr.message}`);
      }
    }

    // 同期完了マーク
    await supabase
      .from('external_connections')
      .update({
        sync_status: 'success',
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conn.id);

    return NextResponse.json({
      ok: true,
      synced: transactions.length,
      total: allDeals.length,
      skipped: allDeals.length - transactions.length - skippedAsLineDuplicate,
      matchedWithLine: skippedAsLineDuplicate,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    await supabase
      .from('external_connections')
      .update({ sync_status: 'error', sync_error: message })
      .eq('id', conn.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
