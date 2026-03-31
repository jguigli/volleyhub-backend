import { IsUUID } from 'class-validator';

export class InvitePlayerDto {
  @IsUUID()
  userId!: string;
}

