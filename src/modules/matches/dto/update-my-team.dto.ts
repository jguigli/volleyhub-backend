import { IsInt, IsOptional } from "class-validator";
import { Type } from "class-transformer";

export class UpdateMyTeamDto {
  @IsOptional()
  @Type(() => Number)
  teamIndex!: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  slotIndex?: number | null;
}
