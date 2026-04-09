import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { SkillLevel } from '../../../common/enums';

export class FindMatchesDto {
  @Transform(({ value }: { value: string }) => parseFloat(value))
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  lat?: number;

  @Transform(({ value }: { value: string }) => parseFloat(value))
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  lng?: number;

  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsNumber()
  @IsOptional()
  radius?: number; // meters, default 10000

  @IsEnum(SkillLevel)
  @IsOptional()
  skillLevel?: SkillLevel;
}
