import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcryptjs';
import { randomInt } from 'crypto';
import { User } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  private readonly bcryptRounds: number;
  private readonly refreshExpiresIn: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this.bcryptRounds = this.config.get<number>('app.bcryptRounds') ?? 12;
    this.refreshExpiresIn =
      this.config.get<string>('app.refreshTokenExpiresIn') ?? '7d';
  }

  async register(
    dto: RegisterDto,
  ): Promise<{ accessToken: string; refreshToken: string; user: Partial<User> }> {
    // Case-insensitive check on both email and username
    const existing = await this.userRepo.findOne({
      where: [
        { email: ILike(dto.email) },
        { username: ILike(dto.username) },
      ],
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
    const user = await this.userRepo.findOne({
      where: { email: ILike(dto.email) },
    });

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

  /**
   * Generate a 6-digit code using cryptographically secure randomness.
   * Uses crypto.randomInt() (not Math.random) to prevent prediction.
   * Range: 100000-999999 (always 6 digits, never starts with 0).
   */
  private generateSecureCode(): string {
    const code = randomInt(100000, 1000000);
    return String(code);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { email: ILike(email) },
    });
    // Silently return if user not found (prevent email enumeration)
    if (!user) {
      return;
    }
    const code = this.generateSecureCode();
    // Hash the code with bcrypt before storing — like a password.
    // Even if the DB is compromised, codes cannot be reverse-engineered.
    const codeHash = await hash(code, this.bcryptRounds);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    user.passwordResetToken = codeHash;
    user.passwordResetExpiresAt = expiresAt;
    await this.userRepo.save(user);
    // Email the plaintext code (only place it ever exists in clear)
    await this.emailService.sendPasswordResetEmail(
      user.email,
      user.username,
      code,
    );
  }

  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    if (!email || !code || newPassword.length < 8) {
      throw new BadRequestException('Invalid input');
    }
    const user = await this.userRepo.findOne({
      where: { email: ILike(email) },
    });
    if (
      !user ||
      !user.passwordResetToken ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired code');
    }
    // Timing-safe comparison via bcrypt.compare
    const isValid = await compare(code, user.passwordResetToken);
    if (!isValid) {
      throw new BadRequestException('Invalid or expired code');
    }
    user.passwordHash = await hash(newPassword, this.bcryptRounds);
    user.passwordResetToken = null;
    user.passwordResetExpiresAt = null;
    await this.userRepo.save(user);
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
