import { IsInt, Min } from 'class-validator';

export class SubmitFixtureScoreDto {
  @IsInt()
  @Min(0)
  score!: number;
}
