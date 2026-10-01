import { createHash, randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { expect, it } from 'vitest';
import authConfig from '../../../src/config/auth.config.js';
import { buildHttpConfig } from '../../../src/config/http.config.js';
import { buildRateLimitConfig } from '../../../src/config/rate-limit.config.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import type { E2ESuiteRegistration } from '../../support/e2e-context.js';

export function registerSignInE2ESuite({ runScenario }: E2ESuiteRegistration): void {
  const options = {
    application: {
      httpConfig: buildHttpConfig({ TRUST_PROXY_HOPS: 1 }),
      rateLimitConfig: buildRateLimitConfig({ THROTTLE_LIMIT: 100, THROTTLE_TTL_SECONDS: 60 }),
    },
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

  it('allows 10 sign-ins per trusted client IP, blocks the 11th, and leaves refresh unthrottled by Auth limits', async () => {
    await runScenario(async ({ app }) => {
      const clientA = '198.51.100.31';
      const clientB = '198.51.100.32';
      const email = `${randomUUID()}@example.test`;
      const password = 'twelve characters';
      const registration = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-up')
        .set('X-Forwarded-For', clientA)
        .send({ email, displayName: 'Ada Lovelace', password })
        .expect(201);
      const signIn = (ip: string) =>
        request(app.getHttpServer()).post('/api/v1/auth/sign-in').set('X-Forwarded-For', ip).send({ email, password });

      for (let attempt = 0; attempt < 10; attempt += 1) {
        await signIn(clientA).expect(200);
      }

      const blocked = await signIn(clientA).expect(429);
      expect(blocked.body).toEqual({
        statusCode: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests.',
        requestId: blocked.headers['x-request-id'],
      });
      expect(blocked.headers['x-request-id']).toEqual(expect.any(String));
      await signIn(clientB).expect(200);

      let refreshToken = registration.body.refreshToken as string;
      for (let attempt = 0; attempt < 11; attempt += 1) {
        const refreshed = await request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .set('X-Forwarded-For', clientA)
          .send({ refreshToken })
          .expect(200);
        refreshToken = refreshed.body.refreshToken as string;
      }
    }, options);
  });

  it('applies the global per-handler limit to sign-in before the named sign-in limit', async () => {
    const clientIp = '198.51.100.33';
    const email = `${randomUUID()}@example.test`;
    const password = 'twelve characters';
    await runScenario(
      async ({ app }) => {
        await request(app.getHttpServer())
          .post('/api/v1/auth/sign-up')
          .set('X-Forwarded-For', clientIp)
          .send({ email, displayName: 'Ada Lovelace', password })
          .expect(201);

        const signIn = () =>
          request(app.getHttpServer())
            .post('/api/v1/auth/sign-in')
            .set('X-Forwarded-For', clientIp)
            .send({ email, password });

        await signIn().expect(200);
        await signIn().expect(200);
        const blocked = await signIn().expect(429);
        expect(blocked.body).toEqual({
          statusCode: 429,
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests.',
          requestId: blocked.headers['x-request-id'],
        });
        expect(blocked.headers['x-request-id']).toEqual(expect.any(String));
      },
      {
        application: {
          httpConfig: buildHttpConfig({ TRUST_PROXY_HOPS: 1 }),
          rateLimitConfig: buildRateLimitConfig({ THROTTLE_LIMIT: 2, THROTTLE_TTL_SECONDS: 60 }),
        },
      },
    );
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
