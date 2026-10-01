import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { Test } from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildRateLimitConfig } from '../../../src/config/rate-limit.config.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { signUpFixture } from '../../support/auth-signup.js';
import type { E2ESuiteRegistration } from '../../support/e2e-context.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const notFound = {
  statusCode: 404,
  code: 'RESOURCE_NOT_FOUND',
  message: 'The requested resource was not found.',
  requestId: expect.stringMatching(UUID_V4),
};
const badRequest = { statusCode: 400, code: 'BAD_REQUEST', message: 'The request is invalid.' };
const options = {
  application: { rateLimitConfig: buildRateLimitConfig({ THROTTLE_LIMIT: 100, THROTTLE_TTL_SECONDS: 60 }) },
};

function authorizedRequest(app: Parameters<typeof signUpFixture>[0], accessToken: string) {
  const server = app.getHttpServer();
  const authorize = (test: Test) => test.set('Authorization', `Bearer ${accessToken}`);
  return {
    get: (path: string) => authorize(request(server).get(path)),
    post: (path: string) => authorize(request(server).post(path)),
    patch: (path: string) => authorize(request(server).patch(path)),
    delete: (path: string) => authorize(request(server).delete(path)),
    query: (path: string) => authorize(new Test(server, 'QUERY', path)),
  };
}

export function registerCreateUserE2ESuite({ runScenario }: E2ESuiteRegistration): void {
  describe('Users HTTP regression after moving creation to Auth', () => {
    it('requires a valid Bearer token on every Users operation, including QUERY and /me', async () => {
      await runScenario(async ({ app }) => {
        const user = await signUpFixture(app);
        const query = new Test(app.getHttpServer(), 'QUERY', '/api/v1/users').send({
          criteria: { email: user.email },
        });
        const routes = [
          request(app.getHttpServer()).get('/api/v1/users'),
          query,
          request(app.getHttpServer()).get(`/api/v1/users/${user.id}`),
          request(app.getHttpServer()).get('/api/v1/users/me'),
          request(app.getHttpServer()).patch(`/api/v1/users/${user.id}`).send({ displayName: 'Ada Byron' }),
          request(app.getHttpServer()).patch('/api/v1/users/me').send({ displayName: 'Ada Byron' }),
          request(app.getHttpServer()).delete(`/api/v1/users/${user.id}`),
          request(app.getHttpServer()).get('/api/v1/users/123e4567-e89b-42d3-a456-426614174001'),
          request(app.getHttpServer()).patch('/api/v1/users/123e4567-e89b-42d3-a456-426614174001').send({
            displayName: 'Ada Byron',
          }),
          request(app.getHttpServer()).delete('/api/v1/users/123e4567-e89b-42d3-a456-426614174001'),
        ];

        for (const route of routes) {
          await route.expect(401);
        }
      }, options);
    });

    it('does not expose legacy POST /users, including with valid former input', async () => {
      await runScenario(async ({ app }) => {
        const user = await signUpFixture(app);
        const client = authorizedRequest(app, user.accessToken);
        await client
          .post('/api/v1/users')
          .send({ email: `${randomUUID()}@example.test`, displayName: 'Ada Lovelace' })
          .expect(404);
      });
    });

    it('retrieves registered users and retains normalized exact-email filtering and strict query', async () => {
      await runScenario(async ({ app }) => {
        const first = await signUpFixture(app, 'Ada Lovelace');
        await signUpFixture(app, 'Grace Hopper');
        const client = authorizedRequest(app, first.accessToken);
        const fetched = await client.get(`/api/v1/users/${first.id}`).expect(200);
        expect(fetched.headers['x-request-id']).toMatch(UUID_V4);
        expect(fetched.body).toEqual({
          id: first.id,
          email: first.email,
          displayName: 'Ada Lovelace',
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
          role: 'user',
        });
        const filtered = await client
          .get(`/api/v1/users?email=${encodeURIComponent(` ${first.email.toUpperCase()} `)}`)
          .expect(200);
        expect(filtered.body).toEqual({
          data: [fetched.body],
          pageInfo: {
            nextCursor: null,
            previousCursor: null,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        });
        for (const query of ['sort=email', 'limit=0', 'displayName=Ada', 'after=a&before=b', 'limit=1&limit=2']) {
          const invalid = await client.get(`/api/v1/users?${query}`).expect(400);
          expect(invalid.body).toMatchObject(badRequest);
        }
        expect((await client.get('/api/v1/users/not-a-uuid').expect(400)).body).toMatchObject(badRequest);
        expect((await client.get('/api/v1/users/123e4567-e89b-42d3-a456-426614174001').expect(404)).body).toEqual(
          notFound,
        );
        const structured = await client
          .query('/api/v1/users')
          .send({ criteria: { email: first.email.toUpperCase() } })
          .expect(200);
        expect(structured.body.data.map((user: { id: string }) => user.id)).toEqual([first.id]);
        await client
          .query('/api/v1/users')
          .send({ criteria: { email: first.email, displayName: 'Ada' } })
          .expect(400);
      }, options);
    });

    it('preserves list ordering, cursor navigation and strict cursor rejection', async () => {
      await runScenario(async ({ app }) => {
        const fixtures = [];
        for (const name of ['Ada Lovelace', 'Ada Lovelace', 'Grace Hopper']) {
          fixtures.push(await signUpFixture(app, name));
        }
        const ids = fixtures.map((fixture) => fixture.id);
        const client = authorizedRequest(app, fixtures[0].accessToken);
        const first = await client.get('/api/v1/users?sort=displayName&direction=asc&limit=1').expect(200);
        const tiedIds = ids.slice(0, 2).sort();
        expect(first.headers['x-request-id']).toMatch(UUID_V4);
        expect(first.body.data).toHaveLength(1);
        expect(first.body.data[0]).toMatchObject({
          id: tiedIds[0],
          displayName: 'Ada Lovelace',
          role: 'user',
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        });
        if (tiedIds[0] === fixtures[0].id) expect(first.body.data[0].email).toBe(fixtures[0].email);
        else expect(first.body.data[0]).not.toHaveProperty('email');
        expect(first.body.pageInfo).toEqual({
          hasNextPage: true,
          hasPreviousPage: false,
          nextCursor: expect.any(String),
          previousCursor: null,
        });
        const second = await client
          .get(`/api/v1/users?sort=displayName&direction=asc&limit=1&after=${first.body.pageInfo.nextCursor}`)
          .expect(200);
        expect(second.body.data[0].id).toBe(tiedIds[1]);
        expect(second.body.pageInfo).toEqual({
          hasNextPage: true,
          hasPreviousPage: true,
          nextCursor: expect.any(String),
          previousCursor: expect.any(String),
        });
        const backward = await client
          .get(`/api/v1/users?sort=displayName&direction=asc&limit=1&before=${second.body.pageInfo.previousCursor}`)
          .expect(200);
        expect(backward.body).toEqual(first.body);
        const third = await client
          .get(`/api/v1/users?sort=displayName&direction=asc&limit=1&after=${second.body.pageInfo.nextCursor}`)
          .expect(200);
        expect(third.body.data[0].displayName).toBe('Grace Hopper');
        expect(third.body.pageInfo).toEqual({
          hasNextPage: false,
          hasPreviousPage: true,
          nextCursor: null,
          previousCursor: expect.any(String),
        });
        const all = await client.get('/api/v1/users?sort=createdAt&direction=desc').expect(200);
        expect(all.body.data.map((user: { id: string }) => user.id).sort()).toEqual(ids.sort());
        expect(
          (await client.get(`/api/v1/users?sort=createdAt&after=${first.body.pageInfo.nextCursor}`).expect(400)).body,
        ).toMatchObject(badRequest);
      }, options);
    });

    it('preserves all four list sort directions, tie breaking, and empty-page flags', async () => {
      await runScenario(async ({ app }) => {
        const users = [];
        for (const name of ['Ada Lovelace', 'Ada Lovelace', 'Ada Lovelace', 'Grace Hopper']) {
          users.push(await signUpFixture(app, name));
        }
        const client = authorizedRequest(app, users[0].accessToken);
        for (const sort of ['createdAt', 'displayName']) {
          for (const direction of ['asc', 'desc']) {
            const response = await client.get(`/api/v1/users?sort=${sort}&direction=${direction}&limit=25`).expect(200);
            expect(response.body.data).toHaveLength(4);
            expect(response.body.data.map((user: { id: string }) => user.id).sort()).toEqual(
              users.map((user) => user.id).sort(),
            );
            const ordered = response.body.data.map((user: { createdAt: string; displayName: string }) => user[sort]);
            expect(ordered).toEqual(
              [...ordered].sort((left, right) =>
                direction === 'asc' ? left.localeCompare(right) : right.localeCompare(left),
              ),
            );
          }
        }
        const tied = await client.get('/api/v1/users?sort=displayName&direction=asc').expect(200);
        expect(tied.body.data.slice(0, 3).map((user: { id: string }) => user.id)).toEqual(
          users
            .slice(0, 3)
            .map((user) => user.id)
            .sort(),
        );
        const empty = await client.get('/api/v1/users?email=nobody@example.test').expect(200);
        expect(empty.body).toEqual({
          data: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            nextCursor: null,
            previousCursor: null,
          },
        });
      }, options);
    });

    it('rejects malformed, legacy and repeated list cursors', async () => {
      await runScenario(async ({ app }) => {
        const user = await signUpFixture(app);
        await signUpFixture(app);
        const client = authorizedRequest(app, user.accessToken);
        const page = await client.get('/api/v1/users?limit=1').expect(200);
        const cursor = page.body.pageInfo.nextCursor;
        const legacy = Buffer.from(
          JSON.stringify({
            v: 1,
            email: user.email,
            sort: 'createdAt',
            direction: 'desc',
            position: { id: page.body.data[0].id, createdAt: page.body.data[0].createdAt },
          }),
        ).toString('base64url');
        for (const query of [
          'after=not-base64!',
          `after=${'a'.repeat(1025)}`,
          `after=${legacy}`,
          `after=${cursor}&after=${cursor}`,
          `before=${cursor}&before=${cursor}`,
          `direction=asc&after=${cursor}`,
          `sort=displayName&after=${cursor}`,
          'direction=asc&direction=desc',
          'sort=createdAt&sort=displayName',
          `email=${user.email}&email=other@example.com`,
        ]) {
          await client.get(`/api/v1/users?${query}`).expect(400);
        }
        const crossFilter = await client.get(`/api/v1/users?email=nobody@example.test&after=${cursor}`).expect(200);
        expect(crossFilter.body).toEqual({
          data: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            nextCursor: null,
            previousCursor: null,
          },
        });
      }, options);
    });

    it('preserves strict QUERY bodies and safe repeated results', async () => {
      await runScenario(async ({ app }) => {
        const user = await signUpFixture(app);
        const client = authorizedRequest(app, user.accessToken);
        const body = { criteria: { email: user.email }, sort: 'displayName', direction: 'asc', limit: 1 };
        const first = await client.query('/api/v1/users').send(body).expect(200);
        const repeated = await client.query('/api/v1/users').send(body).expect(200);
        expect(first.headers['x-request-id']).toMatch(UUID_V4);
        expect(repeated.body).toEqual(first.body);
        const fetched = await client.get(`/api/v1/users/${user.id}`).expect(200);
        expect(first.body).toEqual({
          data: [fetched.body],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            nextCursor: null,
            previousCursor: null,
          },
        });
        expect(first.body.data[0]).not.toHaveProperty('password');
        expect(first.body.data[0]).not.toHaveProperty('passwordHash');
        for (const invalid of [
          null,
          [],
          {},
          { criteria: null },
          { criteria: [] },
          { criteria: {} },
          { criteria: { email: null } },
          { criteria: { email: user.email, displayName: 'Ada' } },
          { ...body, unknown: true },
          { ...body, after: 'not-base64!' },
          { ...body, after: 'a', before: 'b' },
        ]) {
          const response = await client.query('/api/v1/users').send(invalid).expect(400);
          expect(response.body).toMatchObject(badRequest);
        }
        await client.query('/api/v1/users?limit=1').send(body).expect(400);
        await signUpFixture(app);
        const page = await client.get('/api/v1/users?limit=1').expect(200);
        const after = page.body.pageInfo.nextCursor;
        const valid = { criteria: { email: user.email } };
        const crossFilter = await client
          .query('/api/v1/users')
          .send({ ...valid, after })
          .expect(200);
        expect(crossFilter.body.data.every((row: { email: string }) => row.email === user.email)).toBe(true);
        const legacy = Buffer.from(
          JSON.stringify({
            v: 1,
            email: user.email,
            sort: 'createdAt',
            direction: 'desc',
            position: { id: page.body.data[0].id, createdAt: page.body.data[0].createdAt },
          }),
        ).toString('base64url');
        await client
          .query('/api/v1/users')
          .send({ ...valid, after: legacy })
          .expect(400);
      }, options);
    });

    it('redacts emails from other users in single, list, QUERY, and cursor-page projections', async () => {
      await runScenario(async ({ app }) => {
        const viewer = await signUpFixture(app, 'Ada Lovelace');
        const other = await signUpFixture(app, 'Grace Hopper');
        await signUpFixture(app, 'Katherine Johnson');
        const client = authorizedRequest(app, viewer.accessToken);
        const otherUser = await client.get(`/api/v1/users/${other.id}`).expect(200);
        expect(otherUser.body).not.toHaveProperty('email');
        expect(otherUser.body).not.toHaveProperty('passwordHash');

        let url: string | undefined = '/api/v1/users?sort=displayName&direction=asc&limit=1';
        const rows = [];
        while (url !== undefined) {
          const page = await client.get(url).expect(200);
          rows.push(...page.body.data);
          const nextCursor = page.body.pageInfo.nextCursor;
          url =
            nextCursor === null
              ? undefined
              : `/api/v1/users?sort=displayName&direction=asc&limit=1&after=${nextCursor}`;
        }
        expect(rows).toHaveLength(3);
        for (const row of rows) {
          expect(row).toHaveProperty('role', 'user');
          expect(row).not.toHaveProperty('password');
          expect(row).not.toHaveProperty('passwordHash');
          if (row.id === viewer.id) expect(row.email).toBe(viewer.email);
          else expect(row).not.toHaveProperty('email');
        }

        const queryResult = await client
          .query('/api/v1/users')
          .send({ criteria: { email: other.email } })
          .expect(200);
        expect(queryResult.body.data).toHaveLength(1);
        expect(queryResult.body.data[0]).toMatchObject({ id: other.id, role: 'user' });
        expect(queryResult.body.data[0]).not.toHaveProperty('email');
        expect(queryResult.body.data[0]).not.toHaveProperty('passwordHash');
      }, options);
    });

    it('supports owner profile reads and display-name-only updates, and denies other-account writes', async () => {
      await runScenario(async ({ app }) => {
        const user = await signUpFixture(app);
        const other = await signUpFixture(app, 'Grace Hopper');
        const client = authorizedRequest(app, user.accessToken);
        const before = await client.get('/api/v1/users/me').expect(200);
        expect(before.body).toEqual({
          id: user.id,
          email: user.email,
          displayName: 'Test User',
          role: 'user',
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        });
        expect((await client.get(`/api/v1/users/${other.id}`).expect(200)).body).toEqual({
          id: other.id,
          displayName: 'Grace Hopper',
          role: 'user',
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        });
        const renamed = await client.patch('/api/v1/users/me').send({ displayName: ' Ada Byron ' }).expect(200);
        expect(renamed.body).toMatchObject({ id: user.id, email: user.email, displayName: 'Ada Byron', role: 'user' });
        expect(renamed.body.updatedAt).not.toBe(before.body.updatedAt);
        expect(
          (await client.patch(`/api/v1/users/${user.id}`).send({ displayName: 'Ada Lovelace' }).expect(200)).body,
        ).toMatchObject({ displayName: 'Ada Lovelace', email: user.email });
        expect(
          (await client.patch(`/api/v1/users/${other.id}`).send({ displayName: 'Grace Hopper' }).expect(403)).body,
        ).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
        expect((await client.delete(`/api/v1/users/${other.id}`).expect(403)).body).toMatchObject({
          statusCode: 403,
          code: 'FORBIDDEN',
        });
        expect(
          (
            await client
              .patch('/api/v1/users/123e4567-e89b-42d3-a456-426614174001')
              .send({ displayName: 'Ada Byron' })
              .expect(404)
          ).body,
        ).toEqual(notFound);
        for (const invalid of [
          null,
          {},
          { email: user.email, displayName: 'Ada Byron' },
          { role: 'admin', displayName: 'Ada Byron' },
          { password: 'secret', displayName: 'Ada Byron' },
          { displayName: 'Ada  Byron' },
        ]) {
          const response = await client.patch('/api/v1/users/me').send(invalid).expect(400);
          expect(response.body).toMatchObject(badRequest);
        }
      }, options);
    });

    it('rejects malformed and missing deletion targets, then invalidates the deleted owner token', async () => {
      await runScenario(async ({ app }) => {
        const user = await signUpFixture(app);
        const observer = await signUpFixture(app);
        const client = authorizedRequest(app, user.accessToken);
        expect(
          (await client.delete('/api/v1/users/123e4567-e89b-12d3-a456-426614174000').expect(400)).body,
        ).toMatchObject(badRequest);
        const missing = '/api/v1/users/123e4567-e89b-42d3-a456-426614174001';
        expect((await client.delete(missing).expect(404)).body).toEqual(notFound);
        const deleted = await client.delete(`/api/v1/users/${user.id}`).expect(204);
        expect(deleted.text).toBe('');
        expect(deleted.headers['x-request-id']).toMatch(UUID_V4);
        expect((await client.get('/api/v1/users/me').expect(401)).body).toMatchObject({ code: 'UNAUTHORIZED' });
        expect(
          (await authorizedRequest(app, observer.accessToken).get(`/api/v1/users/${user.id}`).expect(404)).body,
        ).toEqual(notFound);
      }, options);
    });

    it('updates and deletes an HTTP-registered fixture while cascading sessions and refresh digests', async () => {
      await runScenario(async ({ app }) => {
        const user = await signUpFixture(app);
        const observer = await signUpFixture(app);
        const client = authorizedRequest(app, user.accessToken);
        const prisma = app.get(PrismaService);
        const before = await client.get(`/api/v1/users/${user.id}`).expect(200);
        const changed = await client.patch(`/api/v1/users/${user.id}`).send({ displayName: 'Ada Byron' }).expect(200);
        expect(changed.body).toMatchObject({ id: user.id, displayName: 'Ada Byron', createdAt: before.body.createdAt });
        expect(changed.body.updatedAt).not.toBe(before.body.updatedAt);
        expect(changed.body.role).toBe('user');
        await client.patch(`/api/v1/users/${user.id}`).send({ role: 'admin', displayName: 'Ada Byron' }).expect(400);
        const sessionsBefore = await prisma.session.findMany({
          where: { userId: user.id },
          select: { id: true, digests: { select: { digest: true } } },
        });
        const digestIds = sessionsBefore.flatMap((session) => session.digests.map(({ digest }) => digest));
        expect(sessionsBefore.length).toBeGreaterThan(0);
        expect(digestIds.length).toBeGreaterThan(0);

        await client.delete(`/api/v1/users/${user.id}`).expect(204);

        expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
        expect(await prisma.refreshDigest.count({ where: { digest: { in: digestIds } } })).toBe(0);
        expect(
          (await authorizedRequest(app, observer.accessToken).get(`/api/v1/users/${user.id}`).expect(404)).body,
        ).toEqual(notFound);
      }, options);
    });

    it('rolls back owner deletion when cascading session deletion fails', async () => {
      await runScenario(async ({ app }) => {
        const email = `${randomUUID()}@example.test`;
        const signup = await request(app.getHttpServer())
          .post('/api/v1/auth/sign-up')
          .send({ email, displayName: 'Test User', password: 'test fixture password' })
          .expect(201);
        const prisma = app.get(PrismaService);
        const user = await prisma.user.findUniqueOrThrow({
          where: { email },
          select: { id: true, passwordHash: true },
        });
        const digest = createHash('sha256')
          .update(signup.body.refreshToken as string)
          .digest('hex');
        const sessionBefore = await prisma.session.findFirstOrThrow({
          where: { userId: user.id },
          include: { digests: true },
        });
        expect(sessionBefore.digests.some((entry) => entry.digest === digest)).toBe(true);

        try {
          await prisma.$executeRawUnsafe(`
            CREATE FUNCTION e2e_reject_session_delete() RETURNS trigger
            LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced session deletion failure'; END; $$
          `);
          await prisma.$executeRawUnsafe(`
            CREATE TRIGGER e2e_reject_session_delete
            BEFORE DELETE ON sessions
            FOR EACH ROW EXECUTE FUNCTION e2e_reject_session_delete()
          `);
          const failed = await authorizedRequest(app, signup.body.accessToken as string)
            .delete(`/api/v1/users/${user.id}`)
            .expect(500);
          expect(failed.body).toEqual({
            statusCode: 500,
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred.',
            requestId: expect.stringMatching(UUID_V4),
          });
          expect(failed.text).not.toContain('forced session deletion failure');
          expect(failed.text).not.toContain('e2e_reject_session_delete');

          const userAfter = await prisma.user.findUniqueOrThrow({
            where: { id: user.id },
            select: { id: true, passwordHash: true },
          });
          const sessionAfter = await prisma.session.findUniqueOrThrow({
            where: { id: sessionBefore.id },
            include: { digests: true },
          });
          expect(userAfter).toEqual(user);
          expect(sessionAfter).toEqual(sessionBefore);
          expect(sessionAfter.digests).toContainEqual(expect.objectContaining({ digest }));
          await authorizedRequest(app, signup.body.accessToken as string)
            .get('/api/v1/users/me')
            .expect(200);
        } finally {
          await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS e2e_reject_session_delete ON sessions');
          await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS e2e_reject_session_delete()');
        }
      }, options);
    });
  });
}
