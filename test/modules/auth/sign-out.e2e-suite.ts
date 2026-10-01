import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { expect, it } from 'vitest';
import { buildRateLimitConfig } from '../../../src/config/rate-limit.config.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import authConfig from '../../../src/config/auth.config.js';
import type { E2ESuiteRegistration } from '../../support/e2e-context.js';

export function registerSignOutE2ESuite({ runScenario }: E2ESuiteRegistration): void {
  const options = {
    application: { rateLimitConfig: buildRateLimitConfig({ THROTTLE_LIMIT: 100, THROTTLE_TTL_SECONDS: 60 }) },
  };
  it('revokes only the current session through a bodyless authenticated sign-out', async () => {
    await runScenario(async ({ app }) => {
      const email = `${randomUUID()}@example.test`;
      const credentials = { email, displayName: 'Ada Lovelace', password: 'twelve characters' };
      const first = await request(app.getHttpServer()).post('/api/v1/auth/sign-up').send(credentials).expect(201);
      const second = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-in')
        .send({ email, password: credentials.password })
        .expect(200);
      const prisma = app.get(PrismaService);
      const jwt = new JwtService({ secret: app.get(authConfig.KEY).jwtSecret });
      const claims = await jwt.verifyAsync<{ sub: string; sid: string }>(first.body.accessToken);
      const signOut = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-out')
        .set('Authorization', `Bearer ${first.body.accessToken}`)
        .expect(204);
      expect(signOut.text).toBe('');
      expect((await prisma.session.findUniqueOrThrow({ where: { id: claims.sid } })).revokedAt).not.toBeNull();
      await request(app.getHttpServer())
        .post('/api/v1/auth/sign-out')
        .set('Authorization', `Bearer ${first.body.accessToken}`)
        .expect(401);
      const secondClaims = await jwt.verifyAsync<{ sid: string }>(second.body.accessToken);
      expect((await prisma.session.findUniqueOrThrow({ where: { id: secondClaims.sid } })).revokedAt).toBeNull();
      await request(app.getHttpServer())
        .post('/api/v1/auth/sign-out')
        .set('Authorization', `Bearer ${second.body.accessToken}`)
        .expect(204);
    }, options);
  });

  it('rejects invalid credentials, forged identity and stale session state with the same public error', async () => {
    await runScenario(async ({ app }) => {
      const email = `${randomUUID()}@example.test`;
      const first = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-up')
        .send({ email, displayName: 'Ada Lovelace', password: 'twelve characters' })
        .expect(201);
      const jwt = new JwtService({ secret: app.get(authConfig.KEY).jwtSecret });
      const claims = await jwt.verifyAsync<{ sub: string; sid: string }>(first.body.accessToken);
      const now = Math.floor(Date.now() / 1000);
      const invalid = [
        undefined,
        'Bearer invalid',
        `Bearer ${first.body.accessToken} extra`,
        `Bearer ${new JwtService({ secret: 'not-the-application-key' }).sign({ sub: claims.sub, sid: claims.sid })}`,
        `Bearer ${jwt.sign({ sub: claims.sub, sid: claims.sid, iat: now - 120, exp: now - 60 })}`,
        `Bearer ${jwt.sign({ sub: randomUUID(), sid: claims.sid })}`,
        `Bearer ${jwt.sign({ sub: claims.sub, sid: randomUUID() })}`,
        `Bearer ${jwt.sign({ sid: claims.sid })}`,
      ];
      for (const authorization of invalid) {
        const call = request(app.getHttpServer()).post('/api/v1/auth/sign-out');
        const response = await (authorization === undefined ? call : call.set('Authorization', authorization)).expect(
          401,
        );
        expect(response.body).toEqual({
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'Authentication is required.',
          requestId: response.headers['x-request-id'],
        });
      }
      const prisma = app.get(PrismaService);
      await prisma.session.update({ where: { id: claims.sid }, data: { revokedAt: new Date() } });
      await request(app.getHttpServer())
        .post('/api/v1/auth/sign-out')
        .set('Authorization', `Bearer ${first.body.accessToken}`)
        .expect(401);
    }, options);
  });

  it('rejects deleted sessions and users, and leaves public routes accessible without Bearer', async () => {
    await runScenario(async ({ app }) => {
      await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
      const unknown = await request(app.getHttpServer()).get('/api/v1/unknown-route').expect(404);
      expect(unknown.body.code).toBe('ROUTE_NOT_FOUND');
      const email = `${randomUUID()}@example.test`;
      const first = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-up')
        .send({ email, displayName: 'Ada Lovelace', password: 'twelve characters' })
        .expect(201);
      const jwt = new JwtService({ secret: app.get(authConfig.KEY).jwtSecret });
      const claims = await jwt.verifyAsync<{ sub: string; sid: string }>(first.body.accessToken);
      const prisma = app.get(PrismaService);
      await prisma.session.delete({ where: { id: claims.sid } });
      await request(app.getHttpServer())
        .post('/api/v1/auth/sign-out')
        .set('Authorization', `Bearer ${first.body.accessToken}`)
        .expect(401);
      const second = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-in')
        .send({ email, password: 'twelve characters' })
        .expect(200);
      await request(app.getHttpServer())
        .delete(`/api/v1/users/${claims.sub}`)
        .set('Authorization', `Bearer ${second.body.accessToken}`)
        .expect(204);
      await request(app.getHttpServer())
        .post('/api/v1/auth/sign-out')
        .set('Authorization', `Bearer ${second.body.accessToken}`)
        .expect(401);
    }, options);
  });

  it('rejects any request body without revoking the authenticated session', async () => {
    await runScenario(async ({ app }) => {
      const first = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-up')
        .send({ email: `${randomUUID()}@example.test`, displayName: 'Ada Lovelace', password: 'twelve characters' })
        .expect(201);
      for (const body of [{ refreshToken: first.body.refreshToken }, {}]) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/sign-out')
          .set('Authorization', `Bearer ${first.body.accessToken}`)
          .send(body)
          .expect(400);
        expect(response.body.code).toBe('BAD_REQUEST');
      }
      await request(app.getHttpServer())
        .post('/api/v1/auth/sign-out')
        .set('Authorization', `Bearer ${first.body.accessToken}`)
        .set('Content-Type', 'application/json')
        .send('null')
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/v1/auth/sign-out')
        .set('Authorization', `Bearer ${first.body.accessToken}`)
        .expect(204);
    }, options);
  });
}
