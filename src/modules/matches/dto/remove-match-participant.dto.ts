import { IsUUID } from 'class-validator';

export class RemoveMatchParticipantDto {
  @IsUUID()
  userId!: string;
}
