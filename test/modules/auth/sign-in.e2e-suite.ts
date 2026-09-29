import { createHash, randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { expect, it } from 'vitest';
import authConfig from '../../../src/config/auth.config.js';
import { buildRateLimitConfig } from '../../../src/config/rate-limit.config.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import type { E2ESuiteRegistration } from '../../support/e2e-context.js';

export function registerSignInE2ESuite({ runScenario }: E2ESuiteRegistration): void {
  const options = {
    application: { rateLimitConfig: buildRateLimitConfig({ THROTTLE_LIMIT: 100, THROTTLE_TTL_SECONDS: 60 }) },
  };
  it('signs in with normalized email and raw password, persisting a new session without exposing user data', async () => {
    await runScenario(async ({ app }) => {
      const email = `${randomUUID()}@example.test`;
      const password = '  twelve characters  ';
      await request(app.getHttpServer())
        .post('/api/v1/auth/sign-up')
        .send({ email, displayName: 'Ada Lovelace', password })
        .expect(201);
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-in')
        .send({ email: ` ${email.toUpperCase()} `, password })
        .expect(200);
      expect(Object.keys(response.body).sort()).toEqual([
        'accessToken',
        'expiresAt',
        'refreshExpiresAt',
        'refreshToken',
      ]);
      expect(response.headers).not.toHaveProperty('location');
      const prisma = app.get(PrismaService);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      const claims = await new JwtService({ secret: app.get(authConfig.KEY).jwtSecret }).verifyAsync<{
        sub: string;
        sid: string;
        exp: number;
      }>(response.body.accessToken);
      const session = await prisma.session.findUniqueOrThrow({ where: { id: claims.sid }, include: { digests: true } });
      expect(claims.sub).toBe(user.id);
      expect(claims.exp).toBe(new Date(response.body.expiresAt).getTime() / 1000);
      expect(session.userId).toBe(user.id);
      expect(session.expiresAt.toISOString()).toBe(response.body.refreshExpiresAt);
      expect(session.digests).toHaveLength(1);
      expect(session.digests[0].digest).toBe(createHash('sha256').update(response.body.refreshToken).digest('hex'));
      expect(JSON.stringify(response.body)).not.toContain(user.passwordHash);
    }, options);
  });

  it('returns identical invalid credentials for unknown email and incorrect password', async () => {
    await runScenario(async ({ app }) => {
      const email = `${randomUUID()}@example.test`;
      await request(app.getHttpServer())
        .post('/api/v1/auth/sign-up')
        .send({ email, displayName: 'Ada Lovelace', password: 'twelve characters' })
        .expect(201);
      const wrong = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-in')
        .send({ email, password: 'wrong' })
        .expect(401);
      const missing = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-in')
        .send({ email: `${randomUUID()}@example.test`, password: 'wrong' })
        .expect(401);
      for (const response of [wrong, missing]) {
        expect(response.body).toEqual({
          statusCode: 401,
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
          requestId: response.headers['x-request-id'],
        });
      }
    }, options);
  });

  it('rejects malformed, missing and extra fields but accepts a nonempty short password for verification', async () => {
    await runScenario(async ({ app }) => {
      const email = `${randomUUID()}@example.test`;
      for (const body of [
        { email },
        { password: 'short' },
        { email, password: '' },
        { email, password: 'short', role: 'admin' },
        { email: 'invalid', password: 'short' },
        { email, password: null },
      ]) {
        const response = await request(app.getHttpServer()).post('/api/v1/auth/sign-in').send(body).expect(400);
        expect(response.body.code).toBe('BAD_REQUEST');
      }
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-in')
        .send({ email, password: 'short' })
        .expect(401);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    }, options);
  });
}
