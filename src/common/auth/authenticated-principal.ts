import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';

/** Current persisted identity established by the global guard, independent of token claims. */
export interface AuthenticatedPrincipal {
  readonly userId: string;
  readonly sessionId: string;
  readonly role: 'user';
}

export interface AuthenticatedRequest {
  principal?: AuthenticatedPrincipal;
}

/** Extracts the guard-established principal; protected handlers never parse JWTs themselves. */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal => {
    const principal = context.switchToHttp().getRequest<AuthenticatedRequest>().principal;
    if (principal === undefined) throw new UnauthorizedException();
    return principal;
  },
);
