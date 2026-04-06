ALTER TABLE users
  ADD COLUMN IF NOT EXISTS initial_backfill_done_at TIMESTAMPTZ;
