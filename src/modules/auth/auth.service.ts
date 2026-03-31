import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { User } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<{ accessToken: string; user: Partial<User> }> {
    const existing = await this.userRepo.findOne({
      where: [{ email: dto.email }, { username: dto.username }],
    });

    if (existing) {
      throw new ConflictException('Email or username already in use');
    }

    const passwordHash = await hash(dto.password, 12);

    const user = this.userRepo.create({
      username: dto.username,
      email: dto.email,
      passwordHash,
      skillLevel: dto.skillLevel,
      position: dto.position,
    });

    const saved = await this.userRepo.save(user);
    const accessToken = this.jwtService.sign({ sub: saved.id, email: saved.email });

    return {
      accessToken,
      user: this.sanitize(saved),
    };
  }

  async login(
    dto: LoginDto,
  ): Promise<{ accessToken: string; user: Partial<User> }> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });

    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.jwtService.sign({ sub: user.id, email: user.email });

    return {
      accessToken,
      user: this.sanitize(user),
    };
  }

  private sanitize(user: User): Partial<User> {
    const { passwordHash: _ph, ...rest } = user;
    return rest;
  }
}
