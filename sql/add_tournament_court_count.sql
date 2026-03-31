ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS tournament_court_count integer NULL;

COMMENT ON COLUMN matches.tournament_court_count IS 'Tournoi : nombre de terrains (matchs en parallèle)';
