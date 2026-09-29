import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { AccessTokenGuard } from './access-token.guard.js';
import type { ExecutionContext } from '@nestjs/common';
import type { SessionsRepository } from '../repositories/sessions.repository.js';
import type { CredentialsService } from '../../users/services/credentials.service.js';
import type { AuthenticatedRequest } from '../../../common/auth/authenticated-principal.js';

const userId = '123e4567-e89b-42d3-a456-426614174000';
const sessionId = '123e4567-e89b-42d3-a456-426614174001';

function setup() {
  const jwt = new JwtService({ secret: 'test-only-signing-key' });
  const request: AuthenticatedRequest & { headers: { authorization: string } } = {
    headers: {
      authorization: `Bearer ${jwt.sign({ sub: userId, sid: sessionId, exp: Math.floor(Date.now() / 1000) + 60 })}`,
    },
  };
  const context = {
    getHandler: () => () => undefined,
    getClass: () => class Protected {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const session = { id: sessionId, userId, expiresAt: new Date(Date.now() + 1000), revokedAt: null };
  const sessions = { findActive: vi.fn().mockResolvedValue(session) };
  const credentials = { findCurrent: vi.fn().mockResolvedValue({ id: userId, role: 'user' }) };
  const guard = new AccessTokenGuard(
    new Reflector(),
    jwt,
    credentials as unknown as CredentialsService,
    sessions as unknown as SessionsRepository,
  );
  return { jwt, request, context, sessions, credentials, guard };
}

describe('AccessTokenGuard', () => {
  it('installs only persisted current identity, not role claims', async () => {
    const { jwt, request, context, guard } = setup();
    request.headers.authorization = `Bearer ${jwt.sign({ sub: userId, sid: sessionId, role: 'admin', exp: Math.floor(Date.now() / 1000) + 60 })}`;
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.principal).toEqual({ userId, sessionId, role: 'user' });
  });

  it('rejects an absent persisted user even when a matching active session exists', async () => {
    const { context, credentials, guard } = setup();
    credentials.findCurrent.mockResolvedValue(null);
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a session belonging to another user before looking up user state', async () => {
    const { context, sessions, credentials, guard } = setup();
    sessions.findActive.mockResolvedValue({ id: sessionId, userId: 'another-user' });
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 });
    expect(credentials.findCurrent).not.toHaveBeenCalled();
  });
});
