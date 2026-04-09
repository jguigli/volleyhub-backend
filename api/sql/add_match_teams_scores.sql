-- Équipes (0 = A, 1 = B) et scores finaux pour les matchs simples.
-- À exécuter si synchronize=false en production.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS team_a_score integer NULL,
  ADD COLUMN IF NOT EXISTS team_b_score integer NULL,
  ADD COLUMN IF NOT EXISTS set_scores jsonb NULL;

ALTER TABLE match_participants
  ADD COLUMN IF NOT EXISTS team_index integer NULL;

COMMENT ON COLUMN match_participants.team_index IS '0 équipe A, 1 équipe B, NULL non assigné';
