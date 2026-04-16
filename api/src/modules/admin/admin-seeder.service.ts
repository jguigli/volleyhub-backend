import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash } from 'bcryptjs';
import { User } from '../users/user.entity';

/**
 * Idempotently creates (or updates) the admin account at application boot.
 *
 * Requires ADMIN_SEED_EMAIL + ADMIN_SEED_PASSWORD env vars. If missing,
 * the seeder logs a warning and skips (no crash, allows fresh installs
 * where the admin doesn't care yet).
 *
 * The account is marked with is_admin = true and is hidden from all
 * public endpoints (search, profile, followers, etc.).
 */
@Injectable()
export class AdminSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeederService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.get<string>('app.admin.email');
    const password = this.config.get<string>('app.admin.password');
    const username = this.config.get<string>('app.admin.username') ?? 'admin';

    if (!email || !password) {
      this.logger.warn(
        'ADMIN_SEED_EMAIL or ADMIN_SEED_PASSWORD missing — admin seed skipped',
      );
      return;
    }

    const bcryptRounds = this.config.get<number>('app.bcryptRounds') ?? 12;

    try {
      const existing = await this.userRepo.findOne({
        where: { email },
      });

      if (existing) {
        // Ensure the existing account keeps the admin flag
        if (!existing.isAdmin) {
          existing.isAdmin = true;
          await this.userRepo.save(existing);
          this.logger.log(`Admin flag set on existing user ${email}`);
        } else {
          this.logger.log(`Admin account ${email} already exists`);
        }
        return;
      }

      const passwordHash = await hash(password, bcryptRounds);
      const admin = this.userRepo.create({
        username,
        email,
        passwordHash,
        skillLevel: 'intermediate' as any,
        position: 'any' as any,
        isAdmin: true,
      });
      await this.userRepo.save(admin);
      this.logger.log(`Admin account created: ${email}`);
    } catch (err) {
      this.logger.error(
        `Failed to seed admin account: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
