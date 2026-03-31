-- Remove map-pin / ad-hoc courts and dependent rows (run once against your DB).
-- Matches: names created by the app were "Custom Spot …" or "Pinned Spot …".

DELETE FROM match_participants mp
USING matches m
WHERE mp.match_id = m.id
  AND m.court_id IN (
    SELECT id FROM courts
    WHERE name ILIKE 'Custom Spot%' OR name ILIKE 'Pinned Spot%'
  );

DELETE FROM matches
WHERE court_id IN (
  SELECT id FROM courts
  WHERE name ILIKE 'Custom Spot%' OR name ILIKE 'Pinned Spot%'
);

DELETE FROM courts
WHERE name ILIKE 'Custom Spot%' OR name ILIKE 'Pinned Spot%';
