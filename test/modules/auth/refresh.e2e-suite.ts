import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { expect, it } from 'vitest';
import { buildRateLimitConfig } from '../../../src/config/rate-limit.config.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { DatabaseTransactionRunner } from '../../../src/database/transaction/database-transaction.js';
import { PrismaSessionsRepository } from '../../../src/modules/auth/repositories/prisma-sessions.repository.js';
import { RefreshCleanupService } from '../../../src/modules/auth/refresh-cleanup.service.js';
import type { E2ESuiteRegistration } from '../../support/e2e-context.js';
import { holdRefreshRaceGate } from '../../support/refresh-race-gate.js';

export function registerRefreshE2ESuite({ runScenario }: E2ESuiteRegistration): void {
  it('rotates a refresh credential over public HTTP and rejects reuse', async () => {
    await runScenario(
      async ({ app }) => {
        const email = `${randomUUID()}@example.test`;
        const first = await request(app.getHttpServer())
          .post('/api/v1/auth/sign-up')
          .send({ email, displayName: 'Ada Lovelace', password: 'twelve characters' })
          .expect(201);
        const other = await request(app.getHttpServer())
          .post('/api/v1/auth/sign-in')
          .send({ email, password: 'twelve characters' })
          .expect(200);
        const renewed = await request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: first.body.refreshToken })
          .expect(200);
        expect(Object.keys(renewed.body).sort()).toEqual(
          ['accessToken', 'expiresAt', 'refreshToken', 'refreshExpiresAt'].sort(),
        );
        expect(renewed.body.refreshToken).not.toBe(first.body.refreshToken);
        const replay = await request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: first.body.refreshToken })
          .expect(401);
        expect(replay.body).toEqual({
          statusCode: 401,
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid refresh token.',
          requestId: replay.headers['x-request-id'],
        });
        await request(app.getHttpServer())
          .post('/api/v1/auth/sign-out')
          .set('Authorization', `Bearer ${renewed.body.accessToken}`)
          .expect(401);
        await request(app.getHttpServer())
          .post('/api/v1/auth/sign-out')
          .set('Authorization', `Bearer ${other.body.accessToken}`)
          .expect(204);
      },
      { application: { rateLimitConfig: buildRateLimitConfig({ THROTTLE_LIMIT: 100, THROTTLE_TTL_SECONDS: 60 }) } },
    );
  });

  it('serializes concurrent same-token HTTP calls and the loser revokes the winner only', async () => {
    await runScenario(
      async ({ app }) => {
        const server = app.getHttpServer();
        const email = `${randomUUID()}@example.test`;
        const first = await request(server)
          .post('/api/v1/auth/sign-up')
          .send({ email, displayName: 'Ada Lovelace', password: 'twelve characters' })
          .expect(201);
        const other = await request(server)
          .post('/api/v1/auth/sign-in')
          .send({ email, password: 'twelve characters' })
          .expect(200);
        const prisma = app.get(PrismaService);
        const digest = createHash('sha256').update(first.body.refreshToken).digest('hex');
        const stored = await prisma.refreshDigest.findUniqueOrThrow({ where: { digest } });
        const gate = await holdRefreshRaceGate(prisma, stored.sessionId);
        const send = () => request(server).post('/api/v1/auth/refresh').send({ refreshToken: first.body.refreshToken });
        const contenders = [send().then((response) => response), send().then((response) => response)];
        let results;
        try {
          await gate.waitForContenders();
        } finally {
          await gate.release();
          results = await Promise.allSettled(contenders);
        }
        const responses = results.map((result) => {
          if (result.status === 'rejected') throw result.reason;
          return result.value;
        });
        expect(responses.map((result) => result.status).sort()).toEqual([200, 401]);
        const winner = responses.find((result) => result.status === 200);
        expect(winner).toBeDefined();
        await request(server)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: winner!.body.refreshToken })
          .expect(401);
        await request(server)
          .post('/api/v1/auth/sign-out')
          .set('Authorization', `Bearer ${winner!.body.accessToken}`)
          .expect(401);
        await request(server)
          .post('/api/v1/auth/sign-out')
          .set('Authorization', `Bearer ${other.body.accessToken}`)
          .expect(204);
      },
      { application: { rateLimitConfig: buildRateLimitConfig({ THROTTLE_LIMIT: 100, THROTTLE_TTL_SECONDS: 60 }) } },
    );
  });

  it('revokes the bound session when retired-generation replay races its current successor', async () => {
    await runScenario(
      async ({ app }) => {
        const server = app.getHttpServer();
        const email = `${randomUUID()}@example.test`;
        const first = await request(server)
          .post('/api/v1/auth/sign-up')
          .send({ email, displayName: 'Ada Lovelace', password: 'twelve characters' })
          .expect(201);
        const other = await request(server)
          .post('/api/v1/auth/sign-in')
          .send({ email, password: 'twelve characters' })
          .expect(200);
        const current = await request(server)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: first.body.refreshToken })
          .expect(200);
        const prisma = app.get(PrismaService);
        const digest = createHash('sha256').update(current.body.refreshToken).digest('hex');
        const stored = await prisma.refreshDigest.findUniqueOrThrow({ where: { digest } });
        const gate = await holdRefreshRaceGate(prisma, stored.sessionId);
        const send = (refreshToken: string) => request(server).post('/api/v1/auth/refresh').send({ refreshToken });
        const contenders = [
          send(first.body.refreshToken).then((response) => response),
          send(current.body.refreshToken).then((response) => response),
        ];
        let settled;
        try {
          await gate.waitForContenders();
        } finally {
          await gate.release();
          settled = await Promise.allSettled(contenders);
        }
        const responses = settled.map((result) => {
          if (result.status === 'rejected') throw result.reason;
          return result.value;
        });
        const denied = responses.filter((response) => response.status === 401);
        expect(denied.length).toBeGreaterThanOrEqual(1);
        for (const response of denied) {
          expect(response.body).toEqual({
            statusCode: 401,
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Invalid refresh token.',
            requestId: response.headers['x-request-id'],
          });
        }
        for (const credentials of [
          current.body,
          ...responses.filter((response) => response.status === 200).map((response) => response.body),
        ]) {
          const invalid = await send(credentials.refreshToken).expect(401);
          expect(invalid.body).toEqual({
            statusCode: 401,
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Invalid refresh token.',
            requestId: invalid.headers['x-request-id'],
          });
          await request(server)
            .post('/api/v1/auth/sign-out')
            .set('Authorization', `Bearer ${credentials.accessToken}`)
            .expect(401);
        }
        expect((await prisma.session.findUniqueOrThrow({ where: { id: stored.sessionId } })).revokedAt).not.toBeNull();
        await request(server)
          .post('/api/v1/auth/sign-out')
          .set('Authorization', `Bearer ${other.body.accessToken}`)
          .expect(204);
      },
      { application: { rateLimitConfig: buildRateLimitConfig({ THROTTLE_LIMIT: 100, THROTTLE_TTL_SECONDS: 60 }) } },
    );
  });

  it('validates exact input and gives the same public denial for unknown, expired and revoked credentials', async () => {
    await runScenario(
      async ({ app }) => {
        const server = app.getHttpServer();
        const first = await request(server)
          .post('/api/v1/auth/sign-up')
          .send({
            email: `${randomUUID()}@example.test`,
            displayName: 'Ada Lovelace',
            password: 'twelve characters',
          })
          .expect(201);
        for (const body of [
          {},
          { refreshToken: '' },
          { refreshToken: 5 },
          { refreshToken: first.body.refreshToken, extra: true },
        ]) {
          expect((await request(server).post('/api/v1/auth/refresh').send(body).expect(400)).body.code).toBe(
            'BAD_REQUEST',
          );
        }
        const digest = createHash('sha256').update(first.body.refreshToken).digest('hex');
        const prisma = app.get(PrismaService);
        const invalid = async (token: string) => {
          const response = await request(server).post('/api/v1/auth/refresh').send({ refreshToken: token }).expect(401);
          expect(response.body).toEqual({
            statusCode: 401,
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Invalid refresh token.',
            requestId: response.headers['x-request-id'],
          });
        };
        await invalid(randomUUID());
        expect((await prisma.refreshDigest.findUniqueOrThrow({ where: { digest } })).retiredAt).toBeNull();
        await prisma.refreshDigest.update({ where: { digest }, data: { expiresAt: new Date(Date.now() - 1_000) } });
        await invalid(first.body.refreshToken);
        await prisma.refreshDigest.update({ where: { digest }, data: { expiresAt: new Date(Date.now() + 60_000) } });
        const session = await prisma.refreshDigest.findUniqueOrThrow({ where: { digest } });
        await prisma.session.update({ where: { id: session.sessionId }, data: { revokedAt: new Date() } });
        await invalid(first.body.refreshToken);
      },
      { application: { rateLimitConfig: buildRateLimitConfig({ THROTTLE_LIMIT: 100, THROTTLE_TTL_SECONDS: 60 }) } },
    );
  });

  it('rolls back a failed successor insert including the retirement of the original digest', async () => {
    await runScenario(async ({ app }) => {
      const server = app.getHttpServer();
      const first = await request(server)
        .post('/api/v1/auth/sign-up')
        .send({
          email: `${randomUUID()}@example.test`,
          displayName: 'Ada Lovelace',
          password: 'twelve characters',
        })
        .expect(201);
      const prisma = app.get(PrismaService);
      const digest = createHash('sha256').update(first.body.refreshToken).digest('hex');
      const stored = await prisma.refreshDigest.findUniqueOrThrow({ where: { digest } });
      const repository = new PrismaSessionsRepository(prisma);
      const runner = new DatabaseTransactionRunner(prisma);
      await expect(
        runner.runReadCommitted((transaction) =>
          repository.rotateDigest(
            stored.sessionId,
            digest,
            digest,
            new Date(Date.now() + 60_000),
            new Date(),
            transaction,
          ),
        ),
      ).rejects.toThrow();
      expect((await prisma.refreshDigest.findUniqueOrThrow({ where: { digest } })).retiredAt).toBeNull();
      await request(server).post('/api/v1/auth/refresh').send({ refreshToken: first.body.refreshToken }).expect(200);
    });
  });

  it('detects expired retired replay within seven days and purges old history across sessions', async () => {
    await runScenario(
      async ({ app }) => {
        const server = app.getHttpServer();
        const first = await request(server)
          .post('/api/v1/auth/sign-up')
          .send({
            email: `${randomUUID()}@example.test`,
            displayName: 'Ada Lovelace',
            password: 'twelve characters',
          })
          .expect(201);
        const second = await request(server)
          .post('/api/v1/auth/sign-up')
          .send({
            email: `${randomUUID()}@example.test`,
            displayName: 'Grace Hopper',
            password: 'twelve characters',
          })
          .expect(201);
        const oldDigest = createHash('sha256').update(first.body.refreshToken).digest('hex');
        const staleDigest = createHash('sha256').update(second.body.refreshToken).digest('hex');
        const prisma = app.get(PrismaService);
        const next = await request(server)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: first.body.refreshToken })
          .expect(200);
        await prisma.refreshDigest.update({
          where: { digest: oldDigest },
          data: { expiresAt: new Date(Date.now() - 60_000) },
        });
        await request(server).post('/api/v1/auth/refresh').send({ refreshToken: first.body.refreshToken }).expect(401);
        await request(server).post('/api/v1/auth/refresh').send({ refreshToken: next.body.refreshToken }).expect(401);
        const stale = await prisma.refreshDigest.findUniqueOrThrow({ where: { digest: staleDigest } });
        await prisma.refreshDigest.create({
          data: {
            digest: randomUUID(),
            sessionId: stale.sessionId,
            expiresAt: new Date(Date.now() - 9 * 86_400_000),
            retiredAt: new Date(Date.now() - 9 * 86_400_000),
          },
        });
        // Cleanup is autonomous from HTTP; explicitly trigger its lifecycle work in this isolated scenario.
        await app.get(RefreshCleanupService).runOnce();
        expect(await prisma.refreshDigest.count({ where: { sessionId: stale.sessionId } })).toBe(1);
        await request(server).post('/api/v1/auth/refresh').send({ refreshToken: second.body.refreshToken }).expect(200);
      },
      { application: { rateLimitConfig: buildRateLimitConfig({ THROTTLE_LIMIT: 100, THROTTLE_TTL_SECONDS: 60 }) } },
    );
  });
}
