import { randomUUID } from 'node:crypto';
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
const conflict = {
  statusCode: 409,
  code: 'CONFLICT',
  message: 'The request conflicts with the current resource state.',
  requestId: expect.stringMatching(UUID_V4),
};

const options = {
  application: { rateLimitConfig: buildRateLimitConfig({ THROTTLE_LIMIT: 100, THROTTLE_TTL_SECONDS: 60 }) },
};

export function registerCreateUserE2ESuite({ runScenario }: E2ESuiteRegistration): void {
  describe('Users HTTP regression after moving creation to Auth', () => {
    it('does not expose legacy POST /users, including with valid former input', async () => {
      await runScenario(async ({ app }) => {
        await request(app.getHttpServer())
          .post('/api/v1/users')
          .send({ email: `${randomUUID()}@example.test`, displayName: 'Ada Lovelace' })
          .expect(404);
      });
    });

    it('retrieves registered users and retains normalized exact-email filtering and strict query', async () => {
      await runScenario(async ({ app }) => {
        const first = await signUpFixture(app, 'Ada Lovelace');
        await signUpFixture(app, 'Grace Hopper');
        const fetched = await request(app.getHttpServer()).get(`/api/v1/users/${first.id}`).expect(200);
        expect(fetched.headers['x-request-id']).toMatch(UUID_V4);
        expect(fetched.body).toEqual({
          id: first.id,
          email: first.email,
          displayName: 'Ada Lovelace',
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        });
        const filtered = await request(app.getHttpServer())
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
          const invalid = await request(app.getHttpServer()).get(`/api/v1/users?${query}`).expect(400);
          expect(invalid.body).toMatchObject(badRequest);
        }
        expect((await request(app.getHttpServer()).get('/api/v1/users/not-a-uuid').expect(400)).body).toMatchObject(
          badRequest,
        );
        expect(
          (await request(app.getHttpServer()).get('/api/v1/users/123e4567-e89b-42d3-a456-426614174001').expect(404))
            .body,
        ).toEqual(notFound);
        const structured = await new Test(app.getHttpServer(), 'QUERY', '/api/v1/users')
          .send({ criteria: { email: first.email.toUpperCase() } })
          .expect(200);
        expect(structured.body.data.map((user: { id: string }) => user.id)).toEqual([first.id]);
        await new Test(app.getHttpServer(), 'QUERY', '/api/v1/users')
          .send({ criteria: { email: first.email, displayName: 'Ada' } })
          .expect(400);
      }, options);
    });

    it('preserves list ordering, cursor navigation and strict cursor rejection', async () => {
      await runScenario(async ({ app }) => {
        const ids = [];
        for (const name of ['Ada Lovelace', 'Ada Lovelace', 'Grace Hopper']) {
          ids.push((await signUpFixture(app, name)).id);
        }
        const first = await request(app.getHttpServer())
          .get('/api/v1/users?sort=displayName&direction=asc&limit=1')
          .expect(200);
        const tiedIds = ids.slice(0, 2).sort();
        expect(first.headers['x-request-id']).toMatch(UUID_V4);
        expect(first.body.data).toEqual([
          {
            id: tiedIds[0],
            email: expect.any(String),
            displayName: 'Ada Lovelace',
            createdAt: expect.stringMatching(ISO_TIMESTAMP),
            updatedAt: expect.stringMatching(ISO_TIMESTAMP),
          },
        ]);
        expect(first.body.pageInfo).toEqual({
          hasNextPage: true,
          hasPreviousPage: false,
          nextCursor: expect.any(String),
          previousCursor: null,
        });
        const second = await request(app.getHttpServer())
          .get(`/api/v1/users?sort=displayName&direction=asc&limit=1&after=${first.body.pageInfo.nextCursor}`)
          .expect(200);
        expect(second.body.data[0].id).toBe(tiedIds[1]);
        expect(second.body.pageInfo).toEqual({
          hasNextPage: true,
          hasPreviousPage: true,
          nextCursor: expect.any(String),
          previousCursor: expect.any(String),
        });
        const backward = await request(app.getHttpServer())
          .get(`/api/v1/users?sort=displayName&direction=asc&limit=1&before=${second.body.pageInfo.previousCursor}`)
          .expect(200);
        expect(backward.body).toEqual(first.body);
        const third = await request(app.getHttpServer())
          .get(`/api/v1/users?sort=displayName&direction=asc&limit=1&after=${second.body.pageInfo.nextCursor}`)
          .expect(200);
        expect(third.body.data[0].displayName).toBe('Grace Hopper');
        expect(third.body.pageInfo).toEqual({
          hasNextPage: false,
          hasPreviousPage: true,
          nextCursor: null,
          previousCursor: expect.any(String),
        });
        const all = await request(app.getHttpServer()).get('/api/v1/users?sort=createdAt&direction=desc').expect(200);
        expect(all.body.data.map((user: { id: string }) => user.id).sort()).toEqual(ids.sort());
        expect(
          (
            await request(app.getHttpServer())
              .get(`/api/v1/users?sort=createdAt&after=${first.body.pageInfo.nextCursor}`)
              .expect(400)
          ).body,
        ).toMatchObject(badRequest);
      }, options);
    });

    it('preserves all four list sort directions, tie breaking, and empty-page flags', async () => {
      await runScenario(async ({ app }) => {
        const users = [];
        for (const name of ['Ada Lovelace', 'Ada Lovelace', 'Ada Lovelace', 'Grace Hopper']) {
          users.push(await signUpFixture(app, name));
        }
        for (const sort of ['createdAt', 'displayName']) {
          for (const direction of ['asc', 'desc']) {
            const response = await request(app.getHttpServer())
              .get(`/api/v1/users?sort=${sort}&direction=${direction}&limit=25`)
              .expect(200);
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
        const tied = await request(app.getHttpServer()).get('/api/v1/users?sort=displayName&direction=asc').expect(200);
        expect(tied.body.data.slice(0, 3).map((user: { id: string }) => user.id)).toEqual(
          users
            .slice(0, 3)
            .map((user) => user.id)
            .sort(),
        );
        const empty = await request(app.getHttpServer()).get('/api/v1/users?email=nobody@example.test').expect(200);
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
        const page = await request(app.getHttpServer()).get('/api/v1/users?limit=1').expect(200);
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
          await request(app.getHttpServer()).get(`/api/v1/users?${query}`).expect(400);
        }
        const crossFilter = await request(app.getHttpServer())
          .get(`/api/v1/users?email=nobody@example.test&after=${cursor}`)
          .expect(200);
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
        const body = { criteria: { email: user.email }, sort: 'displayName', direction: 'asc', limit: 1 };
        const first = await new Test(app.getHttpServer(), 'QUERY', '/api/v1/users').send(body).expect(200);
        const repeated = await new Test(app.getHttpServer(), 'QUERY', '/api/v1/users').send(body).expect(200);
        expect(first.headers['x-request-id']).toMatch(UUID_V4);
        expect(repeated.body).toEqual(first.body);
        const fetched = await request(app.getHttpServer()).get(`/api/v1/users/${user.id}`).expect(200);
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
          const response = await new Test(app.getHttpServer(), 'QUERY', '/api/v1/users').send(invalid).expect(400);
          expect(response.body).toMatchObject(badRequest);
        }
        await new Test(app.getHttpServer(), 'QUERY', '/api/v1/users?limit=1').send(body).expect(400);
        await signUpFixture(app);
        const page = await request(app.getHttpServer()).get('/api/v1/users?limit=1').expect(200);
        const after = page.body.pageInfo.nextCursor;
        const valid = { criteria: { email: user.email } };
        const crossFilter = await new Test(app.getHttpServer(), 'QUERY', '/api/v1/users')
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
        await new Test(app.getHttpServer(), 'QUERY', '/api/v1/users').send({ ...valid, after: legacy }).expect(400);
      }, options);
    });

    it('retains the intermediate no-op update and normalized email conflict behavior pending R4', async () => {
      await runScenario(async ({ app }) => {
        const user = await signUpFixture(app);
        const other = await signUpFixture(app);
        const before = await request(app.getHttpServer()).get(`/api/v1/users/${user.id}`).expect(200);
        const noop = await request(app.getHttpServer())
          .patch(`/api/v1/users/${user.id}`)
          .send({ displayName: before.body.displayName })
          .expect(200);
        expect(noop.body).toEqual(before.body);
        const updated = await request(app.getHttpServer())
          .patch(`/api/v1/users/${user.id}`)
          .send({ email: ` ${user.email.toUpperCase()} ` })
          .expect(200);
        expect(updated.body).toEqual(before.body);
        const renamed = await request(app.getHttpServer())
          .patch(`/api/v1/users/${user.id}`)
          .send({ email: ' Ada.Byron@Example.COM ' })
          .expect(200);
        expect(renamed.body).toEqual({
          ...before.body,
          email: 'ada.byron@example.com',
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        });
        expect(renamed.body.updatedAt).not.toBe(before.body.updatedAt);
        const conflictResponse = await request(app.getHttpServer())
          .patch(`/api/v1/users/${user.id}`)
          .send({ email: ` ${other.email.toUpperCase()} ` })
          .expect(409);
        expect(conflictResponse.body).toEqual(conflict);
        expect(
          (
            await request(app.getHttpServer())
              .patch('/api/v1/users/123e4567-e89b-42d3-a456-426614174001')
              .send({ displayName: 'Ada Byron' })
              .expect(404)
          ).body,
        ).toEqual(notFound);
        for (const [id, invalid] of [
          ['not-a-uuid', { displayName: 'Ada Byron' }],
          [user.id, null],
          [user.id, {}],
          [user.id, { id: 'client-id' }],
          [user.id, { email: 'not-an-email' }],
          [user.id, { role: 'admin' }],
          [user.id, { displayName: 'Ada  Byron' }],
        ] as const) {
          const response = await request(app.getHttpServer()).patch(`/api/v1/users/${id}`).send(invalid).expect(400);
          expect(response.body).toMatchObject(badRequest);
        }
      }, options);
    });

    it('rejects malformed and repeated deletion with the resource-not-found contract', async () => {
      await runScenario(async ({ app }) => {
        expect(
          (await request(app.getHttpServer()).delete('/api/v1/users/123e4567-e89b-12d3-a456-426614174000').expect(400))
            .body,
        ).toMatchObject(badRequest);
        const missing = '/api/v1/users/123e4567-e89b-42d3-a456-426614174001';
        expect((await request(app.getHttpServer()).delete(missing).expect(404)).body).toEqual(notFound);
        const user = await signUpFixture(app);
        const deleted = await request(app.getHttpServer()).delete(`/api/v1/users/${user.id}`).expect(204);
        expect(deleted.text).toBe('');
        expect(deleted.headers['x-request-id']).toMatch(UUID_V4);
        expect((await request(app.getHttpServer()).delete(`/api/v1/users/${user.id}`).expect(404)).body).toEqual(
          notFound,
        );
      }, options);
    });

    it('updates and deletes an HTTP-registered fixture while preserving database cascade', async () => {
      await runScenario(async ({ app }) => {
        const user = await signUpFixture(app);
        const before = await request(app.getHttpServer()).get(`/api/v1/users/${user.id}`).expect(200);
        const changed = await request(app.getHttpServer())
          .patch(`/api/v1/users/${user.id}`)
          .send({ displayName: 'Ada Byron' })
          .expect(200);
        expect(changed.body).toMatchObject({ id: user.id, displayName: 'Ada Byron', createdAt: before.body.createdAt });
        expect(changed.body.updatedAt).not.toBe(before.body.updatedAt);
        await request(app.getHttpServer()).patch(`/api/v1/users/${user.id}`).send({ role: 'admin' }).expect(400);
        await request(app.getHttpServer()).delete(`/api/v1/users/${user.id}`).expect(204);
        expect(await app.get(PrismaService).session.count({ where: { userId: user.id } })).toBe(0);
        expect((await request(app.getHttpServer()).get(`/api/v1/users/${user.id}`).expect(404)).body).toEqual(notFound);
      }, options);
    });
  });
}
