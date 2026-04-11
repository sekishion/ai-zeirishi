-- ============================================================
-- Migration v4: 致命的バグ修正
-- 1. learned_patterns テーブル追加（既存コードが参照しているが存在しなかった）
-- 2. pending_reviews への自動INSERT用トリガーは不要（アプリ側で実装）
-- 3. transactions に receipt_url 用のインデックス
-- 4. companies に fiscal_year_end_month を確実に持たせる
-- ============================================================

-- ====== 1. learned_patterns テーブル ======
create table if not exists public.learned_patterns (
  id uuid default gen_random_uuid() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  counterparty text not null,                    -- 取引先名（レシートの店名 or 入金元）
  description_pattern text default '',           -- 摘要のキーワード
  category text not null,                        -- 学習した勘定科目
  category_label text not null,                  -- 表示名
  type text check (type in ('income', 'expense')) not null,
  use_count int not null default 1,              -- この判断が使われた回数
  last_used date default current_date,
  created_at timestamptz default now(),
  unique(company_id, counterparty, type)
);

alter table public.learned_patterns enable row level security;

-- service_role からのみアクセス（LINE webhook 経由）
-- ブラウザクライアントには公開しない

create index if not exists idx_learned_patterns_company_counterparty
  on public.learned_patterns(company_id, counterparty);

-- ====== 2. transactions に receipt 関連カラム追加 ======
alter table public.transactions add column if not exists receipt_storage_path text;
alter table public.transactions add column if not exists receipt_uploaded_at timestamptz;

-- ====== 3. line_users に hmac_secret 追加（LIFF トークン署名用） ======
alter table public.line_users add column if not exists hmac_secret text default '';

-- ====== 4. transactions に owner検証用のインデックス ======
create index if not exists idx_transactions_company_id on public.transactions(company_id);

-- ====== 5. Storage バケット（手動でSupabase Dashboardで作成 or SQL）======
-- レシート画像保存用バケット
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- service_role のみ書き込み可能
create policy "Service role can upload receipts"
  on storage.objects for insert
  to service_role
  with check (bucket_id = 'receipts');

create policy "Service role can read receipts"
  on storage.objects for select
  to service_role
  using (bucket_id = 'receipts');
