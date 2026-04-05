-- ============================================================
-- Migration v2: LINE Bot対応 + 会社情報拡張
-- Supabase SQL Editor で実行
-- ============================================================

-- ====== 1. companies テーブル拡張 ======
alter table public.companies add column if not exists industry text default '建設業';
alter table public.companies add column if not exists employee_count int default 1;
alter table public.companies add column if not exists annual_revenue text default '';
alter table public.companies add column if not exists capital_amount bigint default 0;
alter table public.companies add column if not exists owner_name text default '';
alter table public.companies add column if not exists setup_completed boolean default false;

-- UPDATE ポリシー追加
do $$ begin
  create policy "Users can update own company" on public.companies
    for update using (auth.uid() = owner_id);
exception when duplicate_object then null;
end $$;

-- ====== 2. line_users テーブル（LINE userId → company 紐付け） ======
create table if not exists public.line_users (
  id uuid default gen_random_uuid() primary key,
  line_user_id text not null unique,           -- LINE のユーザーID
  company_id uuid references public.companies(id) on delete cascade,
  display_name text default '',
  industry text default '建設業',
  onboarding_step text default 'new',          -- new / industry_asked / completed
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- line_users はサーバーサイド（service_role）からのみアクセスするのでRLS不要
-- ただしテーブルレベルでは有効にし、service_roleが全操作可能
alter table public.line_users enable row level security;

-- service_role は RLS をバイパスするので明示的なポリシーは不要
-- ブラウザクライアント（anon key）からはアクセス不可にしたいのでポリシーなし = 正しい

-- ====== 3. transactions テーブルの追加ポリシー ======
do $$ begin
  create policy "Users can delete own transactions" on public.transactions
    for delete using (
      company_id in (select id from public.companies where owner_id = auth.uid())
    );
exception when duplicate_object then null;
end $$;

-- ====== 4. pending_reviews テーブルの追加ポリシー ======
do $$ begin
  create policy "Users can insert own reviews" on public.pending_reviews
    for insert with check (
      transaction_id in (
        select t.id from public.transactions t
        join public.companies c on t.company_id = c.id
        where c.owner_id = auth.uid()
      )
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can delete own reviews" on public.pending_reviews
    for delete using (
      transaction_id in (
        select t.id from public.transactions t
        join public.companies c on t.company_id = c.id
        where c.owner_id = auth.uid()
      )
    );
exception when duplicate_object then null;
end $$;

-- ====== 5. transactions に LINE 経由の書き込みを許可するポリシー ======
-- service_role はRLSをバイパスするため、特別なポリシーは不要
-- LINE Bot は service_role key で Supabase に接続する

-- ====== 6. インデックス ======
create index if not exists idx_line_users_line_id on public.line_users(line_user_id);
create index if not exists idx_transactions_company_status on public.transactions(company_id, status);
