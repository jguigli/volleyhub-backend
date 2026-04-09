-- Demandes de connexion (acceptées → ligne dans `follows`)
CREATE TABLE IF NOT EXISTS follow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT follow_requests_unique_pair UNIQUE (requester_id, target_id),
  CONSTRAINT follow_requests_no_self CHECK (requester_id <> target_id)
);

CREATE INDEX IF NOT EXISTS idx_follow_requests_target ON follow_requests(target_id);
