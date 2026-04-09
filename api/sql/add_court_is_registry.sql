ALTER TABLE courts
  ADD COLUMN IF NOT EXISTS is_registry BOOLEAN NOT NULL DEFAULT true;

UPDATE courts SET is_registry = true WHERE is_registry IS DISTINCT FROM true;
