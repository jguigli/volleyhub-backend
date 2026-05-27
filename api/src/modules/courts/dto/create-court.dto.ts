import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { CourtType } from '../court.entity';

export class CreateCourtDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(CourtType)
  type: CourtType;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/, {
    message: 'countryCode must be a 2-letter ISO 3166-1 alpha-2 code (uppercase)',
  })
  countryCode?: string;
}
