import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Allows access only to users with isAdmin === true.
 * Must be used AFTER JwtAuthGuard (needs req.user to be set).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ user?: { isAdmin?: boolean } }>();
    if (!req.user?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
