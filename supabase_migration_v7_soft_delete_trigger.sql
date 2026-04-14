-- ============================================================
-- Migration v7: Soft delete trigger (updated_at 自動更新)
-- 電帳法: 訂正削除の履歴を正確に記録するため
-- ============================================================

-- updated_at を自動更新するトリガー関数
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- transactions テーブルに適用
DROP TRIGGER IF EXISTS update_timestamp ON public.transactions;
CREATE TRIGGER update_timestamp
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
