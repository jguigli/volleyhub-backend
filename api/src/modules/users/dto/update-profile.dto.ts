import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { SkillLevel, Position, League } from '../../../common/enums';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  username?: string;

  @IsEnum(SkillLevel)
  @IsOptional()
  skillLevel?: SkillLevel;

  @IsEnum(Position)
  @IsOptional()
  position?: Position;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  club?: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  competition?: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsEnum(League)
  league?: League | null;

  @IsOptional()
  @IsString()
  @MaxLength(4_000_000)
  profilePicture?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsString()
  @IsOptional()
  fcmToken?: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  lat?: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  lng?: number;
}
