import request from 'supertest';
import { Test } from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildRateLimitConfig } from '../../../src/config/rate-limit.config.js';
import type { E2ESuiteRegistration } from '../../support/e2e-context.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function createPayload() {
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    email: ` Ada.Lovelace+${unique}@Example.COM `,
    displayName: ' Ada Lovelace ',
  };
}

export function registerCreateUserE2ESuite(registration: E2ESuiteRegistration): void {
  describe('POST /api/v1/users (e2e)', () => {
    it('creates a normalized public user with system-generated fields and a resource Location', async () => {
      await registration.runScenario(async ({ app }) => {
        const payload = createPayload();
        const response = await request(app.getHttpServer()).post('/api/v1/users').send(payload).expect(201);

        expect(response.headers.location).toBe(`/api/v1/users/${response.body.id}`);
        expect(response.headers['x-request-id']).toMatch(UUID_V4);
        expect(response.body).toEqual({
          id: expect.stringMatching(UUID_V4),
          email: payload.email.trim().toLowerCase(),
          displayName: payload.displayName.trim(),
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        });
        expect(response.body).not.toHaveProperty('password');
        expect(response.body).not.toHaveProperty('passwordHash');
      });
    });

    it('retrieves a public user by canonical UUIDv4', async () => {
      await registration.runScenario(async ({ app }) => {
        const payload = createPayload();
        const created = await request(app.getHttpServer()).post('/api/v1/users').send(payload).expect(201);
        const response = await request(app.getHttpServer()).get(`/api/v1/users/${created.body.id}`).expect(200);

        expect(response.body).toEqual({
          id: created.body.id,
          email: payload.email.trim().toLowerCase(),
          displayName: payload.displayName.trim(),
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        });
        expect(response.body).not.toHaveProperty('password');
        expect(response.body).not.toHaveProperty('passwordHash');
      });
    });

    it('rejects a non-canonical user ID with the shared 400 contract', async () => {
      await registration.runScenario(async ({ app }) => {
        const response = await request(app.getHttpServer()).get('/api/v1/users/not-a-uuid').expect(400);

        expect(response.body).toMatchObject({
          statusCode: 400,
          code: 'BAD_REQUEST',
          message: 'The request is invalid.',
        });
      });
    });

    it('returns the shared 404 resource-not-found contract for an unknown UUIDv4', async () => {
      await registration.runScenario(async ({ app }) => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/users/123e4567-e89b-42d3-a456-426614174001')
          .expect(404);

        expect(response.body).toEqual({
          statusCode: 404,
          code: 'RESOURCE_NOT_FOUND',
          message: 'The requested resource was not found.',
          requestId: expect.stringMatching(UUID_V4),
        });
      });
    });

    it('returns the shared 409 conflict contract for a normalized duplicate email', async () => {
      await registration.runScenario(async ({ app }) => {
        const payload = createPayload();
        await request(app.getHttpServer()).post('/api/v1/users').send(payload).expect(201);
        const response = await request(app.getHttpServer())
          .post('/api/v1/users')
          .send({ ...payload, email: `  ${payload.email.trim().toUpperCase()}  ` })
          .expect(409);

        expect(response.body).toEqual({
          statusCode: 409,
          code: 'CONFLICT',
          message: 'The request conflicts with the current resource state.',
          requestId: expect.stringMatching(UUID_V4),
        });
      });
    });

    it.each([
      { ...createPayload(), displayName: 'Ada  Lovelace' },
      { ...createPayload(), id: 'client-id' },
      { ...createPayload(), createdAt: '2026-01-01T00:00:00.000Z' },
      { ...createPayload(), updatedAt: '2026-01-01T00:00:00.000Z' },
    ])('rejects invalid or client-managed input %#', async (payload) => {
      await registration.runScenario(async ({ app }) => {
        const response = await request(app.getHttpServer()).post('/api/v1/users').send(payload).expect(400);

        expect(response.body).toMatchObject({
          statusCode: 400,
          code: 'BAD_REQUEST',
          message: 'The request is invalid.',
        });
      });
    });
  });

  describe('GET /api/v1/users (e2e)', () => {
    const listScenarioOptions = {
      application: {
        rateLimitConfig: buildRateLimitConfig({
          THROTTLE_LIMIT: '100',
          THROTTLE_TTL_SECONDS: '60',
        }),
      },
    };

    it('lists exact normalized-email matches and rejects unsupported query shapes', async () => {
      await registration.runScenario(async ({ app }) => {
        const first = await request(app.getHttpServer()).post('/api/v1/users').send(createPayload()).expect(201);
        await request(app.getHttpServer()).post('/api/v1/users').send(createPayload()).expect(201);

        const filtered = await request(app.getHttpServer())
          .get(`/api/v1/users?email=${encodeURIComponent(` ${first.body.email.toUpperCase()} `)}`)
          .expect(200);
        expect(filtered.body.data).toHaveLength(1);
        expect(filtered.body.data[0]).toMatchObject({ id: first.body.id, email: first.body.email });
        expect(filtered.body.pageInfo).toEqual({
          nextCursor: null,
          previousCursor: null,
          hasNextPage: false,
          hasPreviousPage: false,
        });

        for (const query of ['displayName=Ada', 'limit=0', 'sort=email', 'after=a&before=b', 'limit=1&limit=2']) {
          await request(app.getHttpServer()).get(`/api/v1/users?${query}`).expect(400);
        }
      }, listScenarioOptions);
    });

    it('paginates every public sort order deterministically and serializes only public rows', async () => {
      await registration.runScenario(async ({ app }) => {
        const created = [];
        for (const displayName of ['Ada Lovelace', 'Ada Lovelace', 'Ada Lovelace', 'Grace Hopper']) {
          const response = await request(app.getHttpServer())
            .post('/api/v1/users')
            .send({ ...createPayload(), displayName })
            .expect(201);
          created.push(response.body);
        }
        const tiedIds = created
          .slice(0, 3)
          .map((user) => user.id)
          .sort();

        for (const [sort, direction] of [
          ['createdAt', 'asc'],
          ['createdAt', 'desc'],
          ['displayName', 'asc'],
          ['displayName', 'desc'],
        ]) {
          const page = await request(app.getHttpServer())
            .get(`/api/v1/users?sort=${sort}&direction=${direction}&limit=25`)
            .expect(200);
          expect(page.body.data).toHaveLength(4);
          const values = page.body.data.map((user: { createdAt: string; displayName: string; id: string }) =>
            sort === 'createdAt' ? user.createdAt : user.displayName,
          );
          const expected = [...values].sort((left, right) =>
            direction === 'asc' ? left.localeCompare(right) : right.localeCompare(left),
          );
          expect(values).toEqual(expected);
        }

        const first = await request(app.getHttpServer())
          .get('/api/v1/users?sort=displayName&direction=asc&limit=1')
          .expect(200);
        expect(first.body.data).toEqual([
          {
            id: tiedIds[0],
            email: created.find((user) => user.id === tiedIds[0]).email,
            displayName: 'Ada Lovelace',
            createdAt: expect.stringMatching(ISO_TIMESTAMP),
            updatedAt: expect.stringMatching(ISO_TIMESTAMP),
          },
        ]);
        expect(first.body.data[0]).not.toHaveProperty('password');
        expect(first.body.data[0]).not.toHaveProperty('passwordHash');
        expect(first.body.pageInfo).toEqual({
          hasNextPage: true,
          hasPreviousPage: false,
          nextCursor: expect.any(String),
          previousCursor: null,
        });

        const intermediate = await request(app.getHttpServer())
          .get(`/api/v1/users?sort=displayName&direction=asc&limit=1&after=${first.body.pageInfo.nextCursor}`)
          .expect(200);
        expect(intermediate.body.data[0].id).toBe(tiedIds[1]);
        expect(intermediate.body.pageInfo).toEqual({
          hasNextPage: true,
          hasPreviousPage: true,
          nextCursor: expect.any(String),
          previousCursor: expect.any(String),
        });

        const backward = await request(app.getHttpServer())
          .get(
            `/api/v1/users?sort=displayName&direction=asc&limit=1&before=${intermediate.body.pageInfo.previousCursor}`,
          )
          .expect(200);
        expect(backward.body).toEqual(first.body);

        const third = await request(app.getHttpServer())
          .get(`/api/v1/users?sort=displayName&direction=asc&limit=1&after=${intermediate.body.pageInfo.nextCursor}`)
          .expect(200);
        const last = await request(app.getHttpServer())
          .get(`/api/v1/users?sort=displayName&direction=asc&limit=1&after=${third.body.pageInfo.nextCursor}`)
          .expect(200);
        expect(last.body.data[0].displayName).toBe('Grace Hopper');
        expect(last.body.pageInfo).toEqual({
          hasNextPage: false,
          hasPreviousPage: true,
          nextCursor: null,
          previousCursor: expect.any(String),
        });

        const empty = await request(app.getHttpServer()).get('/api/v1/users?email=nobody@example.com').expect(200);
        expect(empty.body).toEqual({
          data: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            nextCursor: null,
            previousCursor: null,
          },
        });
      }, listScenarioOptions);
    });

    it('rejects malformed, oversized, context-mismatched, and repeated list query values', async () => {
      await registration.runScenario(async ({ app }) => {
        const created = await request(app.getHttpServer()).post('/api/v1/users').send(createPayload()).expect(201);
        await request(app.getHttpServer()).post('/api/v1/users').send(createPayload()).expect(201);
        const page = await request(app.getHttpServer()).get('/api/v1/users?limit=1').expect(200);
        const cursor = page.body.pageInfo.nextCursor;
        const crossFilter = await request(app.getHttpServer())
          .get(`/api/v1/users?email=other@example.com&after=${cursor}`)
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

        const legacyCursor = Buffer.from(
          JSON.stringify({
            v: 1,
            email: created.body.email,
            sort: 'createdAt',
            direction: 'desc',
            position: {
              id: page.body.data[0].id,
              createdAt: page.body.data[0].createdAt,
            },
          }),
          'utf8',
        ).toString('base64url');

        for (const query of [
          'after=not-base64!',
          `after=${'a'.repeat(1025)}`,
          `sort=displayName&after=${cursor}`,
          `direction=asc&after=${cursor}`,
          `after=${legacyCursor}`,
          `email=${created.body.email}&email=other@example.com`,
          'sort=createdAt&sort=displayName',
          'direction=asc&direction=desc',
          `after=${cursor}&after=${cursor}`,
          `before=${cursor}&before=${cursor}`,
        ]) {
          await request(app.getHttpServer()).get(`/api/v1/users?${query}`).expect(400);
        }
      }, listScenarioOptions);
    });
  });

  describe('QUERY /api/v1/users (e2e)', () => {
    const queryScenarioOptions = {
      application: {
        rateLimitConfig: buildRateLimitConfig({
          THROTTLE_LIMIT: '100',
          THROTTLE_TTL_SECONDS: '60',
        }),
      },
    };

    it('normalizes exact email criteria and is safe and idempotent', async () => {
      await registration.runScenario(async ({ app }) => {
        const payload = createPayload();
        const created = await request(app.getHttpServer()).post('/api/v1/users').send(payload).expect(201);
        const body = {
          criteria: { email: ` ${created.body.email.toUpperCase()} ` },
          sort: 'displayName',
          direction: 'asc',
          limit: 1,
        };
        const first = await new Test(app.getHttpServer(), 'QUERY', '/api/v1/users').send(body).expect(200);
        const repeated = await new Test(app.getHttpServer(), 'QUERY', '/api/v1/users').send(body).expect(200);

        expect(first.headers['x-request-id']).toMatch(UUID_V4);
        expect(first.body).toEqual(repeated.body);
        expect(first.body).toEqual({
          data: [
            {
              id: created.body.id,
              email: created.body.email,
              displayName: created.body.displayName,
              createdAt: created.body.createdAt,
              updatedAt: created.body.updatedAt,
            },
          ],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            nextCursor: null,
            previousCursor: null,
          },
        });
        expect(first.body.data[0]).not.toHaveProperty('password');
        expect(first.body.data[0]).not.toHaveProperty('passwordHash');

        await request(app.getHttpServer()).get(`/api/v1/users/${created.body.id}`).expect(200);
      }, queryScenarioOptions);
    });

    it('accepts cross-filter cursors and rejects invalid bodies, legacy cursors, and URL query parameters', async () => {
      await registration.runScenario(async ({ app }) => {
        const created = await request(app.getHttpServer()).post('/api/v1/users').send(createPayload()).expect(201);
        await request(app.getHttpServer()).post('/api/v1/users').send(createPayload()).expect(201);
        const listPage = await request(app.getHttpServer()).get('/api/v1/users?limit=1').expect(200);
        const crossFilterCursor = listPage.body.pageInfo.nextCursor;
        const valid = { criteria: { email: created.body.email } };
        const crossFilter = await new Test(app.getHttpServer(), 'QUERY', '/api/v1/users')
          .send({ ...valid, after: crossFilterCursor })
          .expect(200);
        expect(crossFilter.body.data.every((user: { email: string }) => user.email === created.body.email)).toBe(true);

        const legacyCursor = Buffer.from(
          JSON.stringify({
            v: 1,
            email: created.body.email,
            sort: 'createdAt',
            direction: 'desc',
            position: {
              id: listPage.body.data[0].id,
              createdAt: listPage.body.data[0].createdAt,
            },
          }),
          'utf8',
        ).toString('base64url');

        for (const body of [
          null,
          [],
          {},
          { criteria: null },
          { criteria: [] },
          { criteria: {} },
          { criteria: { email: null } },
          { criteria: { email: created.body.email, displayName: 'Ada' } },
          { ...valid, unknown: true },
          { ...valid, after: 'a', before: 'b' },
          { ...valid, after: legacyCursor },
        ]) {
          await new Test(app.getHttpServer(), 'QUERY', '/api/v1/users').send(body).expect(400);
        }

        await new Test(app.getHttpServer(), 'QUERY', '/api/v1/users?limit=1').send(valid).expect(400);
      }, queryScenarioOptions);
    });
  });

  describe('PATCH /api/v1/users/:userId (e2e)', () => {
    const updateScenarioOptions = {
      application: {
        rateLimitConfig: buildRateLimitConfig({
          THROTTLE_LIMIT: '100',
          THROTTLE_TTL_SECONDS: '60',
        }),
      },
    };

    it('updates supplied normalized fields and preserves omitted and system-managed fields', async () => {
      await registration.runScenario(async ({ app }) => {
        const created = await request(app.getHttpServer()).post('/api/v1/users').send(createPayload()).expect(201);
        const response = await request(app.getHttpServer())
          .patch(`/api/v1/users/${created.body.id}`)
          .send({ email: ' Ada.Byron@Example.COM ' })
          .expect(200);

        expect(response.body).toEqual({
          id: created.body.id,
          email: 'ada.byron@example.com',
          displayName: created.body.displayName,
          createdAt: created.body.createdAt,
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        });
        expect(response.body.updatedAt).not.toBe(created.body.updatedAt);
      }, updateScenarioOptions);
    });

    it('returns a public user without advancing updatedAt for a no-op update', async () => {
      await registration.runScenario(async ({ app }) => {
        const created = await request(app.getHttpServer()).post('/api/v1/users').send(createPayload()).expect(201);
        const response = await request(app.getHttpServer())
          .patch(`/api/v1/users/${created.body.id}`)
          .send({ displayName: created.body.displayName })
          .expect(200);

        expect(response.body).toEqual(created.body);
      }, updateScenarioOptions);
    });

    it.each([
      ['not-a-uuid', { displayName: 'Ada Byron' }],
      ['123e4567-e89b-42d3-a456-426614174001', null],
      ['123e4567-e89b-42d3-a456-426614174001', {}],
      ['123e4567-e89b-42d3-a456-426614174001', { id: 'client-id' }],
      ['123e4567-e89b-42d3-a456-426614174001', { email: 'not-an-email' }],
    ])('rejects invalid path or body input %#', async (userId, body) => {
      await registration.runScenario(async ({ app }) => {
        const response = await request(app.getHttpServer()).patch(`/api/v1/users/${userId}`).send(body).expect(400);

        expect(response.body).toMatchObject({
          statusCode: 400,
          code: 'BAD_REQUEST',
          message: 'The request is invalid.',
        });
      }, updateScenarioOptions);
    });

    it('returns resource-not-found for an unknown user and conflict for a normalized duplicate email', async () => {
      await registration.runScenario(async ({ app }) => {
        await request(app.getHttpServer())
          .patch('/api/v1/users/123e4567-e89b-42d3-a456-426614174001')
          .send({ displayName: 'Ada Byron' })
          .expect(404);

        const first = await request(app.getHttpServer()).post('/api/v1/users').send(createPayload()).expect(201);
        const second = await request(app.getHttpServer()).post('/api/v1/users').send(createPayload()).expect(201);
        const response = await request(app.getHttpServer())
          .patch(`/api/v1/users/${first.body.id}`)
          .send({ email: ` ${second.body.email.toUpperCase()} ` })
          .expect(409);

        expect(response.body).toEqual({
          statusCode: 409,
          code: 'CONFLICT',
          message: 'The request conflicts with the current resource state.',
          requestId: expect.stringMatching(UUID_V4),
        });
      }, updateScenarioOptions);
    });
  });

  describe('DELETE /api/v1/users/:userId (e2e)', () => {
    const deleteScenarioOptions = {
      application: {
        rateLimitConfig: buildRateLimitConfig({
          THROTTLE_LIMIT: '100',
          THROTTLE_TTL_SECONDS: '60',
        }),
      },
    };

    it('physically deletes a user with an empty 204 response and no longer retrieves it', async () => {
      await registration.runScenario(async ({ app }) => {
        const created = await request(app.getHttpServer()).post('/api/v1/users').send(createPayload()).expect(201);
        const response = await request(app.getHttpServer()).delete(`/api/v1/users/${created.body.id}`).expect(204);

        expect(response.text).toBe('');
        expect(response.headers['x-request-id']).toMatch(UUID_V4);

        const fetched = await request(app.getHttpServer()).get(`/api/v1/users/${created.body.id}`).expect(404);
        expect(fetched.body).toEqual({
          statusCode: 404,
          code: 'RESOURCE_NOT_FOUND',
          message: 'The requested resource was not found.',
          requestId: expect.stringMatching(UUID_V4),
        });
      }, deleteScenarioOptions);
    });

    it('rejects a non-canonical user ID with the shared 400 contract', async () => {
      await registration.runScenario(async ({ app }) => {
        const response = await request(app.getHttpServer())
          .delete('/api/v1/users/123e4567-e89b-12d3-a456-426614174000')
          .expect(400);

        expect(response.body).toMatchObject({
          statusCode: 400,
          code: 'BAD_REQUEST',
          message: 'The request is invalid.',
        });
      }, deleteScenarioOptions);
    });

    it('returns resource-not-found for missing and repeated deletes', async () => {
      await registration.runScenario(async ({ app }) => {
        const missing = await request(app.getHttpServer())
          .delete('/api/v1/users/123e4567-e89b-42d3-a456-426614174001')
          .expect(404);
        expect(missing.body).toEqual({
          statusCode: 404,
          code: 'RESOURCE_NOT_FOUND',
          message: 'The requested resource was not found.',
          requestId: expect.stringMatching(UUID_V4),
        });

        const created = await request(app.getHttpServer()).post('/api/v1/users').send(createPayload()).expect(201);
        await request(app.getHttpServer()).delete(`/api/v1/users/${created.body.id}`).expect(204);
        const repeated = await request(app.getHttpServer()).delete(`/api/v1/users/${created.body.id}`).expect(404);

        expect(repeated.body).toEqual({
          statusCode: 404,
          code: 'RESOURCE_NOT_FOUND',
          message: 'The requested resource was not found.',
          requestId: expect.stringMatching(UUID_V4),
        });
      }, deleteScenarioOptions);
    });
  });
}
