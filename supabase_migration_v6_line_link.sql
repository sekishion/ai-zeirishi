-- ============================================================
-- Migration v6: LINE ↔ Web アカウント連携
-- ============================================================

-- line_users に連携コード（6桁、5分有効）
alter table public.line_users add column if not exists link_code text;
alter table public.line_users add column if not exists link_code_expires_at timestamptz;

create index if not exists idx_line_users_link_code on public.line_users(link_code) where link_code is not null;
