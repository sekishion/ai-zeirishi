-- ============================================================
-- Migration v5: 請求書（適格請求書）対応
-- companies に発行者情報、partnersテーブル新設
-- ============================================================

-- companies に発行者情報カラム追加
alter table public.companies add column if not exists address text default '';
alter table public.companies add column if not exists phone text default '';
alter table public.companies add column if not exists invoice_registration_number text default '';  -- T+13桁
alter table public.companies add column if not exists bank_account text default '';                  -- 振込先（自由記述）
alter table public.companies add column if not exists representative_name text default '';
alter table public.companies add column if not exists postal_code text default '';

-- 取引先マスタ（次回から自動入力）
create table if not exists public.partners (
  id uuid default gen_random_uuid() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  name text not null,
  postal_code text default '',
  address text default '',
  phone text default '',
  invoice_registration_number text default '',  -- 取引先の登録番号
  is_individual boolean default false,           -- 個人事業主か（源泉徴収判定用）
  notes text default '',
  use_count int not null default 0,
  last_used date default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(company_id, name)
);

alter table public.partners enable row level security;
create index if not exists idx_partners_company on public.partners(company_id, name);

-- 請求書履歴
create table if not exists public.invoices (
  id uuid default gen_random_uuid() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  invoice_no text not null,                        -- INV-20260412-001
  partner_id uuid references public.partners(id),
  partner_name text not null,
  partner_address text default '',
  partner_registration_number text default '',
  issue_date date not null,
  due_date date not null,
  items jsonb not null default '[]',                -- [{name, quantity, unitPrice, taxRate, priceMode, isReducedTax}]
  subtotal_10 bigint not null default 0,
  subtotal_8 bigint not null default 0,
  tax_10 bigint not null default 0,
  tax_8 bigint not null default 0,
  subtotal bigint not null default 0,
  tax bigint not null default 0,
  total bigint not null,
  withholding_tax bigint default 0,                 -- 源泉徴収額
  bank_account text default '',
  memo text default '',
  status text check (status in ('draft', 'sent', 'paid')) default 'sent',
  pdf_url text,
  created_at timestamptz default now(),
  unique(company_id, invoice_no)
);

alter table public.invoices enable row level security;
create index if not exists idx_invoices_company_date on public.invoices(company_id, issue_date desc);
