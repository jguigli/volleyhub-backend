import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** JWT si présent, sinon la requête continue sans `user` (pour profils publics enrichis). */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers?: { authorization?: string };
    }>();
    const auth = req.headers?.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return true;
    }
    try {
      return (await super.canActivate(context)) as boolean;
    } catch {
      return true;
    }
  }

  handleRequest<TUser>(err: Error | null, user: TUser): TUser {
    return user;
  }
}
