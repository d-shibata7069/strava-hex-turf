-- Ensure groups.invite_code has a UNIQUE constraint (idempotent).
-- Initial schema already defines invite_code as UNIQUE; this migration ensures
-- the constraint exists for any environment where it might be missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid
      AND a.attnum = ANY(c.conkey)
      AND NOT a.attisdropped
    WHERE t.relname = 'groups'
      AND c.contype = 'u'
      AND a.attname = 'invite_code'
  ) THEN
    ALTER TABLE groups
      ADD CONSTRAINT groups_invite_code_unique UNIQUE (invite_code);
  END IF;
END $$;
