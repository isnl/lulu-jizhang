-- Add structured import metadata for cross-source deduplication.
-- Existing records keep empty metadata and continue to work.

ALTER TABLE records ADD COLUMN counterparty TEXT DEFAULT '';
ALTER TABLE records ADD COLUMN product TEXT DEFAULT '';
ALTER TABLE records ADD COLUMN pay_method TEXT DEFAULT '';
ALTER TABLE records ADD COLUMN source_transaction_id TEXT DEFAULT '';
ALTER TABLE records ADD COLUMN dedupe_key TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_records_dedupe_key ON records(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_records_source_transaction_id ON records(source, source_transaction_id);
CREATE INDEX IF NOT EXISTS idx_records_amount_date_type ON records(type, amount, date);
