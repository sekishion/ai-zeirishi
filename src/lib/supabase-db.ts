'use client';

import { createSupabaseBrowserClient } from '@/lib/auth';
import type { Transaction, PendingItem } from '@/types';
import type { AppState } from '@/lib/store';

const supabase = createSupabaseBrowserClient();

// ====== 会社 ======

export async function getOrCreateCompany(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // 既存の会社を取得
  const { data: existing } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (existing) return existing.id;

  // なければ作成
  const { data: created, error } = await supabase
    .from('companies')
    .insert({ name: '未設定', owner_id: user.id })
    .select('id')
    .single();

  if (error) {
    console.error('[Supabase] Company creation failed:', error);
    return null;
  }
  return created.id;
}

export async function saveCompanyInfo(companyId: string, info: AppState['companyInfo'], companyName: string, ownerName: string): Promise<void> {
  const { error } = await supabase
    .from('companies')
    .update({
      name: companyName,
      owner_name: ownerName,
      industry: info.industry,
      employee_count: info.employeeCount,
      annual_revenue: info.annualRevenue,
      capital_amount: info.capitalAmount,
      fiscal_year_end_month: info.fiscalYearEnd,
      setup_completed: true,
    })
    .eq('id', companyId);

  if (error) console.error('[Supabase] Company update failed:', error);
}

export async function loadCompanyInfo(companyId: string): Promise<{
  companyName: string;
  ownerName: string;
  setupCompleted: boolean;
  companyInfo: AppState['companyInfo'];
} | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (error || !data) return null;

  return {
    companyName: data.name || '未設定',
    ownerName: data.owner_name || '',
    setupCompleted: data.setup_completed || false,
    companyInfo: {
      industry: data.industry || '建設業',
      employeeCount: data.employee_count || 1,
      annualRevenue: data.annual_revenue || '',
      fiscalYearEnd: data.fiscal_year_end_month || 3,
      capitalAmount: data.capital_amount || 0,
    },
  };
}

// ====== 取引 ======

function txToDb(tx: Transaction, companyId: string) {
  return {
    id: tx.id,
    company_id: companyId,
    date: tx.date,
    description: tx.description,
    amount: tx.amount,
    type: tx.type,
    category: tx.category,
    category_label: tx.categoryLabel,
    counterparty: tx.counterparty,
    source: tx.source,
    status: tx.status === 'processed' || tx.status === 'pending' || tx.status === 'error'
      ? tx.status : 'pending',
    confidence: tx.confidence,
  };
}

function dbToTx(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as string,
    date: row.date as string,
    time: '',
    description: row.description as string,
    amount: Number(row.amount),
    type: row.type as 'income' | 'expense',
    category: row.category as string,
    categoryLabel: (row.category_label as string) || (row.category as string),
    counterparty: (row.counterparty as string) || '',
    source: (row.source as string) || '',
    status: (row.status as Transaction['status']) || 'processed',
    confidence: Number(row.confidence) || 0,
    receiptUrl: row.receipt_url as string | undefined,
  };
}

export async function loadTransactions(companyId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('company_id', companyId)
    .order('date', { ascending: false });

  if (error) {
    console.error('[Supabase] Load transactions failed:', error);
    return [];
  }
  return (data || []).map(dbToTx);
}

export async function saveTransactions(companyId: string, transactions: Transaction[]): Promise<void> {
  if (transactions.length === 0) return;

  const rows = transactions.map(tx => txToDb(tx, companyId));

  const { error } = await supabase
    .from('transactions')
    .upsert(rows, { onConflict: 'id' });

  if (error) console.error('[Supabase] Save transactions failed:', error);
}

export async function deleteTransaction(txId: string): Promise<void> {
  // pending_reviews も cascade で消える
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', txId);

  if (error) console.error('[Supabase] Delete transaction failed:', error);
}

export async function updateTransaction(txId: string, updates: Partial<Transaction>): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.categoryLabel !== undefined) dbUpdates.category_label = updates.categoryLabel;
  if (updates.status !== undefined) {
    dbUpdates.status = updates.status === 'processed' || updates.status === 'pending' || updates.status === 'error'
      ? updates.status : 'processed';
  }
  if (updates.confidence !== undefined) dbUpdates.confidence = updates.confidence;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.counterparty !== undefined) dbUpdates.counterparty = updates.counterparty;
  dbUpdates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('transactions')
    .update(dbUpdates)
    .eq('id', txId);

  if (error) console.error('[Supabase] Update transaction failed:', error);
}

// ====== 確認待ち ======

export async function loadPendingReviews(companyId: string): Promise<PendingItem[]> {
  // まずこの会社の取引IDを取得し、それに紐づくレビューのみ取得
  const { data: txIds } = await supabase
    .from('transactions')
    .select('id')
    .eq('company_id', companyId);

  if (!txIds || txIds.length === 0) return [];

  const ids = txIds.map(t => t.id);

  const { data, error } = await supabase
    .from('pending_reviews')
    .select(`
      id,
      question,
      choices,
      transaction_id,
      transactions (*)
    `)
    .in('transaction_id', ids)
    .is('answered_value', null);

  if (error) {
    console.error('[Supabase] Load pending reviews failed:', error);
    return [];
  }

  return (data || [])
    .filter((r: Record<string, unknown>) => r.transactions)
    .map((r: Record<string, unknown>) => ({
      id: r.id as string,
      transaction: dbToTx(r.transactions as Record<string, unknown>),
      question: r.question as string,
      choices: (r.choices as { label: string; value: string }[]) || [],
    }));
}

export async function savePendingReviews(companyId: string, items: PendingItem[]): Promise<void> {
  if (items.length === 0) return;

  const rows = items.map(item => ({
    id: item.id,
    transaction_id: item.transaction.id,
    question: item.question,
    choices: item.choices,
  }));

  const { error } = await supabase
    .from('pending_reviews')
    .upsert(rows, { onConflict: 'id' });

  if (error) console.error('[Supabase] Save pending reviews failed:', error);
}

export async function resolvePendingReview(reviewId: string, choiceValue: string): Promise<void> {
  const { error } = await supabase
    .from('pending_reviews')
    .update({
      answered_value: choiceValue,
      answered_at: new Date().toISOString(),
    })
    .eq('id', reviewId);

  if (error) console.error('[Supabase] Resolve pending review failed:', error);
}

// ====== 全データ読み込み ======

export async function loadAllFromSupabase(): Promise<{
  companyId: string;
  transactions: Transaction[];
  pendingItems: PendingItem[];
  companyName: string;
  ownerName: string;
  setupCompleted: boolean;
  companyInfo: AppState['companyInfo'];
} | null> {
  const companyId = await getOrCreateCompany();
  if (!companyId) return null;

  const [transactions, pendingItems, companyInfo] = await Promise.all([
    loadTransactions(companyId),
    loadPendingReviews(companyId),
    loadCompanyInfo(companyId),
  ]);

  return {
    companyId,
    transactions,
    pendingItems,
    companyName: companyInfo?.companyName || '未設定',
    ownerName: companyInfo?.ownerName || '',
    setupCompleted: companyInfo?.setupCompleted || false,
    companyInfo: companyInfo?.companyInfo || {
      industry: '建設業',
      employeeCount: 1,
      annualRevenue: '',
      fiscalYearEnd: 3,
      capitalAmount: 0,
    },
  };
}
