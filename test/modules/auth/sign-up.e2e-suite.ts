import { createHash, randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import authConfig from '../../../src/config/auth.config.js';
import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { StructuredLoggerService } from '../../../src/common/observability/logging/logger.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { buildHttpConfig } from '../../../src/config/http.config.js';
import { buildRateLimitConfig } from '../../../src/config/rate-limit.config.js';
import type { E2ESuiteRegistration } from '../../support/e2e-context.js';

export function registerSignUpE2ESuite({ runScenario }: E2ESuiteRegistration): void {
  const options = {
    application: {
      httpConfig: buildHttpConfig({ TRUST_PROXY_HOPS: 1 }),
      rateLimitConfig: buildRateLimitConfig({ THROTTLE_LIMIT: 100, THROTTLE_TTL_SECONDS: 60 }),
    },
  };
  it('registers a normalized Argon2id user with only tokens and a persisted session', async () => {
    await runScenario(async ({ app }) => {
      const prisma = app.get(PrismaService);
      const email = `${randomUUID()}@example.test`;
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-up')
        .send({ email: ` ${email.toUpperCase()} `, displayName: ' Ada Lovelace ', password: '  twelve characters  ' })
        .expect(201);
      expect(Object.keys(response.body).sort()).toEqual([
        'accessToken',
        'expiresAt',
        'refreshExpiresAt',
        'refreshToken',
      ]);
      expect(response.headers).not.toHaveProperty('location');
      const issuedAt = Date.now();
      const accessExpiresAt = new Date(response.body.expiresAt).getTime();
      const refreshExpiresAt = new Date(response.body.refreshExpiresAt).getTime();
      expect(accessExpiresAt - issuedAt).toBeGreaterThan(14 * 60 * 1000);
      expect(accessExpiresAt - issuedAt).toBeLessThanOrEqual(15 * 60 * 1000);
      expect(refreshExpiresAt - issuedAt).toBeGreaterThan(7 * 24 * 60 * 60 * 1000 - 5000);
      expect(refreshExpiresAt - issuedAt).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);
      const claims = await new JwtService({ secret: app.get(authConfig.KEY).jwtSecret }).verifyAsync<{
        sub: string;
        sid: string;
        exp: number;
      }>(response.body.accessToken);
      expect(claims.exp).toBe(accessExpiresAt / 1000);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.displayName).toBe('Ada Lovelace');
      expect(user.role).toBe('user');
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user.passwordHash).not.toContain('twelve characters');
      const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id }, include: { digests: true } });
      expect(claims.sub).toBe(user.id);
      expect(claims.sid).toBe(session.id);
      expect(session.expiresAt.getTime()).toBe(refreshExpiresAt);
      expect(session.digests).toHaveLength(1);
      expect(session.digests[0].digest).toBe(createHash('sha256').update(response.body.refreshToken).digest('hex'));
      expect(await prisma.refreshDigest.findUnique({ where: { digest: response.body.refreshToken } })).toBeNull();
    });
  });

  it('omits Auth credentials and tokens from request completion logs', async () => {
    await runScenario(async ({ app }) => {
      const logger = app.get(StructuredLoggerService);
      const logCompleted = vi.spyOn(logger, 'logHttpRequestCompleted');
      const logUnexpectedError = vi.spyOn(logger, 'logUnexpectedHttpError');
      const email = `log-sentinel-${randomUUID()}@example.test`;
      const password = 'sentinel-password-for-log-check';

      const signUp = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-up')
        .send({ email, displayName: 'Log Sentinel', password })
        .expect(201);
      const signIn = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-in')
        .set('Authorization', `Bearer ${signUp.body.accessToken}`)
        .send({ email, password })
        .expect(200);

      expect(logCompleted).toHaveBeenCalledTimes(2);
      expect(logUnexpectedError).not.toHaveBeenCalled();
      const terminalEvents = logCompleted.mock.calls.map(([metadata]) => metadata);
      expect(terminalEvents.map(({ method, route, statusCode }) => ({ method, route, statusCode }))).toEqual([
        { method: 'POST', route: '/api/v1/auth/sign-up', statusCode: 201 },
        { method: 'POST', route: '/api/v1/auth/sign-in', statusCode: 200 },
      ]);
      for (const metadata of terminalEvents) {
        expect(Object.keys(metadata).sort()).toEqual(['durationMs', 'method', 'route', 'statusCode']);
      }

      const serializedEvents = JSON.stringify(terminalEvents);
      const sensitiveValues = [
        email,
        password,
        signUp.body.accessToken,
        signUp.body.refreshToken,
        signIn.body.accessToken,
        signIn.body.refreshToken,
        `Bearer ${signUp.body.accessToken}`,
      ];
      for (const sensitiveValue of sensitiveValues) {
        expect(serializedEvents.includes(sensitiveValue)).toBe(false);
      }
    });
  });

  it('rejects invalid or extra registration fields and normalized duplicate emails', async () => {
    await runScenario(async ({ app }) => {
      const payload = {
        email: `${randomUUID()}@example.test`,
        displayName: 'Ada Lovelace',
        password: 'twelve characters',
      };
      for (const body of [
        { ...payload, password: 'short' },
        { ...payload, role: 'admin' },
        { ...payload, confirmPassword: payload.password },
        { ...payload, displayName: 'Ada  Lovelace' },
      ]) {
        await request(app.getHttpServer()).post('/api/v1/auth/sign-up').send(body).expect(400);
      }
      await request(app.getHttpServer()).post('/api/v1/auth/sign-up').send(payload).expect(201);
      const duplicate = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-up')
        .send({ ...payload, email: ` ${payload.email.toUpperCase()} ` })
        .expect(409);
      expect(duplicate.body.code).toBe('CONFLICT');
      await request(app.getHttpServer()).post('/api/v1/users').send(payload).expect(404);
    }, options);
  });

  it('allows 10 sign-ups per trusted client IP, blocks the 11th, and isolates IP counters', async () => {
    await runScenario(async ({ app }) => {
      const clientA = '198.51.100.21';
      const clientB = '198.51.100.22';
      const signUp = (ip: string) =>
        request(app.getHttpServer())
          .post('/api/v1/auth/sign-up')
          .set('X-Forwarded-For', ip)
          .send({ email: `${randomUUID()}@example.test`, displayName: 'Ada Lovelace', password: 'twelve characters' });

      for (let attempt = 0; attempt < 10; attempt += 1) {
        await signUp(clientA).expect(201);
      }

      const blocked = await signUp(clientA).expect(429);
      expect(blocked.body).toEqual({
        statusCode: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests.',
        requestId: blocked.headers['x-request-id'],
      });
      expect(blocked.headers['x-request-id']).toEqual(expect.any(String));
      await signUp(clientB).expect(201);
    }, options);
  });

  it('rolls back user creation when session persistence fails', async () => {
    await runScenario(async ({ app }) => {
      const prisma = app.get(PrismaService);
      const email = `${randomUUID()}@example.test`;
      // A transaction-scoped database constraint rejects the session without retaining the user.
      await prisma.$executeRawUnsafe('ALTER TABLE sessions ADD CONSTRAINT reject_signup_session CHECK (false)');
      await request(app.getHttpServer())
        .post('/api/v1/auth/sign-up')
        .send({ email, displayName: 'Rollback User', password: 'twelve characters' })
        .expect(500);
      expect(await prisma.user.count({ where: { email } })).toBe(0);
    });
  });
}
