import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class FindCourtsDto {
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
  radius?: number; // in meters, default 5000

  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return value === true || value === 'true';
  })
  @IsBoolean()
  @IsOptional()
  /** Si true : seulement les complexes / terrains du référentiel (point bleu sur la carte) */
  registryOnly?: boolean;
}
