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

// ====== 請求書データ（適格請求書対応） ======
export interface InvoiceItemDetail {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: 8 | 10;
  isReducedTax?: boolean;
  priceMode?: 'tax_excluded' | 'tax_included';
}

export interface Invoice {
  id: string;                              // 請求書番号
  client: string;                          // 取引先名
  clientPostalCode?: string;               // 取引先郵便番号
  clientAddress?: string;                  // 取引先住所
  clientRegistrationNumber?: string;       // 取引先インボイス登録番号
  items: InvoiceItemDetail[];
  subtotal: number;                        // 税抜小計
  subtotal10?: number;                     // 10%対象税抜
  subtotal8?: number;                      // 8%対象税抜
  tax: number;                             // 消費税合計
  tax10?: number;
  tax8?: number;
  total: number;                           // 税込合計
  issueDate: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid';
  // 発行元（自社）情報
  companyName: string;
  companyPostalCode?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyRepresentative?: string;
  registrationNumber?: string;             // 自社インボイス登録番号
  bankAccount?: string;
  memo?: string;
}

export function generateInvoiceHTML(invoice: Invoice): string {
  const has10 = (invoice.subtotal10 || 0) > 0;
  const has8 = (invoice.subtotal8 || 0) > 0;
  const hasReducedTax = has8;

  const itemsHTML = invoice.items.map(item => {
    const isReduced = item.taxRate === 8;
    const mark = isReduced ? '<span style="color:#d97706;font-weight:bold">※</span> ' : '';
    return `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee">${mark}${escapeHtml(item.description)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right">${item.quantity}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;font-variant-numeric:tabular-nums">¥${item.unitPrice.toLocaleString()}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;font-size:11px;color:#666">${item.taxRate || 10}%${isReduced ? '※' : ''}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;font-variant-numeric:tabular-nums">¥${item.amount.toLocaleString()}</td>
    </tr>
  `;
  }).join('');

  const taxBreakdownHTML = `
    ${has10 ? `
    <tr>
      <td style="padding:6px 8px;text-align:right;color:#555;font-size:13px">10%対象 計</td>
      <td style="padding:6px 8px;text-align:right;font-size:13px;font-variant-numeric:tabular-nums">¥${(invoice.subtotal10 || 0).toLocaleString()}</td>
      <td style="padding:6px 8px;text-align:right;color:#555;font-size:13px">消費税</td>
      <td style="padding:6px 8px;text-align:right;font-size:13px;font-variant-numeric:tabular-nums">¥${(invoice.tax10 || 0).toLocaleString()}</td>
    </tr>` : ''}
    ${has8 ? `
    <tr>
      <td style="padding:6px 8px;text-align:right;color:#d97706;font-size:13px">8%対象※ 計</td>
      <td style="padding:6px 8px;text-align:right;font-size:13px;color:#d97706;font-variant-numeric:tabular-nums">¥${(invoice.subtotal8 || 0).toLocaleString()}</td>
      <td style="padding:6px 8px;text-align:right;color:#d97706;font-size:13px">消費税</td>
      <td style="padding:6px 8px;text-align:right;font-size:13px;color:#d97706;font-variant-numeric:tabular-nums">¥${(invoice.tax8 || 0).toLocaleString()}</td>
    </tr>` : ''}
  `;

  const clientAddressLine = invoice.clientAddress
    ? `<p style="font-size:12px;color:#666;margin:2px 0">${invoice.clientPostalCode ? `〒${escapeHtml(invoice.clientPostalCode)} ` : ''}${escapeHtml(invoice.clientAddress)}</p>`
    : '';
  const clientRegLine = invoice.clientRegistrationNumber
    ? `<p style="font-size:11px;color:#888;margin:2px 0;font-family:monospace">登録番号: ${escapeHtml(invoice.clientRegistrationNumber)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>請求書 ${escapeHtml(invoice.id)}</title>
  <style>
    @media print { body { padding: 20mm !important; } .no-print { display: none !important; } }
    body { font-family: -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif; }
  </style>
</head>
<body style="max-width:800px;margin:0 auto;padding:40px;color:#1A2331;background:#fff">

  <!-- ヘッダー -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px">
    <div>
      <h1 style="font-size:32px;color:#1A2331;margin:0;letter-spacing:0.05em">請求書</h1>
      <p style="font-size:11px;color:#999;margin:4px 0 0 0">INVOICE</p>
    </div>
    <div style="text-align:right">
      <p style="margin:2px 0;font-size:12px;color:#666">請求書番号: <span style="font-family:monospace;color:#1A2331">${escapeHtml(invoice.id)}</span></p>
      <p style="margin:2px 0;font-size:12px;color:#666">発行日: ${escapeHtml(invoice.issueDate)}</p>
      <p style="margin:2px 0;font-size:12px;color:#666">支払期限: <b style="color:#1A2331">${escapeHtml(invoice.dueDate)}</b></p>
    </div>
  </div>

  <!-- 取引先情報 + 発行元情報 -->
  <div style="display:flex;justify-content:space-between;gap:40px;margin-bottom:32px">
    <!-- 取引先 -->
    <div style="flex:1">
      <p style="font-size:10px;color:#999;margin:0 0 4px 0;letter-spacing:0.1em">請求先 / BILL TO</p>
      <h2 style="font-size:18px;margin:0 0 4px 0;color:#1A2331">${escapeHtml(invoice.client)} 御中</h2>
      ${clientAddressLine}
      ${clientRegLine}
    </div>
    <!-- 発行元（自社） -->
    <div style="flex:1;text-align:right">
      <p style="font-size:10px;color:#999;margin:0 0 4px 0;letter-spacing:0.1em">発行元 / FROM</p>
      <p style="font-size:14px;font-weight:bold;margin:0 0 2px 0;color:#1A2331">${escapeHtml(invoice.companyName || '')}</p>
      ${invoice.companyRepresentative ? `<p style="font-size:11px;color:#666;margin:2px 0">代表 ${escapeHtml(invoice.companyRepresentative)}</p>` : ''}
      ${invoice.companyAddress ? `<p style="font-size:11px;color:#666;margin:2px 0">${invoice.companyPostalCode ? `〒${escapeHtml(invoice.companyPostalCode)} ` : ''}${escapeHtml(invoice.companyAddress)}</p>` : ''}
      ${invoice.companyPhone ? `<p style="font-size:11px;color:#666;margin:2px 0">TEL: ${escapeHtml(invoice.companyPhone)}</p>` : ''}
      ${invoice.registrationNumber ? `<p style="font-size:11px;color:#1A2331;margin:4px 0 0 0;font-family:monospace;font-weight:bold">登録番号: ${escapeHtml(invoice.registrationNumber)}</p>` : `<p style="font-size:10px;color:#d97706;margin:4px 0 0 0">⚠️ インボイス登録番号未設定</p>`}
    </div>
  </div>

  <!-- 請求金額 大表示 -->
  <div style="background:linear-gradient(135deg,#F0F7F4,#E8F5EE);padding:24px;border-radius:12px;text-align:center;margin-bottom:32px;border:1px solid #C7E5D1">
    <p style="font-size:11px;color:#3A6B4F;margin:0 0 6px 0;letter-spacing:0.1em">ご請求金額（税込）</p>
    <p style="font-size:38px;font-weight:bold;margin:0;color:#1A2331;font-variant-numeric:tabular-nums">¥${invoice.total.toLocaleString()}</p>
  </div>

  <!-- 品目テーブル -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <thead>
      <tr style="background:#F8F9FB;border-bottom:2px solid #D8DEE6">
        <th style="padding:10px 8px;text-align:left;font-size:11px;color:#666;font-weight:600">品目 / 摘要</th>
        <th style="padding:10px 8px;text-align:right;font-size:11px;color:#666;font-weight:600;width:60px">数量</th>
        <th style="padding:10px 8px;text-align:right;font-size:11px;color:#666;font-weight:600;width:100px">単価</th>
        <th style="padding:10px 8px;text-align:center;font-size:11px;color:#666;font-weight:600;width:60px">税率</th>
        <th style="padding:10px 8px;text-align:right;font-size:11px;color:#666;font-weight:600;width:120px">金額</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
  </table>

  ${hasReducedTax ? `
  <p style="font-size:11px;color:#d97706;margin:0 0 16px 0">※ は軽減税率（8%）対象品目</p>
  ` : ''}

  <!-- 税率内訳（適格請求書必須） -->
  <div style="margin-top:8px;border-top:1px solid #D8DEE6;padding-top:12px">
    <table style="width:100%;border-collapse:collapse">
      ${taxBreakdownHTML}
      <tr style="border-top:1px solid #eee">
        <td style="padding:10px 8px;text-align:right;color:#666;font-size:13px">小計</td>
        <td style="padding:10px 8px;text-align:right;font-size:13px;font-variant-numeric:tabular-nums">¥${invoice.subtotal.toLocaleString()}</td>
        <td style="padding:10px 8px;text-align:right;color:#666;font-size:13px">消費税合計</td>
        <td style="padding:10px 8px;text-align:right;font-size:13px;font-variant-numeric:tabular-nums">¥${invoice.tax.toLocaleString()}</td>
      </tr>
      <tr style="border-top:2px solid #1A2331">
        <td colspan="3" style="padding:14px 8px;text-align:right;font-size:16px;font-weight:bold;color:#1A2331">合計（税込）</td>
        <td style="padding:14px 8px;text-align:right;font-size:20px;font-weight:bold;color:#1A2331;font-variant-numeric:tabular-nums">¥${invoice.total.toLocaleString()}</td>
      </tr>
    </table>
  </div>

  <!-- 振込先 -->
  ${invoice.bankAccount ? `
  <div style="margin-top:32px;padding:16px;background:#F8F9FB;border-radius:8px;border:1px solid #E5E7EB">
    <p style="font-size:11px;color:#999;margin:0 0 6px 0;letter-spacing:0.05em;font-weight:600">振込先</p>
    <p style="font-size:13px;color:#1A2331;margin:0;white-space:pre-wrap;line-height:1.6">${escapeHtml(invoice.bankAccount)}</p>
  </div>
  ` : ''}

  <!-- 備考 -->
  ${invoice.memo ? `
  <div style="margin-top:16px;padding:16px;background:#FEFCE8;border-radius:8px;border:1px solid #FDE68A">
    <p style="font-size:11px;color:#999;margin:0 0 6px 0;letter-spacing:0.05em;font-weight:600">備考</p>
    <p style="font-size:12px;color:#1A2331;margin:0;white-space:pre-wrap;line-height:1.6">${escapeHtml(invoice.memo)}</p>
  </div>
  ` : ''}

  <!-- 印刷ボタン（画面のみ） -->
  <div class="no-print" style="margin-top:32px;text-align:center">
    <button onclick="window.print()" style="background:#1A2331;color:#fff;border:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer">🖨 印刷 / PDFで保存</button>
    <p style="font-size:10px;color:#999;margin-top:8px">「PDFとして保存」を選ぶとPDF出力できます</p>
  </div>

  <p style="text-align:center;font-size:10px;color:#999;margin-top:24px">この請求書は適格請求書（インボイス制度）に対応しています</p>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
