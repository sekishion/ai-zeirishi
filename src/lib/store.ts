'use client';

import { createContext, useContext } from 'react';
import type { Transaction, PendingItem, MonthlyReport, CashForecast, AIAccuracy, Filing, Notice, ReportListItem, MetricCardProps, ExpenseRequest, Document } from '@/types';
// NOTE: learnFromTransaction (localStorage) removed — DB learned_patterns is single source of truth
// import { learnFromTransaction } from '@/lib/learning';  // DEPRECATED: see Issue 1

export interface AppState {
  companyId: string | null;
  transactions: Transaction[];
  pendingItems: PendingItem[];
  dashboardMetrics: MetricCardProps[];
  cashForecast: CashForecast;
  notices: Notice[];
  accuracyLogs: AIAccuracy[];
  report: MonthlyReport;
  reportList: ReportListItem[];
  filings: Filing[];
  expenseRequests: ExpenseRequest[];
  documents: Document[];
  companyName: string;
  ownerName: string;
  setupCompleted: boolean;
  companyInfo: {
    industry: string;
    employeeCount: number;
    annualRevenue: string;
    fiscalYearEnd: number;
    capitalAmount: number;
  };
}

export type AppAction =
  | { type: 'RESOLVE_PENDING'; id: string; choiceValue: string }
  | { type: 'ADD_TRANSACTIONS'; transactions: Transaction[]; pending: PendingItem[] }
  | { type: 'UPDATE_TRANSACTION'; id: string; updates: Partial<Transaction> }
  | { type: 'DELETE_TRANSACTION'; id: string }
  | { type: 'SUBMIT_EXPENSE'; request: ExpenseRequest }
  | { type: 'APPROVE_EXPENSE'; id: string }
  | { type: 'REJECT_EXPENSE'; id: string; comment: string }
  | { type: 'ADD_DOCUMENT'; document: Document }
  | { type: 'COMPLETE_SETUP'; companyName: string; ownerName: string; companyInfo: AppState['companyInfo'] }
  | { type: 'RESET_DATA' }
  | { type: 'LOAD_STATE'; state: AppState }
  | { type: 'RECALCULATE' };

import {
  saveTransactions, saveCompanyInfo, savePendingReviews,
  updateTransaction as dbUpdateTx, deleteTransaction as dbDeleteTx,
  resolvePendingReview as dbResolvePending,
} from '@/lib/supabase-db';

const STORAGE_KEY = 'ai-tax-app-state';

export function saveToStorage(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota exceeded等 */ }
}

export function loadFromStorage(): AppState | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* parse error */ }
  return null;
}

export function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// 認証済みユーザー用（mockなし）
export function getEmptyState(): AppState {
  return {
    companyId: null,
    transactions: [],
    pendingItems: [],
    dashboardMetrics: [
      { label: '売上', value: '¥0', changeType: 'neutral' },
      { label: '利益', value: '¥0', changeType: 'neutral' },
      { label: '手元資金', value: '-', changeType: 'neutral' },
    ],
    cashForecast: { monthsRemaining: 0, level: 'safe', message: 'レシートを送って記帳を始めましょう', projectedBalance: 0, fixedCosts: 0 },
    notices: [{ id: 'n-welcome', message: 'ようこそ！レシートを送信するか、CSVをアップロードして記帳を始めましょう', type: 'info', date: new Date().toISOString().split('T')[0] }],
    accuracyLogs: [],
    report: { month: '', createdAt: '', summary: '', pl: { revenue: 0, revenueChange: 0, expenses: 0, expensesChange: 0, profit: 0, profitChange: 0, expenseBreakdown: [] }, bs: { assets: [], liabilities: [], totalAssets: 0, totalLiabilities: 0, netAssets: 0 }, cashflow: { inflow: 0, outflow: 0, net: 0, message: '' }, aiComments: [] },
    reportList: [],
    filings: [],
    expenseRequests: [],
    documents: [],
    companyName: '',
    ownerName: '',
    setupCompleted: false,
    companyInfo: { industry: '建設業', employeeCount: 1, annualRevenue: '', fiscalYearEnd: 3, capitalAmount: 0 },
  };
}

import { formatAmount as formatMan } from '@/lib/format';

function generateReport(transactions: Transaction[]): MonthlyReport {
  // 直近月を特定
  const months = [...new Set(transactions.map(t => t.date.slice(0, 7)))].sort().reverse();
  const currentMonth = months[0] || '2026-03';
  const prevMonth = months[1];

  const currentTx = transactions.filter(t => t.date.startsWith(currentMonth));
  const prevTx = prevMonth ? transactions.filter(t => t.date.startsWith(prevMonth)) : [];

  const income = currentTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = currentTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const profit = income - expense;

  const prevIncome = prevTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const prevExpense = prevTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const revenueChange = prevIncome > 0 ? (income - prevIncome) / prevIncome : 0;
  const expensesChange = prevExpense > 0 ? (expense - prevExpense) / prevExpense : 0;
  const prevProfit = prevIncome - prevExpense;
  const profitChange = prevProfit > 0 ? (profit - prevProfit) / prevProfit : 0;

  // 経費内訳を集計
  const expenseByCategory = new Map<string, number>();
  for (const tx of currentTx.filter(t => t.type === 'expense')) {
    const label = tx.categoryLabel || tx.category;
    expenseByCategory.set(label, (expenseByCategory.get(label) || 0) + tx.amount);
  }
  const breakdown = Array.from(expenseByCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: expense > 0 ? amount / expense : 0,
    }));

  // AIコメント生成
  const aiComments: string[] = [];
  if (revenueChange > 0.05) aiComments.push(`売上は先月比${(revenueChange * 100).toFixed(1)}%増加しています。`);
  if (revenueChange < -0.05) aiComments.push(`売上は先月比${(Math.abs(revenueChange) * 100).toFixed(1)}%減少しています。注意が必要です。`);
  if (profit > 0) aiComments.push(`今月は${formatMan(profit)}の黒字です。`);
  if (profit <= 0) aiComments.push(`今月は${formatMan(Math.abs(profit))}の赤字です。経費の見直しを検討してください。`);
  const topExpense = breakdown[0];
  if (topExpense) aiComments.push(`最大の経費は「${topExpense.name}」で${formatMan(topExpense.amount)}（全体の${(topExpense.percentage * 100).toFixed(0)}%）です。`);

  const [year, mon] = currentMonth.split('-');
  const label = `${year}年${parseInt(mon)}月`;

  return {
    month: currentMonth,
    createdAt: new Date().toISOString().split('T')[0],
    summary: `売上${formatMan(income)}、経費${formatMan(expense)}、利益${formatMan(profit)}。${revenueChange >= 0 ? `売上は先月比+${(revenueChange * 100).toFixed(1)}%。` : `売上は先月比${(revenueChange * 100).toFixed(1)}%。`}`,
    pl: {
      revenue: income,
      revenueChange,
      expenses: expense,
      expensesChange,
      profit,
      profitChange,
      expenseBreakdown: breakdown,
    },
    bs: (() => {
      const allIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const allExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const cashBalance = Math.max(0, allIncome - allExpense);
      const totalAssets = cashBalance;
      const totalLiabilities = 0;
      return {
        assets: [{ name: '現金・預金', amount: cashBalance }],
        liabilities: [{ name: '未払金等', amount: totalLiabilities }],
        totalAssets,
        totalLiabilities,
        netAssets: totalAssets - totalLiabilities,
      };
    })(),
    cashflow: {
      inflow: income,
      outflow: expense,
      net: profit,
      message: profit >= 0 ? `手元資金は先月より約${formatMan(profit)}増えました。` : `手元資金は先月より約${formatMan(Math.abs(profit))}減りました。`,
    },
    aiComments,
  };
}

function recalculate(state: AppState): AppState {
  const allTx = state.transactions;
  const pendingCount = state.pendingItems.length;

  // 月ごとに集計
  const months = [...new Set(allTx.map(t => t.date.slice(0, 7)))].sort().reverse();
  const currentMonth = months[0] || '2026-03';
  const prevMonth = months[1];

  const currentTx = allTx.filter(t => t.date.startsWith(currentMonth));
  const prevTx = prevMonth ? allTx.filter(t => t.date.startsWith(prevMonth)) : [];

  const income = currentTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = currentTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const profit = income - expense;
  const prevIncome = prevTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const prevExpense = prevTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const prevProfit = prevIncome - prevExpense;
  const revenueChange = prevIncome > 0 ? (income - prevIncome) / prevIncome : 0;
  const profitChange = prevProfit !== 0 ? (profit - prevProfit) / Math.abs(prevProfit) : 0;

  // 手元資金: 全取引の累計（旧コードはハードコード ¥10,844,240 だった→他社に表示されるバグ）
  const totalIncome = allTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = allTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const lastBalance = Math.max(0, totalIncome - totalExpense);

  const report = generateReport(allTx);

  // レポートリストを更新
  const reportList: ReportListItem[] = months.map(m => {
    const [y, mo] = m.split('-');
    return { month: m, label: `${y}年${parseInt(mo)}月`, pdfUrl: '#', createdAt: `${m}-28` };
  });

  const [year, mon] = currentMonth.split('-');
  const monthLabel = `${parseInt(mon)}月`;

  return {
    ...state,
    report,
    reportList,
    dashboardMetrics: [
      { label: '売上', value: formatMan(income), change: revenueChange >= 0 ? `+${(revenueChange * 100).toFixed(1)}%` : `${(revenueChange * 100).toFixed(1)}%`, changeType: revenueChange >= 0 ? 'positive' : 'negative' },
      { label: '利益', value: formatMan(profit), change: profitChange >= 0 ? `+${(profitChange * 100).toFixed(1)}%` : `${(profitChange * 100).toFixed(1)}%`, changeType: profit > 0 ? 'positive' : 'negative' },
      { label: '手元資金', value: formatMan(lastBalance), changeType: 'neutral' },
    ],
    cashForecast: (() => {
      const monthsRemaining = expense > 0 ? Math.floor(lastBalance / expense) : 99;
      const fixedCosts = Math.round(expense * 0.4);
      const level: 'safe' | 'caution' | 'warning' | 'critical' =
        monthsRemaining >= 6 ? 'safe' :
        monthsRemaining >= 3 ? 'caution' :
        monthsRemaining >= 1 ? 'warning' : 'critical';
      return {
        projectedBalance: lastBalance,
        fixedCosts,
        monthsRemaining,
        level,
        message: expense > 0
          ? `今のペースなら、あと${monthsRemaining}ヶ月分の運転資金があります。`
          : '経費データがまだありません。',
      };
    })(),
    notices: [
      { id: 'n-001', message: `${monthLabel}の帳簿づけ、${currentTx.length}件中${currentTx.length - pendingCount}件を自動処理しました`, type: 'info', date: new Date().toISOString().split('T')[0] },
      ...(pendingCount > 0 ? [{ id: 'n-002', message: `${pendingCount}件、確認をお願いしたい取引があります`, type: 'action' as const, link: '/pending', date: new Date().toISOString().split('T')[0] }] : []),
      { id: 'n-003', message: '消費税の確定申告（5/31期限）の準備を開始します', type: 'deadline' as const, date: new Date().toISOString().split('T')[0] },
    ],
    accuracyLogs: months.map(m => {
      const mTx = allTx.filter(t => t.date.startsWith(m));
      const mPending = m === currentMonth ? pendingCount : 0;
      return {
        month: m,
        totalTransactions: mTx.length,
        autoProcessed: mTx.length - mPending,
        manualReview: mPending,
        corrections: 0,
        accuracy: mTx.length > 0 ? (mTx.length - mPending) / mTx.length : 1,
      };
    }),
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  let newState: AppState;

  switch (action.type) {
    case 'RESOLVE_PENDING': {
      const item = state.pendingItems.find(p => p.id === action.id);
      if (!item) return state;

      const choice = item.choices.find(c => c.value === action.choiceValue);
      const resolvedCategory = choice?.value || item.transaction.category;
      const resolvedLabel = choice?.label || item.transaction.categoryLabel;
      newState = {
        ...state,
        transactions: state.transactions.map(t =>
          t.id === item.transaction.id
            ? { ...t, status: 'processed' as const, confidence: 1.0, category: resolvedCategory, categoryLabel: resolvedLabel }
            : t
        ),
        pendingItems: state.pendingItems.filter(p => p.id !== action.id),
      };
      // NOTE: localStorage learning removed — DB learned_patterns is single source of truth
      newState = recalculate(newState);
      saveToStorage(newState);
      // Supabase: 取引更新 + レビュー解決
      dbUpdateTx(item.transaction.id, { category: resolvedCategory, categoryLabel: resolvedLabel, status: 'processed', confidence: 1.0 }).catch((err) => { console.error('[Store] DB write failed (RESOLVE_PENDING/updateTx):', err); });
      dbResolvePending(action.id, action.choiceValue).catch((err) => { console.error('[Store] DB write failed (RESOLVE_PENDING/resolve):', err); });
      return newState;
    }

    case 'ADD_TRANSACTIONS': {
      newState = {
        ...state,
        transactions: [...action.transactions, ...state.transactions],
        pendingItems: [...action.pending, ...state.pendingItems],
      };
      newState = recalculate(newState);
      saveToStorage(newState);
      // Supabase: 新規取引+レビューを保存
      if (state.companyId) {
        saveTransactions(state.companyId, action.transactions).catch((err) => { console.error('[Store] DB write failed (ADD_TRANSACTIONS/saveTx):', err); });
        savePendingReviews(state.companyId, action.pending).catch((err) => { console.error('[Store] DB write failed (ADD_TRANSACTIONS/savePending):', err); });
      }
      return newState;
    }

    case 'UPDATE_TRANSACTION': {
      newState = {
        ...state,
        transactions: state.transactions.map(t =>
          t.id === action.id ? { ...t, ...action.updates, status: 'processed' as const, confidence: 1.0 } : t
        ),
      };
      // NOTE: localStorage learning removed — DB learned_patterns is single source of truth
      newState = recalculate(newState);
      saveToStorage(newState);
      dbUpdateTx(action.id, { ...action.updates, status: 'processed', confidence: 1.0 }).catch((err) => { console.error('[Store] DB write failed (UPDATE_TRANSACTION):', err); });
      return newState;
    }

    case 'DELETE_TRANSACTION': {
      newState = {
        ...state,
        transactions: state.transactions.filter(t => t.id !== action.id),
        pendingItems: state.pendingItems.filter(p => p.transaction.id !== action.id),
      };
      newState = recalculate(newState);
      saveToStorage(newState);
      dbDeleteTx(action.id, state.companyId).catch((err) => { console.error('[Store] DB write failed (DELETE_TRANSACTION):', err); });
      return newState;
    }

    case 'SUBMIT_EXPENSE': {
      newState = { ...state, expenseRequests: [action.request, ...state.expenseRequests] };
      saveToStorage(newState);
      return newState;
    }

    case 'APPROVE_EXPENSE': {
      const req = state.expenseRequests.find(r => r.id === action.id);
      if (!req) return state;
      // 承認→取引として登録
      const tx: Transaction = {
        id: `expense-${req.id}`,
        date: req.date,
        time: '09:00',
        description: `${req.submittedBy}: ${req.description}`,
        amount: req.amount,
        type: 'expense',
        category: req.category,
        categoryLabel: req.categoryLabel,
        counterparty: req.submittedBy,
        source: '経費精算',
        status: 'processed',
        confidence: 1.0,
      };
      newState = {
        ...state,
        expenseRequests: state.expenseRequests.map(r =>
          r.id === action.id ? { ...r, status: 'approved' as const, reviewedAt: new Date().toISOString() } : r
        ),
        transactions: [tx, ...state.transactions],
      };
      newState = recalculate(newState);
      saveToStorage(newState);
      return newState;
    }

    case 'REJECT_EXPENSE': {
      newState = {
        ...state,
        expenseRequests: state.expenseRequests.map(r =>
          r.id === action.id ? { ...r, status: 'rejected' as const, reviewedAt: new Date().toISOString(), reviewComment: action.comment } : r
        ),
      };
      saveToStorage(newState);
      return newState;
    }

    case 'ADD_DOCUMENT': {
      newState = { ...state, documents: [action.document, ...state.documents] };
      saveToStorage(newState);
      return newState;
    }

    case 'COMPLETE_SETUP': {
      newState = {
        ...state,
        companyName: action.companyName,
        ownerName: action.ownerName,
        companyInfo: action.companyInfo,
        setupCompleted: true,
      };
      saveToStorage(newState);
      if (state.companyId) {
        saveCompanyInfo(state.companyId, action.companyInfo, action.companyName, action.ownerName).catch((err) => { console.error('[Store] DB write failed (COMPLETE_SETUP):', err); });
      }
      return newState;
    }

    case 'RESET_DATA': {
      newState = getEmptyState();
      clearStorage();
      return newState;
    }

    case 'LOAD_STATE':
      return recalculate({ ...getEmptyState(), ...action.state });

    case 'RECALCULATE':
      newState = recalculate(state);
      saveToStorage(newState);
      return newState;

    default:
      return state;
  }
}

export const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
