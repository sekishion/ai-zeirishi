// 節税アドバイスAI
// 会社の状況に応じて節税提案を自動生成
// 国内外で誰もやれていない最大の差別化ポイント

import type { Transaction } from '@/types';

export interface TaxAdvice {
  id: string;
  title: string;
  description: string;
  savingsEstimate: number;  // 推定節税額（年間）
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'deduction' | 'timing' | 'structure' | 'investment';
  applicable: boolean;
  reason: string;           // なぜこの提案が適用されるか
}

export function generateTaxAdvice(
  transactions: Transaction[],
  companyInfo: {
    capitalAmount?: number;    // 資本金
    employeeCount?: number;    // 従業員数
    isSmallBusiness?: boolean; // 中小企業者等か
  } = {}
): TaxAdvice[] {
  const advices: TaxAdvice[] = [];
  const isSmall = companyInfo.isSmallBusiness !== false; // デフォルトtrue

  // データが少なすぎる場合は提案しない（最低3ヶ月、かつ取引10件以上）
  if (transactions.length < 10) return [];
  const monthSet = [...new Set(transactions.map(t => t.date.slice(0, 7)))];
  if (monthSet.length < 3) return [];

  // 年間の数字を集計
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const profit = income - expense;
  // 年換算: ユニーク月数で割って12倍するのではなく、最古〜最新の実日数ベース
  const dates = transactions.map(t => new Date(t.date).getTime()).sort();
  const spanDays = Math.max(1, (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24));
  const annualProfit = Math.round(profit * (365 / spanDays));

  // 1. 小規模企業共済
  if (annualProfit > 500000) {
    advices.push({
      id: 'shokibo-kyosai',
      title: '小規模企業共済',
      description: '掛金が全額所得控除。月¥7万（年¥84万）まで。退職金としても受け取れる。',
      savingsEstimate: Math.min(840000, Math.round(annualProfit * 0.15)),
      difficulty: 'easy',
      category: 'deduction',
      applicable: true,
      reason: `年間利益が${Math.round(annualProfit / 10000)}万円の見込み。所得控除で約${Math.round(Math.min(840000, annualProfit * 0.15) / 10000)}万円の節税効果。`,
    });
  }

  // 2. 経営セーフティ共済（倒産防止共済）
  if (annualProfit > 1000000) {
    advices.push({
      id: 'safety-kyosai',
      title: '経営セーフティ共済',
      description: '掛金が全額損金算入。月¥20万（年¥240万）まで。40ヶ月以上で全額戻る。',
      savingsEstimate: Math.min(2400000, Math.round(annualProfit * 0.25)),
      difficulty: 'easy',
      category: 'deduction',
      applicable: true,
      reason: `利益が年${Math.round(annualProfit / 10000)}万円。最大年¥240万を損金算入可能。実質的な利益繰延べ。`,
    });
  }

  // 3. 少額減価償却資産の特例
  if (isSmall) {
    const largePurchases = transactions.filter(t =>
      t.type === 'expense' && t.amount >= 100000 && t.amount < 300000
    );
    if (largePurchases.length > 0) {
      advices.push({
        id: 'shougaku-genkyo',
        title: '少額減価償却資産の特例',
        description: '30万円未満の備品を即時経費化。中小企業者等の特例（年300万円まで）。',
        savingsEstimate: largePurchases.reduce((s, t) => s + Math.round(t.amount * 0.25), 0),
        difficulty: 'easy',
        category: 'deduction',
        applicable: true,
        reason: `${largePurchases.length}件の10〜30万円の購入あり。固定資産にせず即時経費化で節税。`,
      });
    }
  }

  // 4. 役員報酬の最適化
  const officerPay = transactions.filter(t =>
    t.categoryLabel === '役員報酬' || t.category === '役員報酬'
  );
  if (officerPay.length > 0 && annualProfit > 3000000) {
    advices.push({
      id: 'officer-pay',
      title: '役員報酬の見直し',
      description: '法人税と所得税のバランスを最適化。年度開始3ヶ月以内に改定可能。',
      savingsEstimate: Math.round(annualProfit * 0.05),
      difficulty: 'medium',
      category: 'structure',
      applicable: true,
      reason: `利益が年${Math.round(annualProfit / 10000)}万円。役員報酬を調整して法人税率と所得税率の最適点を探る余地あり。`,
    });
  }

  // 5. 決算賞与
  if (annualProfit > 2000000 && (companyInfo.employeeCount || 0) > 0) {
    advices.push({
      id: 'kessan-bonus',
      title: '決算賞与の支給',
      description: '期末に従業員に賞与を支給。支給予定を通知し、1ヶ月以内に支払えば損金算入。',
      savingsEstimate: Math.round(annualProfit * 0.1),
      difficulty: 'medium',
      category: 'timing',
      applicable: true,
      reason: '従業員のモチベーション向上と節税を同時に実現。',
    });
  }

  // 6. 消費税の簡易課税
  if (income < 50000000 && income > 10000000) {
    advices.push({
      id: 'kani-kazei',
      title: '消費税の簡易課税制度',
      description: '課税売上¥5,000万以下なら選択可能。みなし仕入率で計算するため有利になる場合がある。',
      savingsEstimate: Math.round(income * 0.01),
      difficulty: 'medium',
      category: 'structure',
      applicable: true,
      reason: `売上${Math.round(income / 10000)}万円。業種によってはみなし仕入率の方が有利。要シミュレーション。`,
    });
  }

  // 7. 旅費規程の整備
  advices.push({
    id: 'ryohi-kitei',
    title: '旅費規程の整備',
    description: '日当を非課税で支給可能。出張が多い場合に有効。',
    savingsEstimate: 120000,
    difficulty: 'easy',
    category: 'deduction',
    applicable: transactions.some(t => t.categoryLabel === '交通費' || t.category === '旅費交通費'),
    reason: '交通費の支出あり。旅費規程を整備すれば日当を損金算入できる。',
  });

  // 8. iDeCo（個人型確定拠出年金）
  if (annualProfit > 1000000) {
    advices.push({
      id: 'ideco',
      title: 'iDeCo（個人型確定拠出年金）',
      description: '掛金が全額所得控除。役員は月¥2.3万（年¥27.6万）まで。',
      savingsEstimate: Math.round(276000 * 0.2),
      difficulty: 'easy',
      category: 'deduction',
      applicable: true,
      reason: '所得控除で約5.5万円/年の節税効果。老後資金の準備も同時にできる。',
    });
  }

  return advices
    .filter(a => a.applicable)
    .sort((a, b) => b.savingsEstimate - a.savingsEstimate);
}

// インボイス登録番号の検証
export function validateInvoiceNumber(number: string): {
  valid: boolean;
  format: boolean;
  message: string;
} {
  // T + 13桁の数字
  const formatOk = /^T\d{13}$/.test(number);

  if (!formatOk) {
    return { valid: false, format: false, message: 'インボイス登録番号の形式が正しくありません（T+13桁の数字）' };
  }

  // 実際のAPI検証は国税庁のWeb-APIを使う（デモでは形式チェックのみ）
  return { valid: true, format: true, message: '形式は正しいです。国税庁のデータベースとの照合は準備中です。' };
}

// 定期請求の管理
export interface RecurringInvoice {
  id: string;
  client: string;
  description: string;
  amount: number;          // 税抜
  tax: number;
  total: number;
  dayOfMonth: number;      // 毎月何日に発行
  nextDate: string;
  active: boolean;
  createdAt: string;
}

const RECURRING_KEY = 'ai-tax-recurring-invoices';

export function loadRecurringInvoices(): RecurringInvoice[] {
  try {
    const saved = localStorage.getItem(RECURRING_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

export function saveRecurringInvoices(invoices: RecurringInvoice[]): void {
  try {
    localStorage.setItem(RECURRING_KEY, JSON.stringify(invoices));
  } catch { /* */ }
}

export function createRecurringInvoice(
  client: string,
  description: string,
  amount: number,
  dayOfMonth: number = 25
): RecurringInvoice {
  const tax = Math.floor(amount * 0.1);
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth);

  const invoice: RecurringInvoice = {
    id: `rec-${Date.now()}`,
    client,
    description,
    amount,
    tax,
    total: amount + tax,
    dayOfMonth,
    nextDate: nextMonth.toISOString().split('T')[0],
    active: true,
    createdAt: now.toISOString().split('T')[0],
  };

  const all = loadRecurringInvoices();
  all.push(invoice);
  saveRecurringInvoices(all);

  return invoice;
}
