import request from 'supertest';
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
        const response = await request(app.getHttpServer())
          .post('/api/v1/users')
          .send(payload)
          .expect(201);

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
        const created = await request(app.getHttpServer())
          .post('/api/v1/users')
          .send(payload)
          .expect(201);
        const response = await request(app.getHttpServer())
          .get(`/api/v1/users/${created.body.id}`)
          .expect(200);

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
        const response = await request(app.getHttpServer())
          .get('/api/v1/users/not-a-uuid')
          .expect(400);

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
        const response = await request(app.getHttpServer())
          .post('/api/v1/users')
          .send(payload)
          .expect(400);

        expect(response.body).toMatchObject({
          statusCode: 400,
          code: 'BAD_REQUEST',
          message: 'The request is invalid.',
        });
      });
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
        const created = await request(app.getHttpServer())
          .post('/api/v1/users')
          .send(createPayload())
          .expect(201);
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
        const created = await request(app.getHttpServer())
          .post('/api/v1/users')
          .send(createPayload())
          .expect(201);
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
        const response = await request(app.getHttpServer())
          .patch(`/api/v1/users/${userId}`)
          .send(body)
          .expect(400);

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

        const first = await request(app.getHttpServer())
          .post('/api/v1/users')
          .send(createPayload())
          .expect(201);
        const second = await request(app.getHttpServer())
          .post('/api/v1/users')
          .send(createPayload())
          .expect(201);
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
}
