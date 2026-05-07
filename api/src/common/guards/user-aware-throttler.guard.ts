import { Inject, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * Custom throttler that uses the authenticated user's id as the tracking key
 * instead of the request IP, with IP as a fallback for unauthenticated routes.
 *
 * Why: rate limiting purely by IP is broken on mobile networks where many users
 * share the same NAT'd public IP via their carrier (4G/5G), causing legitimate
 * users to receive 429 errors triggered by other users' traffic.
 *
 * Note: this guard runs BEFORE JwtAuthGuard (it's a global guard), so we cannot
 * rely on `req.user` being populated. We parse the JWT token directly from the
 * Authorization header. If parsing fails, we fall back to IP — that's fine for
 * the few unauthenticated routes (login, register, etc.).
 */
@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  constructor(
    @Inject('THROTTLER:MODULE_OPTIONS') options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = this.extractUserIdFromAuthHeader(req);
    if (userId) {
      return `user:${userId}`;
    }
    return `ip:${req?.ip ?? 'unknown'}`;
  }

  private extractUserIdFromAuthHeader(req: Record<string, any>): string | null {
    const header: string | undefined =
      req?.headers?.authorization ?? req?.headers?.Authorization;
    if (!header || typeof header !== 'string') return null;
    const m = /^Bearer\s+(.+)$/i.exec(header);
    if (!m) return null;
    try {
      const payload = this.jwt.verify<{ sub?: string }>(m[1], {
        secret: this.config.get<string>('app.jwtSecret'),
      });
      return payload?.sub ?? null;
    } catch {
      return null;
    }
  }
}
