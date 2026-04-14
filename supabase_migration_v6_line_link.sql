-- ============================================================
-- Migration v6: LINE ↔ Web アカウント連携
-- ============================================================

-- line_users に連携コード（6桁、5分有効）
alter table public.line_users add column if not exists link_code text;
alter table public.line_users add column if not exists link_code_expires_at timestamptz;

DROP INDEX IF EXISTS idx_line_users_link_code;
CREATE UNIQUE INDEX IF NOT EXISTS idx_line_users_link_code_unique ON public.line_users(link_code) WHERE link_code IS NOT NULL;
