// freee API連携ライブラリ

const FREEE_AUTH_URL = 'https://accounts.secure.freee.co.jp/public_api/authorize';
const FREEE_TOKEN_URL = 'https://accounts.secure.freee.co.jp/public_api/token';
const FREEE_API_BASE = 'https://api.freee.co.jp';

export function getFreeeClientId(): string {
  return process.env.FREEE_CLIENT_ID || '';
}

function getFreeeClientSecret(): string {
  return process.env.FREEE_CLIENT_SECRET || '';
}

export function getFreeeRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${base}/api/auth/freee/callback`;
}

// OAuth認可URL生成
export function buildFreeeAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getFreeeClientId(),
    redirect_uri: getFreeeRedirectUri(),
    response_type: 'code',
    state,
  });
  return `${FREEE_AUTH_URL}?${params.toString()}`;
}

// アクセストークン取得
export async function exchangeCodeForToken(code: string): Promise<FreeeTokenResponse> {
  const res = await fetch(FREEE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: getFreeeClientId(),
      client_secret: getFreeeClientSecret(),
      code,
      redirect_uri: getFreeeRedirectUri(),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`freee token exchange failed: ${res.status} ${err}`);
  }

  return res.json();
}

// トークンリフレッシュ
export async function refreshFreeeToken(refreshToken: string): Promise<FreeeTokenResponse> {
  const res = await fetch(FREEE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: getFreeeClientId(),
      client_secret: getFreeeClientSecret(),
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`freee token refresh failed: ${res.status}`);
  }

  return res.json();
}

// API呼び出し（自動リフレッシュ付き）
async function freeeApiCall(
  accessToken: string,
  path: string,
  params?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${FREEE_API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`freee API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

// 事業所一覧を取得
export async function getFreeeCompanies(accessToken: string): Promise<FreeeCompany[]> {
  const data = await freeeApiCall(accessToken, '/api/1/companies') as { companies: FreeeCompany[] };
  return data.companies;
}

// 取引一覧を取得（期間指定）
export async function getFreeeDeals(
  accessToken: string,
  companyId: number,
  startDate: string,
  endDate: string,
  offset = 0,
  limit = 100
): Promise<{ deals: FreeeDeal[]; meta: { total_count: number } }> {
  const data = await freeeApiCall(accessToken, '/api/1/deals', {
    company_id: String(companyId),
    start_issue_date: startDate,
    end_issue_date: endDate,
    offset: String(offset),
    limit: String(limit),
  }) as { deals: FreeeDeal[]; meta: { total_count: number } };
  return data;
}

// 勘定科目一覧を取得
export async function getFreeeAccountItems(
  accessToken: string,
  companyId: number
): Promise<FreeeAccountItem[]> {
  const data = await freeeApiCall(accessToken, '/api/1/account_items', {
    company_id: String(companyId),
  }) as { account_items: FreeeAccountItem[] };
  return data.account_items;
}

// freee取引 → 自社Transaction変換
export function convertFreeeDealToTransaction(deal: FreeeDeal): {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  categoryLabel: string;
  counterparty: string;
  externalId: string;
} {
  // freee dealは details配列を持つ。最初のdetailを使う
  const detail = deal.details?.[0];
  const amount = detail?.amount || 0;
  const type = deal.type === 'income' ? 'income' : 'expense';
  const accountName = detail?.account_item_name || '未分類';

  return {
    date: deal.issue_date,
    description: detail?.description || deal.ref_number || '',
    amount,
    type,
    category: accountName,
    categoryLabel: accountName,
    counterparty: deal.partner_name || '',
    externalId: String(deal.id),
  };
}

// === Types ===

export interface FreeeTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  created_at: number;
}

export interface FreeeCompany {
  id: number;
  name: string;
  name_kana: string;
  display_name: string;
  role: string;
}

export interface FreeeDeal {
  id: number;
  company_id: number;
  issue_date: string;
  due_date: string | null;
  type: 'income' | 'expense';
  ref_number: string;
  partner_name: string;
  amount: number;
  status: string;
  details: FreeeDealDetail[];
}

export interface FreeeDealDetail {
  id: number;
  account_item_id: number;
  account_item_name: string;
  tax_code: number;
  amount: number;
  description: string;
  vat: number;
}

export interface FreeeAccountItem {
  id: number;
  name: string;
  shortcut: string;
  default_tax_code: number;
  categories: string[];
}
