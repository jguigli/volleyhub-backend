export enum SkillLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

export enum Position {
  SETTER = 'setter',
  LIBERO = 'libero',
  OUTSIDE_HITTER = 'outside_hitter',
  OPPOSITE_HITTER = 'opposite_hitter',
  MIDDLE_BLOCKER = 'middle_blocker',
  ANY = 'any',
}

export enum League {
  DEPARTMENTAL = 'departmental',
  REGIONAL = 'regional',
  PRE_NATIONAL = 'pre_national',
  NATIONAL = 'national',
  PROFESSIONAL = 'professional',
}

export enum VolleyType {
  CLASSIC = 'classic',
  BEACH = 'beach',
  GREEN = 'green',
}

export enum EventFormat {
  MATCH = 'match',
  TOURNAMENT = 'tournament',
}

/** Format de compétition (tournoi) — base pour la gestion live (scores, terrains…). */
export enum TournamentSystem {
  /** Tableau à élimination directe (type Roland-Garros). */
  SINGLE_ELIMINATION = 'single_elimination',
  /** Poules puis phase finale. */
  POOLS_FINALS = 'pools_finals',
  /** Chaque équipe rencontre toutes les autres. */
  ROUND_ROBIN = 'round_robin',
}
