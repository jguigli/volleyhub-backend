import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcryptjs';
import { User } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly bcryptRounds: number;
  private readonly refreshExpiresIn: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.bcryptRounds = this.config.get<number>('app.bcryptRounds') ?? 12;
    this.refreshExpiresIn =
      this.config.get<string>('app.refreshTokenExpiresIn') ?? '7d';
  }

  async register(
    dto: RegisterDto,
  ): Promise<{ accessToken: string; refreshToken: string; user: Partial<User> }> {
    const existing = await this.userRepo.findOne({
      where: [{ email: dto.email }, { username: dto.username }],
    });

    if (existing) {
      throw new ConflictException('Email or username already in use');
    }

    const passwordHash = await hash(dto.password, this.bcryptRounds);

    const user = this.userRepo.create({
      username: dto.username,
      email: dto.email,
      passwordHash,
      skillLevel: dto.skillLevel,
      position: dto.position,
    });

    const saved = await this.userRepo.save(user);

    return {
      ...this.generateTokens(saved),
      user: this.sanitize(saved),
    };
  }

  async login(
    dto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string; user: Partial<User> }> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });

    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      ...this.generateTokens(user),
      user: this.sanitize(user),
    };
  }

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify<{
        sub: string;
        type?: string;
      }>(refreshToken);

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.userRepo.findOne({
        where: { id: payload.sub },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private generateTokens(user: User): {
    accessToken: string;
    refreshToken: string;
  } {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      type: 'access',
    });
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: this.refreshExpiresIn },
    );
    return { accessToken, refreshToken };
  }

  private sanitize(user: User): Partial<User> {
    const { passwordHash: _ph, ...rest } = user;
    return rest;
  }
}
