import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { SkillLevel, Position } from '../../../common/enums';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  @Matches(/\d/, { message: 'Password must contain at least one digit' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Password must contain at least one special character' })
  password: string;

  @IsEnum(SkillLevel)
  @IsOptional()
  skillLevel?: SkillLevel;

  @IsEnum(Position)
  @IsOptional()
  position?: Position;
}
