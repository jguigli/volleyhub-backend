-- Confrontations tournoi (moteur format-agnostique). Si synchronize=false.

DO $$
BEGIN
  CREATE TYPE tournament_fixture_status_enum AS ENUM (
    'pending',
    'ready',
    'live',
    'finished'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS tournament_fixtures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_match_id uuid NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  team_a_index integer NULL,
  team_b_index integer NULL,
  score_a integer NOT NULL DEFAULT 0,
  score_b integer NOT NULL DEFAULT 0,
  court_index integer NULL,
  status tournament_fixture_status_enum NOT NULL DEFAULT 'pending',
  depends_on_fixture_ids jsonb NULL,
  feeds_fixture_id uuid NULL,
  feeds_slot varchar(1) NULL,
  round integer NOT NULL DEFAULT 0,
  "order" integer NOT NULL DEFAULT 0,
  phase varchar(24) NULL,
  started_at timestamptz NULL,
  ended_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Run once if table already exists (confirmation flags for live scoring)
ALTER TABLE tournament_fixtures
  ADD COLUMN IF NOT EXISTS score_a_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE tournament_fixtures
  ADD COLUMN IF NOT EXISTS score_b_confirmed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tournament_fixtures_event
  ON tournament_fixtures (event_match_id);

CREATE INDEX IF NOT EXISTS idx_tournament_fixtures_event_round
  ON tournament_fixtures (event_match_id, round, "order");
