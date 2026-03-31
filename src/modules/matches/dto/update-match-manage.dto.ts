import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
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
}
