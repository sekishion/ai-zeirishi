import type { Transaction } from '@/types';
import { ACCOUNTS, calcMonthlyTax, type Account } from './accounts';

export interface PLStatement {
  period: string;
  sections: PLSection[];
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  totalSGA: number;
  operatingProfit: number;
  totalNonOperating: number;
  ordinaryProfit: number;
  taxExpense: number;
  netProfit: number;
}

export interface PLSection {
  title: string;
  items: { name: string; code: string; amount: number }[];
  total: number;
}

export interface BSStatement {
  period: string;
  assets: BSSection[];
  liabilities: BSSection[];
  equity: { items: { name: string; amount: number }[]; total: number };
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
}

export interface BSSection {
  title: string;
  items: { name: string; code: string; amount: number }[];
  total: number;
}

export interface TaxSummary {
  period: string;
  salesTax: number;
  purchaseTax: number;
  taxOwed: number;
  details: { accountName: string; amount: number; tax: number; taxType: string }[];
}

function groupByAccount(transactions: Transaction[], type: 'revenue' | 'expense'): Map<string, number> {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    if ((type === 'revenue' && tx.type !== 'income') || (type === 'expense' && tx.type !== 'expense')) continue;
    const key = tx.category || tx.categoryLabel;
    map.set(key, (map.get(key) || 0) + tx.amount);
  }
  return map;
}

export function generatePL(transactions: Transaction[], period: string): PLStatement {
  const revenueMap = groupByAccount(transactions, 'revenue');
  const expenseMap = groupByAccount(transactions, 'expense');

  // 売上
  const revenueItems: { name: string; code: string; amount: number }[] = [];
  let totalRevenue = 0;
  for (const [name, amount] of revenueMap) {
    const account = ACCOUNTS.find(a => a.name === name || a.label === name);
    revenueItems.push({ name: account?.name || name, code: account?.code || '', amount });
    totalRevenue += amount;
  }

  // 売上原価: account.group が「売上原価」のものだけ。文字列includes判定は誤分類リスクがあるため廃止
  const cogsItems: { name: string; code: string; amount: number }[] = [];
  let totalCOGS = 0;
  const sgaItems: { name: string; code: string; amount: number }[] = [];
  let totalSGA = 0;

  for (const [name, amount] of expenseMap) {
    const account = ACCOUNTS.find(a => a.name === name || a.label === name);
    const isCOGS = account?.group === '売上原価';
    if (isCOGS) {
      cogsItems.push({ name: account?.name || name, code: account?.code || '', amount });
      totalCOGS += amount;
    } else {
      sgaItems.push({ name: account?.name || name, code: account?.code || '', amount });
      totalSGA += amount;
    }
  }
  sgaItems.sort((a, b) => b.amount - a.amount);

  const grossProfit = totalRevenue - totalCOGS;
  const operatingProfit = grossProfit - totalSGA;

  return {
    period,
    sections: [
      { title: '売上高', items: revenueItems, total: totalRevenue },
      { title: '売上原価', items: cogsItems, total: totalCOGS },
      { title: '販売費及び一般管理費', items: sgaItems, total: totalSGA },
    ],
    totalRevenue,
    totalCOGS,
    grossProfit,
    totalSGA,
    operatingProfit,
    totalNonOperating: 0,
    ordinaryProfit: operatingProfit,
    taxExpense: 0,
    netProfit: operatingProfit,
  };
}

export function generateTaxSummary(transactions: Transaction[], period: string): TaxSummary {
  const taxData = calcMonthlyTax(transactions.map(t => ({
    amount: t.amount,
    type: t.type,
    category: t.category || t.categoryLabel,
  })));

  const details: TaxSummary['details'] = [];
  const byAccount = new Map<string, { amount: number; type: 'income' | 'expense' }>();

  for (const tx of transactions) {
    const key = tx.category || tx.categoryLabel;
    const existing = byAccount.get(key);
    if (existing) {
      existing.amount += tx.amount;
    } else {
      byAccount.set(key, { amount: tx.amount, type: tx.type });
    }
  }

  for (const [name, data] of byAccount) {
    const account = ACCOUNTS.find(a => a.name === name || a.label === name);
    if (account) {
      const rate = account.taxType === 'taxable_10' ? 0.1 : account.taxType === 'taxable_8' ? 0.08 : 0;
      const tax = Math.floor(data.amount * rate / (1 + rate));
      if (tax > 0) {
        details.push({ accountName: account.name, amount: data.amount, tax, taxType: account.taxType });
      }
    }
  }

  return { period, ...taxData, details };
}

// CSV出力用
function escapeCSV(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function transactionsToCSV(transactions: Transaction[]): string {
  const headers = ['日付', '勘定科目', '勘定科目コード', '摘要', '取引先', '借方金額', '貸方金額', '消費税区分', 'メモ'];
  const rows = transactions.map(tx => {
    const account = ACCOUNTS.find(a => a.name === tx.category || a.label === tx.categoryLabel);
    const debit = tx.type === 'expense' ? tx.amount : '';
    const credit = tx.type === 'income' ? tx.amount : '';
    return [
      tx.date,
      account?.name || tx.category,
      account?.code || '',
      tx.description,
      tx.counterparty,
      debit,
      credit,
      account?.taxType || '',
      tx.memo || '',
    ].map(v => escapeCSV(v)).join(',');
  });
  // UTF-8 BOM をつける（Excel で開いたときの文字化け防止）
  const BOM = '\ufeff';
  return BOM + [headers.join(','), ...rows].join('\r\n');
}

// 請求書データ
export interface Invoice {
  id: string;
  client: string;
  items: { description: string; quantity: number; unitPrice: number; amount: number }[];
  subtotal: number;
  tax: number;
  total: number;
  issueDate: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid';
  companyName: string;
  registrationNumber?: string; // インボイス登録番号
}

export function generateInvoiceHTML(invoice: Invoice): string {
  const itemsHTML = invoice.items.map(item => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${item.description}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${item.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">¥${item.unitPrice.toLocaleString()}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">¥${item.amount.toLocaleString()}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>請求書</title></head>
<body style="font-family:'Noto Sans JP',sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#4A5568">
  <div style="text-align:right;margin-bottom:40px">
    <h1 style="font-size:24px;color:#2D5A8E;margin:0">請求書</h1>
    <p style="color:#888;font-size:12px">発行日: ${invoice.issueDate}</p>
    <p style="color:#888;font-size:12px">請求書番号: ${invoice.id}</p>
  </div>

  <div style="margin-bottom:30px">
    <h2 style="font-size:18px;margin:0 0 4px 0">${invoice.client} 御中</h2>
    <p style="font-size:12px;color:#888">お支払期限: ${invoice.dueDate}</p>
  </div>

  <div style="background:#F8F9FB;padding:20px;border-radius:8px;text-align:center;margin-bottom:30px">
    <p style="font-size:12px;color:#888;margin:0 0 4px 0">ご請求金額</p>
    <p style="font-size:32px;font-weight:bold;margin:0">¥${invoice.total.toLocaleString()}</p>
    <p style="font-size:12px;color:#888;margin:4px 0 0 0">（税込）</p>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
    <thead>
      <tr style="background:#F8F9FB">
        <th style="padding:8px;text-align:left;font-size:12px;color:#888">品目</th>
        <th style="padding:8px;text-align:right;font-size:12px;color:#888">数量</th>
        <th style="padding:8px;text-align:right;font-size:12px;color:#888">単価</th>
        <th style="padding:8px;text-align:right;font-size:12px;color:#888">金額</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
  </table>

  <div style="text-align:right;margin-bottom:30px">
    <p style="margin:4px 0;font-size:14px">小計: ¥${invoice.subtotal.toLocaleString()}</p>
    <p style="margin:4px 0;font-size:14px">消費税（10%）: ¥${invoice.tax.toLocaleString()}</p>
    <p style="margin:4px 0;font-size:18px;font-weight:bold">合計: ¥${invoice.total.toLocaleString()}</p>
  </div>

  <hr style="border:none;border-top:1px solid #eee;margin:30px 0">

  <div style="font-size:12px;color:#888">
    <p style="margin:2px 0;font-weight:bold;color:#4A5568">${invoice.companyName}</p>
    ${invoice.registrationNumber ? `<p style="margin:2px 0">登録番号: ${invoice.registrationNumber}</p>` : ''}
  </div>
</body>
</html>`;
}
