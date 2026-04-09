-- Chat de groupe + scores tournoi (si synchronize=false en production).

CREATE TABLE IF NOT EXISTS match_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  body varchar(2000) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_chat_messages_match_created
  ON match_chat_messages (match_id, created_at DESC);

CREATE TABLE IF NOT EXISTS match_chat_mutes (
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  muted_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, muted_user_id)
);

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS tournament_games jsonb NULL;
