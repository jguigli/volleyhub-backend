import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  EventFormat,
  SkillLevel,
  TournamentSystem,
  VolleyType,
} from '../../../common/enums';

export class CreateMatchDto {
  @IsUUID()
  courtId: string;

  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(48)
  maxPlayers?: number;

  @IsEnum(SkillLevel)
  skillLevel: SkillLevel;

  @IsEnum(VolleyType)
  volleyType: VolleyType;

  @IsOptional()
  @IsEnum(EventFormat)
  eventFormat?: EventFormat;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(32)
  teamCount?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(12)
  teamSize?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(5)
  matchSets?: number;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(25)
  pointsToWin?: number;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(25)
  tournamentPointsPerMatch?: number;

  /** Tournoi : nombre de terrains (matchs parallèles). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  tournamentCourtCount?: number;

  /** Tournoi : système de compétition (bracket, poules, round-robin). */
  @IsOptional()
  @IsEnum(TournamentSystem)
  tournamentSystem?: TournamentSystem;

  @IsOptional()
  @IsIn(['point_sec', 'two_point_gap'])
  scoringRule?: 'point_sec' | 'two_point_gap';

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  description?: string;
}
