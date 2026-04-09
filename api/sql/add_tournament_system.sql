-- Système de tournoi (bracket, poules + finale, round-robin). À appliquer si synchronize est désactivé.

DO $$
BEGIN
  CREATE TYPE tournament_system_enum AS ENUM (
    'single_elimination',
    'pools_finals',
    'round_robin'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS tournament_system tournament_system_enum NULL;

COMMENT ON COLUMN matches.tournament_system IS 'Tournoi : élimination directe, poules+finale ou round-robin';
