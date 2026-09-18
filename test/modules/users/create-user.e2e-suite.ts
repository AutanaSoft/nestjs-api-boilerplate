import request from 'supertest';
import { describe, expect, it } from 'vitest';
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
}
