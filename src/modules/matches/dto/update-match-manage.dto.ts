import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SetScoreDto {
  @IsInt()
  @Min(0)
  @Max(999)
  teamA: number;

  @IsInt()
  @Min(0)
  @Max(999)
  teamB: number;
}

/** Rencontres entre équipes du tournoi (indices 0 … teamCount-1 ; -1 = à déterminer). */
export class TournamentGameDto {
  @IsOptional()
  @IsUUID()
  fixtureId?: string;

  @IsInt()
  @Min(-1)
  @Max(31)
  teamAIndex: number;

  @IsInt()
  @Min(-1)
  @Max(31)
  teamBIndex: number;

  @IsInt()
  @Min(0)
  @Max(999)
  scoreA: number;

  @IsInt()
  @Min(0)
  @Max(999)
  scoreB: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  courtIndex?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  round?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

/**
 * Mise à jour par l’organisateur : équipes (index 0 / 1) et score par set.
 * Champs absents = pas de changement ; null = effacer le score / retirer l’assignation.
 */
export class UpdateMatchManageDto {
  @IsOptional()
  @IsObject()
  teamAssignments?: Record<string, number | null>;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SetScoreDto)
  setScores?: SetScoreDto[] | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TournamentGameDto)
  tournamentGames?: TournamentGameDto[] | null;

  // --- Tournament settings (only when event is upcoming) ---

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  tournamentPointsPerMatch?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  tournamentCourtCount?: number;

  @IsOptional()
  @IsString()
  @IsIn(['single_elimination', 'pools_finals', 'round_robin'])
  tournamentSystem?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(32)
  teamCount?: number;

  /** List of team indices to remove when reducing teamCount */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  removedTeamIndices?: number[];

  // --- Volley type (both match and tournament, only when upcoming) ---

  @IsOptional()
  @IsString()
  @IsIn(["classic", "beach", "green"])
  volleyType?: string;

  // --- Match settings (only when event is upcoming) ---

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(96)
  maxPlayers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  matchSets?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  pointsToWin?: number;

  // --- Early start ---

  @IsOptional()
  startNow?: boolean;
}
