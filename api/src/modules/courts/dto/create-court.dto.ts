import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
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
}
