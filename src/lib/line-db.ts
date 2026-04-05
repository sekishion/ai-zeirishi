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

// ====== 取引の保存・読み取り ======

export interface ReceiptData {
  amount: number | null;
  store: string | null;
  date: string | null;
  items: string | null;
  category: string;
  categoryLabel: string;
  confidence: number;
}

/**
 * レシートOCR結果をtransactionとしてDBに保存。
 * 返り値: 保存されたtransactionのID。
 */
export async function saveReceiptTransaction(
  companyId: string,
  receipt: ReceiptData,
): Promise<string> {
  const txId = crypto.randomUUID();
  const today = new Date().toISOString().split('T')[0];

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
      status: receipt.confidence >= 0.8 ? 'processed' : 'pending',
      confidence: receipt.confidence,
    });

  if (error) {
    console.error('[LINE DB] Save receipt transaction failed:', error);
    throw error;
  }

  return txId;
}

/**
 * 取引の勘定科目を更新（ユーザーが修正した場合）。
 */
export async function updateTransactionCategory(
  txId: string,
  category: string,
  categoryLabel: string,
): Promise<void> {
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

  if (error) console.error('[LINE DB] Update category failed:', error);
}

/**
 * 特定会社の今月の経費サマリーを取得。
 */
export async function getMonthlyExpenseSummary(companyId: string): Promise<{
  totalExpense: number;
  totalIncome: number;
  transactionCount: number;
  byCategory: { category: string; label: string; amount: number; count: number }[];
}> {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const nextMonth = now.getMonth() === 11
    ? `${now.getFullYear() + 1}-01-01`
    : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`;

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
 * 特定カテゴリの今月の合計を取得（「今月の会議費 計¥XX」表示用）。
 */
export async function getCategoryMonthlyTotal(
  companyId: string,
  category: string,
): Promise<{ total: number; count: number }> {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const nextMonth = now.getMonth() === 11
    ? `${now.getFullYear() + 1}-01-01`
    : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`;

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
 * 入金（売上）をtransactionとして保存。
 */
export async function saveIncomeTransaction(
  companyId: string,
  amount: number,
  counterparty: string,
  description: string,
): Promise<string> {
  const txId = crypto.randomUUID();
  const today = new Date().toISOString().split('T')[0];

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
  return txId;
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
