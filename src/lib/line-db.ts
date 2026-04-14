/**
 * LINE Bot 専用の Supabase DB操作
 *
 * LINE webhookはサーバーサイドで実行されるため、
 * service_role keyを使ってRLSをバイパスする。
 * これにより、認証なしでもLINE userIdベースでデータを読み書きできる。
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,  // service_role でRLSバイパス
);

// ====== JST タイムゾーンヘルパー（UTC由来の月境界バグを防ぐ） ======

/**
 * JST（Asia/Tokyo）での「今日」を YYYY-MM-DD で返す。
 * 旧コードは new Date().toISOString().split('T')[0] を使っていたが、これはUTC基準。
 * JST 23時のレシートが UTC 翌日扱いになり、月またぎ取引が消える事故が起きていた。
 */
export function jstToday(): string {
  const now = new Date();
  // ja-JP ロケールで「YYYY/MM/DD」を取得して整形
  const fmt = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const year = parts.find(p => p.type === 'year')!.value;
  const month = parts.find(p => p.type === 'month')!.value;
  const day = parts.find(p => p.type === 'day')!.value;
  return `${year}-${month}-${day}`;
}

/**
 * JSTでの「今月の開始日」と「翌月の開始日」を返す（fiscal_year_end_month対応版）。
 */
export function jstMonthRange(): { start: string; end: string; year: number; month: number } {
  const today = jstToday();
  const [yearStr, monthStr] = today.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const start = `${yearStr}-${monthStr}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return { start, end, year, month };
}

// ====== LINE ユーザー管理 ======

export interface LineUser {
  id: string;
  line_user_id: string;
  company_id: string | null;
  display_name: string;
  industry: string;
  onboarding_step: string;  // 'new' | 'industry_asked' | 'completed'
}

/**
 * LINE userId から登録済みユーザーを取得。未登録ならnull。
 */
export async function getLineUser(lineUserId: string): Promise<LineUser | null> {
  const { data, error } = await supabase
    .from('line_users')
    .select('*')
    .eq('line_user_id', lineUserId)
    .single();

  if (error || !data) return null;
  return data as LineUser;
}

/**
 * 新規LINE ユーザーを登録し、同時にcompanyレコードも作成。
 */
export async function createLineUser(lineUserId: string, displayName: string): Promise<LineUser> {
  // まず会社を作成（owner_idはnull — LINE経由のユーザーはSupabase Authと紐付かない）
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({
      name: displayName ? `${displayName}の会社` : '未設定',
      owner_id: null,  // LINE経由は Supabase Auth を使わない
    })
    .select('id')
    .single();

  if (companyError) {
    console.error('[LINE DB] Company creation failed:', companyError);
    throw companyError;
  }

  // LINE ユーザーを登録
  const { data: user, error: userError } = await supabase
    .from('line_users')
    .insert({
      line_user_id: lineUserId,
      company_id: company.id,
      display_name: displayName,
      onboarding_step: 'new',
    })
    .select('*')
    .single();

  if (userError) {
    console.error('[LINE DB] User creation failed:', userError);
    throw userError;
  }

  return user as LineUser;
}

/**
 * オンボーディングステップと業種を更新。
 */
export async function updateLineUserOnboarding(
  lineUserId: string,
  updates: { onboarding_step?: string; industry?: string }
): Promise<void> {
  const { error } = await supabase
    .from('line_users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('line_user_id', lineUserId);

  if (error) console.error('[LINE DB] Update onboarding failed:', error);

  // 業種が変わったらcompaniesにも反映
  if (updates.industry) {
    const user = await getLineUser(lineUserId);
    if (user?.company_id) {
      await supabase
        .from('companies')
        .update({ industry: updates.industry })
        .eq('id', user.company_id);
    }
  }
}

// ====== 重複検出 ======

/**
 * 同じ取引先+金額+日付の取引が既に存在するかチェック（レシート重複検出）。
 */
export async function checkDuplicateReceipt(
  companyId: string,
  store: string | null,
  amount: number | null,
  date: string,
): Promise<boolean> {
  if (!store || !amount) return false;
  const { data } = await supabase
    .from('transactions')
    .select('id')
    .eq('company_id', companyId)
    .eq('counterparty', store)
    .eq('amount', amount)
    .eq('date', date)
    .is('deleted_at', null)
    .limit(1);
  return (data != null && data.length > 0);
}

// ====== 取引の保存・読み取り ======

export interface ReceiptData {
  amount: number | null;
  store: string | null;
  date: string | null;
  items: string | null;
  category: string;
  categoryLabel: string;
  confidence: number;
  needsReview?: boolean;
  reviewReason?: string;
  isReducedTax?: boolean;
  isWithholding?: boolean;
}

/**
 * レシートOCR結果をtransactionとしてDBに保存。
 * - JST タイムゾーンで日付を扱う
 * - レシート画像を Supabase Storage に保存（電帳法対応：7年保管）
 * - confidence < 0.85 or needsReview なら pending_reviews にも自動INSERT
 * - audit_logs に作成記録を残す（電帳法対応）
 * 返り値: { txId: 保存されたtransactionのID, imageUploadFailed: 画像保存が失敗したか }
 */
export async function saveReceiptTransaction(
  companyId: string,
  receipt: ReceiptData,
  imageBuffer?: Buffer,
): Promise<{ txId: string; imageUploadFailed: boolean }> {
  const txId = crypto.randomUUID();
  const today = jstToday();
  let imageUploadFailed = false;

  // 1. レシート画像を Supabase Storage に保存（電帳法：受領証憑7年保管）
  let receiptStoragePath: string | null = null;
  let receiptUrl: string | null = null;
  if (imageBuffer) {
    const path = `${companyId}/${today}/${txId}.jpg`;
    const { error: uploadErr } = await supabase.storage
      .from('receipts')
      .upload(path, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });
    if (uploadErr) {
      console.error('[LINE DB] Receipt image upload failed:', uploadErr);
      imageUploadFailed = true;
      // 画像保存失敗してもDB保存は継続（電帳法違反警告は別途出す）
    } else {
      receiptStoragePath = path;
      // private bucket なので signed URL 生成（7日有効、UI表示用）
      const { data: signed } = await supabase.storage
        .from('receipts')
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      receiptUrl = signed?.signedUrl || null;
    }
  }

  // 2. needsReview 判定: confidence または明示フラグ
  const needsReview = receipt.needsReview === true || receipt.confidence < 0.85;
  const status: 'processed' | 'pending' = needsReview ? 'pending' : 'processed';

  // 3. transactions に INSERT
  const { error } = await supabase
    .from('transactions')
    .insert({
      id: txId,
      company_id: companyId,
      date: receipt.date || today,
      description: [receipt.store, receipt.items].filter(Boolean).join(' '),
      amount: receipt.amount || 0,
      type: 'expense',
      category: receipt.category,
      category_label: receipt.categoryLabel,
      counterparty: receipt.store || '',
      source: 'LINE レシート',
      status,
      confidence: receipt.confidence,
      receipt_url: receiptUrl,
      receipt_storage_path: receiptStoragePath,
      receipt_uploaded_at: receiptStoragePath ? new Date().toISOString() : null,
    });

  if (error) {
    console.error('[LINE DB] Save receipt transaction failed:', error);
    throw error;
  }

  // 4. needsReview なら pending_reviews にも自動INSERT
  if (needsReview) {
    const reviewQuestion = receipt.reviewReason
      || `「${receipt.store || '不明'}」の勘定科目を確認してください（AI推定: ${receipt.categoryLabel}, 信頼度${Math.round(receipt.confidence * 100)}%）`;
    await supabase
      .from('pending_reviews')
      .insert({
        transaction_id: txId,
        question: reviewQuestion,
        choices: [
          { label: '材料費', value: '材料仕入高' },
          { label: '消耗品', value: '消耗品費' },
          { label: '会議費', value: '会議費' },
          { label: '交際費', value: '交際費' },
          { label: '交通費', value: '旅費交通費' },
          { label: '通信費', value: '通信費' },
          { label: '雑費', value: '雑費' },
          { label: '備品', value: '工具器具備品' },
          { label: '車両', value: '車両運搬具' },
          { label: '業務委託', value: '業務委託料' },
          { label: '広告費', value: '広告宣伝費' },
          { label: '立替精算', value: '役員借入金' },
        ],
      });
  }

  // 5. audit_logs に記録（電帳法：訂正削除の履歴）
  await supabase
    .from('audit_logs')
    .insert({
      company_id: companyId,
      table_name: 'transactions',
      record_id: txId,
      action: 'create',
      new_values: {
        category: receipt.category,
        amount: receipt.amount,
        store: receipt.store,
        confidence: receipt.confidence,
        source: 'LINE レシート (OCR)',
      },
      changed_by: 'ai',
    })
    .then(({ error: auditErr }) => {
      if (auditErr) console.error('[LINE DB] Audit log failed:', auditErr);
    });

  return { txId, imageUploadFailed };
}

/**
 * 取引IDから counterparty を取得（学習用）。
 */
export async function getTransactionCounterparty(txId: string): Promise<string | null> {
  const { data } = await supabase
    .from('transactions')
    .select('counterparty')
    .eq('id', txId)
    .single();
  return data?.counterparty || null;
}

/**
 * 会社情報を取得（節税アドバイス・財務諸表生成で使用）。
 */
export async function getCompanyInfo(companyId: string): Promise<{
  name: string | null;
  industry: string | null;
  capital_amount: number | null;
  employee_count: number | null;
  fiscal_year_end_month: number | null;
  owner_name: string | null;
  representative_name?: string | null;
  address?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  invoice_registration_number?: string | null;
  bank_account?: string | null;
} | null> {
  const { data } = await supabase
    .from('companies')
    .select('name, industry, capital_amount, employee_count, fiscal_year_end_month, owner_name, representative_name, address, postal_code, phone, invoice_registration_number, bank_account')
    .eq('id', companyId)
    .single();
  return data || null;
}

/**
 * 会社情報を更新（settings画面から）。
 */
export async function updateCompanyInfo(
  companyId: string,
  updates: {
    name?: string;
    representative_name?: string;
    address?: string;
    postal_code?: string;
    phone?: string;
    invoice_registration_number?: string;
    bank_account?: string;
    industry?: string;
    capital_amount?: number;
    employee_count?: number;
    fiscal_year_end_month?: number;
  }
): Promise<void> {
  const { error } = await supabase
    .from('companies')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', companyId);
  if (error) {
    console.error('[LINE DB] updateCompanyInfo failed:', error);
    throw error;
  }
}

/**
 * 取引先マスタから取得 or 作成（請求書作成時に呼ぶ）。
 */
export async function upsertPartner(
  companyId: string,
  name: string,
  details: {
    address?: string;
    postal_code?: string;
    phone?: string;
    invoice_registration_number?: string;
    is_individual?: boolean;
  } = {}
): Promise<string> {
  const { data: existing } = await supabase
    .from('partners')
    .select('id, use_count')
    .eq('company_id', companyId)
    .eq('name', name)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('partners')
      .update({
        ...details,
        use_count: existing.use_count + 1,
        last_used: jstToday(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return existing.id;
  }

  const { data, error } = await supabase
    .from('partners')
    .insert({
      company_id: companyId,
      name,
      ...details,
      use_count: 1,
      last_used: jstToday(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data!.id;
}

/**
 * LINE連携コードを保存。
 */
export async function saveLinkCode(lineUserId: string, code: string, expiresAt: string): Promise<void> {
  const { error } = await supabase
    .from('line_users')
    .update({ link_code: code, link_code_expires_at: expiresAt })
    .eq('line_user_id', lineUserId);
  if (error) console.error('[LINE DB] saveLinkCode failed:', error);
}

/**
 * 取引先候補を取得（最近使った順）。
 */
export async function getRecentPartners(companyId: string, limit = 10): Promise<Array<{
  id: string;
  name: string;
  address: string;
  postal_code: string;
  invoice_registration_number: string;
}>> {
  const { data } = await supabase
    .from('partners')
    .select('id, name, address, postal_code, invoice_registration_number')
    .eq('company_id', companyId)
    .order('last_used', { ascending: false })
    .limit(limit);
  return data || [];
}

/**
 * 取引の勘定科目を更新（ユーザーが修正した場合）。
 * audit_logs に記録 + 該当 pending_reviews を解決済みに。
 */
export async function updateTransactionCategory(
  txId: string,
  category: string,
  categoryLabel: string,
): Promise<void> {
  // 旧値を取得（audit_log 用）
  const { data: oldTx } = await supabase
    .from('transactions')
    .select('category, category_label, company_id')
    .eq('id', txId)
    .single();

  const { error } = await supabase
    .from('transactions')
    .update({
      category,
      category_label: categoryLabel,
      status: 'processed',
      confidence: 1.0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', txId);

  if (error) {
    console.error('[LINE DB] Update category failed:', error);
    return;
  }

  // pending_reviews を解決済みに
  await supabase
    .from('pending_reviews')
    .update({
      answered_value: category,
      answered_at: new Date().toISOString(),
    })
    .eq('transaction_id', txId);

  // audit_logs に記録（電帳法）
  if (oldTx) {
    await supabase
      .from('audit_logs')
      .insert({
        company_id: oldTx.company_id,
        table_name: 'transactions',
        record_id: txId,
        action: 'update',
        old_values: {
          category: oldTx.category,
          category_label: oldTx.category_label,
        },
        new_values: { category, category_label: categoryLabel },
        changed_by: 'user',
      });
  }
}

/**
 * 特定会社の今月の経費サマリーを取得（JST基準）。
 */
export async function getMonthlyExpenseSummary(companyId: string): Promise<{
  totalExpense: number;
  totalIncome: number;
  transactionCount: number;
  byCategory: { category: string; label: string; amount: number; count: number }[];
}> {
  const { start: monthStart, end: nextMonth } = jstMonthRange();

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('company_id', companyId)
    .gte('date', monthStart)
    .lt('date', nextMonth);

  if (error || !data) {
    return { totalExpense: 0, totalIncome: 0, transactionCount: 0, byCategory: [] };
  }

  const expenses = data.filter(t => t.type === 'expense');
  const incomes = data.filter(t => t.type === 'income');

  // カテゴリ別集計
  const categoryMap = new Map<string, { label: string; amount: number; count: number }>();
  for (const tx of expenses) {
    const key = tx.category;
    const existing = categoryMap.get(key);
    if (existing) {
      existing.amount += Number(tx.amount);
      existing.count += 1;
    } else {
      categoryMap.set(key, {
        label: tx.category_label || tx.category,
        amount: Number(tx.amount),
        count: 1,
      });
    }
  }

  return {
    totalExpense: expenses.reduce((s, t) => s + Number(t.amount), 0),
    totalIncome: incomes.reduce((s, t) => s + Number(t.amount), 0),
    transactionCount: data.length,
    byCategory: Array.from(categoryMap.entries())
      .map(([category, info]) => ({ category, ...info }))
      .sort((a, b) => b.amount - a.amount),
  };
}

/**
 * 特定会社の直近N件の取引を取得。
 */
export async function getRecentTransactions(companyId: string, limit = 10): Promise<{
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  category: string;
  categoryLabel: string;
}[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, date, description, amount, type, category, category_label')
    .eq('company_id', companyId)
    .order('date', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map(t => ({
    id: t.id,
    date: t.date,
    description: t.description,
    amount: Number(t.amount),
    type: t.type,
    category: t.category,
    categoryLabel: t.category_label || t.category,
  }));
}

/**
 * 特定カテゴリの今月の合計を取得（「今月の会議費 計¥XX」表示用、JST基準）。
 */
export async function getCategoryMonthlyTotal(
  companyId: string,
  category: string,
): Promise<{ total: number; count: number }> {
  const { start: monthStart, end: nextMonth } = jstMonthRange();

  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('company_id', companyId)
    .eq('category', category)
    .eq('type', 'expense')
    .gte('date', monthStart)
    .lt('date', nextMonth);

  if (error || !data) return { total: 0, count: 0 };

  return {
    total: data.reduce((s, t) => s + Number(t.amount), 0),
    count: data.length,
  };
}

/**
 * 入金（売上）をtransactionとして保存（JST基準、audit_log付き）。
 */
export async function saveIncomeTransaction(
  companyId: string,
  amount: number,
  counterparty: string,
  description: string,
): Promise<string> {
  const txId = crypto.randomUUID();
  const today = jstToday();

  const { error } = await supabase
    .from('transactions')
    .insert({
      id: txId,
      company_id: companyId,
      date: today,
      description: description || `${counterparty}からの入金`,
      amount,
      type: 'income',
      category: '売上高',
      category_label: '売上',
      counterparty,
      source: 'LINE 入金記録',
      status: 'processed',
      confidence: 1.0,
    });

  if (error) {
    console.error('[LINE DB] Save income failed:', error);
    throw error;
  }

  // audit_logs（電帳法）
  await supabase.from('audit_logs').insert({
    company_id: companyId,
    table_name: 'transactions',
    record_id: txId,
    action: 'create',
    new_values: { category: '売上高', amount, counterparty, source: 'LINE 入金記録' },
    changed_by: 'user',
  });

  return txId;
}

// ====== 取引の論理削除 ======

/**
 * 取引を論理削除（deleted_at を設定）+ audit_log 記録。
 */
export async function softDeleteTransaction(txId: string, companyId: string, reason?: string): Promise<boolean> {
  const { error } = await supabase
    .from('transactions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', txId)
    .eq('company_id', companyId);

  if (error) { console.error('[LINE DB] Soft delete failed:', error); return false; }

  // audit log
  await supabase.from('audit_logs').insert({
    company_id: companyId,
    table_name: 'transactions',
    record_id: txId,
    action: 'delete',
    new_values: { reason: reason || 'user_deleted_via_line' },
    changed_by: 'user',
  });

  return true;
}

// ====== 学習エンジン ======

/**
 * 仕訳パターンを学習（DB保存）。同じ取引先なら更新、なければ新規。
 */
export async function learnPattern(
  companyId: string,
  counterparty: string,
  description: string,
  category: string,
  categoryLabel: string,
  type: 'income' | 'expense',
): Promise<void> {
  if (!counterparty) return;

  const keywords = description.replace(/\d+/g, '').replace(/[月分年回]/g, '').trim();

  const { data: existing } = await supabase
    .from('learned_patterns')
    .select('id, use_count')
    .eq('company_id', companyId)
    .eq('counterparty', counterparty)
    .eq('type', type)
    .single();

  if (existing) {
    await supabase
      .from('learned_patterns')
      .update({
        category,
        category_label: categoryLabel,
        description_pattern: keywords,
        use_count: existing.use_count + 1,
        last_used: new Date().toISOString().split('T')[0],
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('learned_patterns')
      .insert({
        company_id: companyId,
        counterparty,
        description_pattern: keywords,
        category,
        category_label: categoryLabel,
        type,
        use_count: 1,
      });
  }
}

/**
 * 学習済みパターンで仕訳を推定。
 */
export async function predictFromLearned(
  companyId: string,
  counterparty: string,
  type: 'income' | 'expense',
): Promise<{ category: string; categoryLabel: string; confidence: number } | null> {
  const { data } = await supabase
    .from('learned_patterns')
    .select('category, category_label, use_count')
    .eq('company_id', companyId)
    .eq('counterparty', counterparty)
    .eq('type', type)
    .single();

  if (!data) return null;

  return {
    category: data.category,
    categoryLabel: data.category_label,
    confidence: Math.min(0.95, 0.85 + data.use_count * 0.02),
  };
}
