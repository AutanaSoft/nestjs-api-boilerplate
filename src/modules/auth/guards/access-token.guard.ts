import { Inject, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../../../common/auth/authenticated-principal.js';
import { PUBLIC_ROUTE } from '../../../common/auth/public.js';
import { CredentialsService } from '../../users/services/credentials.service.js';
import { SESSIONS_REPOSITORY, type SessionsRepository } from '../repositories/sessions.repository.js';

const claimsSchema = z.object({
  sub: z.uuid(),
  sid: z.uuid(),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
});

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly credentials: CredentialsService,
    @Inject(SESSIONS_REPOSITORY) private readonly sessions: SessionsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & { headers: { authorization?: string } }>();
    const authorization = request.headers.authorization;
    const match = typeof authorization === 'string' ? /^Bearer ([^\s]+)$/.exec(authorization) : null;
    if (match === null) throw new UnauthorizedException();

    let payload: unknown;
    try {
      payload = await this.jwt.verifyAsync(match[1]);
    } catch {
      throw new UnauthorizedException();
    }
    const claims = claimsSchema.safeParse(payload);
    if (!claims.success) throw new UnauthorizedException();
    const session = await this.sessions.findActive(claims.data.sid, new Date());
    if (session === null || session.userId !== claims.data.sub) throw new UnauthorizedException();
    const user = await this.credentials.findCurrent(claims.data.sub);
    if (user === null) throw new UnauthorizedException();
    request.principal = { userId: user.id, sessionId: session.id, role: user.role };
    return true;
  }
}
