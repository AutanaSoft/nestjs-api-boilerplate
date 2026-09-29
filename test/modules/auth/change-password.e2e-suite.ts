import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { expect, it } from 'vitest';
import { buildRateLimitConfig } from '../../../src/config/rate-limit.config.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { holdRefreshRaceGate } from '../../support/refresh-race-gate.js';
import type { E2ESuiteRegistration } from '../../support/e2e-context.js';

async function holdUserRow(prisma: PrismaService, userId: string) {
  let release!: () => void;
  let locked!: (pid: number) => void;
  const holding = prisma.$transaction(
    async (transaction) => {
      const [{ pid }] = await transaction.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      await transaction.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      locked(pid);
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    { timeout: 20_000 },
  );
  const holderPid = await new Promise<number>((resolve) => {
    locked = resolve;
  });
  return {
    async waitForWaiters(expected: bigint) {
      const deadline = Date.now() + 8_000;
      while (Date.now() < deadline) {
        const rows = await prisma.$queryRaw<{ count: bigint }[]>`
          WITH RECURSIVE blocked(pid, blockers) AS (
            SELECT pid, pg_blocking_pids(pid) FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
          ), chain(waiter, blocker) AS (
            SELECT pid, unnest(blockers) FROM blocked
            UNION
            SELECT chain.waiter, unnest(pg_blocking_pids(chain.blocker)) FROM chain
            WHERE chain.blocker <> ${holderPid}::integer
          )
          SELECT count(DISTINCT waiter)::bigint AS count FROM chain WHERE blocker = ${holderPid}::integer
        `;
        if (rows[0] && rows[0].count >= expected) return;
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
      throw new Error('Change and sign-in were not both blocked by the user row lock');
    },
    async release() {
      release();
      await holding;
    },
  };
}

export function registerChangePasswordE2ESuite({ runScenario }: E2ESuiteRegistration): void {
  it('rejects malformed input, wrong current password and reuse without changing credentials or sessions', async () => {
    await runScenario(
      async ({ app }) => {
        const server = app.getHttpServer();
        const email = `${randomUUID()}@example.test`;
        const first = await request(server)
          .post('/api/v1/auth/sign-up')
          .send({ email, displayName: 'Ada Lovelace', password: 'twelve characters' })
          .expect(201);
        const change = (body: unknown) =>
          request(server)
            .post('/api/v1/auth/change-password')
            .set('Authorization', `Bearer ${first.body.accessToken}`)
            .send(body);
        const absent = await request(server)
          .post('/api/v1/auth/change-password')
          .send({ currentPassword: 'twelve characters', newPassword: 'another password' })
          .expect(401);
        expect(absent.body.code).toBe('UNAUTHORIZED');
        for (const body of [
          {},
          { currentPassword: '', newPassword: 'another password' },
          { currentPassword: 'short', newPassword: 'short' },
          { currentPassword: 'twelve characters', newPassword: 'another password', extra: true },
        ]) {
          expect((await change(body).expect(400)).body.code).toBe('BAD_REQUEST');
        }
        const invalid = await change({ currentPassword: 'wrong', newPassword: 'another password' }).expect(403);
        expect(invalid.body).toEqual({
          statusCode: 403,
          code: 'INVALID_CURRENT_PASSWORD',
          message: 'The current password is incorrect.',
          requestId: invalid.headers['x-request-id'],
        });
        const reuse = await change({ currentPassword: 'twelve characters', newPassword: 'twelve characters' }).expect(
          400,
        );
        expect(reuse.body).toEqual({
          statusCode: 400,
          code: 'PASSWORD_REUSE_NOT_ALLOWED',
          message: 'The new password must differ from the current password.',
          requestId: reuse.headers['x-request-id'],
        });
        await request(server).post('/api/v1/auth/refresh').send({ refreshToken: first.body.refreshToken }).expect(200);
        await request(server).post('/api/v1/auth/sign-in').send({ email, password: 'twelve characters' }).expect(200);
      },
      { application: { rateLimitConfig: buildRateLimitConfig({ THROTTLE_LIMIT: 100, THROTTLE_TTL_SECONDS: 60 }) } },
    );
  });

  it('rolls back the hash and all sessions when the session revocation update violates a disposable-db constraint', async () => {
    await runScenario(async ({ app }) => {
      const server = app.getHttpServer();
      const email = `${randomUUID()}@example.test`;
      const first = await request(server)
        .post('/api/v1/auth/sign-up')
        .send({ email, displayName: 'Ada Lovelace', password: 'twelve characters' })
        .expect(201);
      const prisma = app.get(PrismaService);
      const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, passwordHash: true } });
      const digest = createHash('sha256').update(first.body.refreshToken).digest('hex');
      const stored = await prisma.refreshDigest.findUniqueOrThrow({ where: { digest } });
      // This constraint lives only in runScenario's disposable database; it is not a migration.
      await prisma.$executeRaw`ALTER TABLE sessions ADD CONSTRAINT test_revoke_failure CHECK (revoked_at IS NULL)`;
      const failed = await request(server)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${first.body.accessToken}`)
        .send({ currentPassword: 'twelve characters', newPassword: 'another password' })
        .expect(500);
      expect(failed.body).toEqual({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
        requestId: failed.headers['x-request-id'],
      });
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash).toBe(user.passwordHash);
      expect((await prisma.session.findUniqueOrThrow({ where: { id: stored.sessionId } })).revokedAt).toBeNull();
      await request(server).post('/api/v1/auth/refresh').send({ refreshToken: first.body.refreshToken }).expect(200);
      await request(server).post('/api/v1/auth/sign-in').send({ email, password: 'twelve characters' }).expect(200);
      await request(server).post('/api/v1/auth/sign-in').send({ email, password: 'another password' }).expect(401);
    });
  });

  it('does not leave a usable refresh credential after change races a blocked rotation', async () => {
    await runScenario(
      async ({ app }) => {
        const server = app.getHttpServer();
        const email = `${randomUUID()}@example.test`;
        const first = await request(server)
          .post('/api/v1/auth/sign-up')
          .send({ email, displayName: 'Ada Lovelace', password: 'twelve characters' })
          .expect(201);
        const prisma = app.get(PrismaService);
        const digest = createHash('sha256').update(first.body.refreshToken).digest('hex');
        const stored = await prisma.refreshDigest.findUniqueOrThrow({ where: { digest } });
        const gate = await holdRefreshRaceGate(prisma, stored.sessionId);
        const refresh = request(server)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: first.body.refreshToken })
          .then((response) => response);
        const change = request(server)
          .post('/api/v1/auth/change-password')
          .set('Authorization', `Bearer ${first.body.accessToken}`)
          .send({ currentPassword: 'twelve characters', newPassword: 'another password' })
          .then((response) => response);
        let results;
        try {
          await gate.waitForContenders();
        } finally {
          await gate.release();
          results = await Promise.allSettled([refresh, change]);
        }
        const responses = results.map((result) => {
          if (result.status === 'rejected') throw result.reason;
          return result.value;
        });
        expect(responses[1].status).toBe(204);
        expect([200, 401]).toContain(responses[0].status);
        for (const token of [
          first.body.refreshToken,
          ...(responses[0].status === 200 ? [responses[0].body.refreshToken] : []),
        ]) {
          await request(server).post('/api/v1/auth/refresh').send({ refreshToken: token }).expect(401);
        }
        for (const token of [
          first.body.accessToken,
          ...(responses[0].status === 200 ? [responses[0].body.accessToken] : []),
        ]) {
          await request(server).post('/api/v1/auth/sign-out').set('Authorization', `Bearer ${token}`).expect(401);
        }
      },
      { application: { rateLimitConfig: buildRateLimitConfig({ THROTTLE_LIMIT: 100, THROTTLE_TTL_SECONDS: 60 }) } },
    );
  });

  it('tests whether an old-password sign-in blocked behind password change can create a usable session', async () => {
    await runScenario(
      async ({ app }) => {
        const server = app.getHttpServer();
        const email = `${randomUUID()}@example.test`;
        const first = await request(server)
          .post('/api/v1/auth/sign-up')
          .send({ email, displayName: 'Ada Lovelace', password: 'twelve characters' })
          .expect(201);
        const prisma = app.get(PrismaService);
        const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
        const gate = await holdUserRow(prisma, user.id);
        const change = request(server)
          .post('/api/v1/auth/change-password')
          .set('Authorization', `Bearer ${first.body.accessToken}`)
          .send({ currentPassword: 'twelve characters', newPassword: 'another password' })
          .then((response) => response);
        // Queue change's FOR UPDATE first. The sign-in reads the old committed hash while change waits.
        await gate.waitForWaiters(1n);
        const signIn = request(server)
          .post('/api/v1/auth/sign-in')
          .send({ email, password: 'twelve characters' })
          .then((response) => response);
        let results;
        try {
          await gate.waitForWaiters(2n);
        } finally {
          await gate.release();
          results = await Promise.allSettled([change, signIn]);
        }
        const [changed, signed] = results.map((result) => {
          if (result.status === 'rejected') throw result.reason;
          return result.value;
        });
        expect(changed.status).toBe(204);
        // A 200 here is not by itself a security failure: the session must be live after the change commits.
        if (signed.status === 200) {
          await request(server)
            .post('/api/v1/auth/sign-out')
            .set('Authorization', `Bearer ${signed.body.accessToken}`)
            .expect(401);
          await request(server)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken: signed.body.refreshToken })
            .expect(401);
        } else {
          expect(signed.status).toBe(401);
        }
      },
      { application: { rateLimitConfig: buildRateLimitConfig({ THROTTLE_LIMIT: 100, THROTTLE_TTL_SECONDS: 60 }) } },
    );
  });

  it('changes the current password and invalidates every session of the owner, not another user', async () => {
    await runScenario(
      async ({ app }) => {
        const server = app.getHttpServer();
        const email = `${randomUUID()}@example.test`;
        const first = await request(server)
          .post('/api/v1/auth/sign-up')
          .send({ email, displayName: 'Ada Lovelace', password: 'twelve characters' })
          .expect(201);
        const second = await request(server)
          .post('/api/v1/auth/sign-in')
          .send({ email, password: 'twelve characters' })
          .expect(200);
        const other = await request(server)
          .post('/api/v1/auth/sign-up')
          .send({ email: `${randomUUID()}@example.test`, displayName: 'Grace Hopper', password: 'twelve characters' })
          .expect(201);
        const changed = await request(server)
          .post('/api/v1/auth/change-password')
          .set('Authorization', `Bearer ${first.body.accessToken}`)
          .send({ currentPassword: 'twelve characters', newPassword: '  another password  ' })
          .expect(204);
        expect(changed.text).toBe('');
        for (const credentials of [first.body, second.body]) {
          await request(server)
            .post('/api/v1/auth/sign-out')
            .set('Authorization', `Bearer ${credentials.accessToken}`)
            .expect(401);
          await request(server)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken: credentials.refreshToken })
            .expect(401);
        }
        await request(server).post('/api/v1/auth/sign-in').send({ email, password: 'twelve characters' }).expect(401);
        await request(server)
          .post('/api/v1/auth/sign-in')
          .send({ email, password: '  another password  ' })
          .expect(200);
        await request(server)
          .post('/api/v1/auth/sign-out')
          .set('Authorization', `Bearer ${other.body.accessToken}`)
          .expect(204);
      },
      { application: { rateLimitConfig: buildRateLimitConfig({ THROTTLE_LIMIT: 100, THROTTLE_TTL_SECONDS: 60 }) } },
    );
  });
}
