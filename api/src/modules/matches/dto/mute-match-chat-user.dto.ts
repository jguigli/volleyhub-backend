import { IsUUID } from 'class-validator';

export class MuteMatchChatUserDto {
  @IsUUID()
  userId!: string;
}
