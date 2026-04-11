-- v3: freee連携 + 電子帳簿保存法対応 + 監査ログ

-- freee/マネフォ連携テーブル
create table public.external_connections (
  id uuid default gen_random_uuid() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  platform text check (platform in ('freee', 'moneyforward')) not null,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  external_company_id text, -- freee側の事業所ID
  last_synced_at timestamptz,
  sync_status text check (sync_status in ('idle', 'syncing', 'success', 'error')) default 'idle',
  sync_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(company_id, platform)
);

alter table public.external_connections enable row level security;
create policy "Users can view own connections" on public.external_connections
  for select using (
    company_id in (select id from public.companies where owner_id = auth.uid())
  );
create policy "Users can manage own connections" on public.external_connections
  for all using (
    company_id in (select id from public.companies where owner_id = auth.uid())
  );

-- 監査ログ（電子帳簿保存法: 訂正削除の履歴）
create table public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  table_name text not null,
  record_id uuid not null,
  action text check (action in ('create', 'update', 'delete')) not null,
  old_values jsonb,
  new_values jsonb,
  changed_by text, -- user_id or 'system' or 'ai'
  created_at timestamptz default now()
);

alter table public.audit_logs enable row level security;
create policy "Users can view own audit logs" on public.audit_logs
  for select using (
    company_id in (select id from public.companies where owner_id = auth.uid())
  );

create index idx_audit_logs_record on public.audit_logs(table_name, record_id);
create index idx_audit_logs_company_date on public.audit_logs(company_id, created_at desc);

-- transactionsテーブルにsoft delete + 電帳法カラム追加
alter table public.transactions add column if not exists deleted_at timestamptz;
alter table public.transactions add column if not exists external_id text; -- freee側の取引ID
alter table public.transactions add column if not exists synced_from text; -- 'freee' | 'moneyforward' | null

-- companiesテーブルに追加情報
alter table public.companies add column if not exists owner_name text;
alter table public.companies add column if not exists industry text;
alter table public.companies add column if not exists employee_count int;
alter table public.companies add column if not exists annual_revenue text;
alter table public.companies add column if not exists capital_amount bigint;
alter table public.companies add column if not exists setup_completed boolean default false;
