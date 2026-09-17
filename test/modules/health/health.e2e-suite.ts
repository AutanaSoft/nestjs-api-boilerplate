import request from 'supertest';
import { vi } from 'vitest';
import { StructuredLoggerService } from '../../../src/common/observability/logging/logger.service.js';
import { buildApiConfig } from '../../../src/config/api.config.js';
import type { E2ESuiteRegistration } from '../../support/e2e-context.js';

const DEFAULT_HEALTH_PATHS = ['/api/v1/health/live', '/api/v1/health/ready'];
const UNPREFIXED_HEALTH_PATHS = ['/v1/health/live', '/v1/health/ready'];
const CANONICAL_UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const HEALTH_CHECK_RESPONSE = {
  status: 'ok',
  info: {},
  error: {},
  details: {},
};

export function registerHealthE2ESuite(registration: E2ESuiteRegistration): void {
  describe('HealthController (e2e)', () => {
    it.each(DEFAULT_HEALTH_PATHS)(
      '%s returns the Terminus contract with Helmet headers',
      async (path) => {
        await registration.runScenario(async ({ app }) => {
          const response = await request(app.getHttpServer()).get(path).expect(200);

          expect(response.body).toEqual(HEALTH_CHECK_RESPONSE);
          expect(response.headers['x-content-type-options']).toBe('nosniff');
          expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
        });
      },
    );

    it('allows configured CORS origins and denies unconfigured origins', async () => {
      await registration.runScenario(async ({ app }) => {
        const allowed = await request(app.getHttpServer())
          .get('/api/v1/health/live')
          .set('Origin', 'https://allowed.example')
          .expect(200);
        const denied = await request(app.getHttpServer())
          .get('/api/v1/health/live')
          .set('Origin', 'https://denied.example')
          .expect(200);

        expect(allowed.headers['access-control-allow-origin']).toBe('https://allowed.example');
        expect(allowed.headers['access-control-allow-credentials']).toBeUndefined();
        expect(denied.headers['access-control-allow-origin']).toBeUndefined();
      });
    });

    it('accepts a preflight request from an allowed origin with the configured policy', async () => {
      await registration.runScenario(async ({ app }) => {
        const response = await request(app.getHttpServer())
          .options('/api/v1/health/live')
          .set('Origin', 'https://allowed.example')
          .set('Access-Control-Request-Method', 'GET')
          .set('Access-Control-Request-Headers', 'Authorization, Content-Type, X-Request-Id')
          .expect(204);

        expect(response.headers['access-control-allow-origin']).toBe('https://allowed.example');
        expect(response.headers['access-control-allow-methods']).toBe(
          'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS,QUERY',
        );
        expect(response.headers['access-control-allow-headers']).toBe(
          'Accept,Authorization,Content-Type,X-Request-Id',
        );
        expect(response.headers['access-control-max-age']).toBe('600');
        expect(response.headers['access-control-expose-headers']).toBe('X-Request-Id');
      });
    });

    it('adopts only canonical UUIDv4 request IDs and generates replacements', async () => {
      await registration.runScenario(async ({ app }) => {
        const adoptedRequestId = '123e4567-e89b-42d3-a456-426614174000';
        const nonCanonicalRequestId = adoptedRequestId.toUpperCase();
        const adopted = await request(app.getHttpServer())
          .get('/api/v1/health/live')
          .set('X-Request-Id', adoptedRequestId)
          .expect(200);
        const generated = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
        const replaced = await request(app.getHttpServer())
          .get('/api/v1/health/live')
          .set('X-Request-Id', 'not-a-canonical-uuid')
          .expect(200);
        const replacedNonCanonical = await request(app.getHttpServer())
          .get('/api/v1/health/live')
          .set('X-Request-Id', nonCanonicalRequestId)
          .expect(200);
        const generatedRequestIds = [
          generated.headers['x-request-id'],
          replaced.headers['x-request-id'],
          replacedNonCanonical.headers['x-request-id'],
        ];

        expect(adopted.headers['x-request-id']).toBe(adoptedRequestId);
        for (const requestId of generatedRequestIds) {
          expect(requestId).toMatch(CANONICAL_UUID_V4);
        }
        expect(replaced.headers['x-request-id']).not.toBe('not-a-canonical-uuid');
        expect(replacedNonCanonical.headers['x-request-id']).not.toBe(nonCanonicalRequestId);
        expect(new Set(generatedRequestIds)).toHaveLength(generatedRequestIds.length);
      });
    });

    it('isolates concurrent correlation IDs', async () => {
      await registration.runScenario(async ({ app }) => {
        const requestIds = [
          '123e4567-e89b-42d3-a456-426614174000',
          '223e4567-e89b-42d3-a456-426614174000',
        ];
        const client = request.agent(app.getHttpServer());
        const responses = await Promise.all(
          requestIds.map(async (requestId) =>
            client.get('/api/v1/health/live').set('X-Request-Id', requestId).expect(200),
          ),
        );

        expect(responses.map((response) => response.headers['x-request-id'])).toEqual(requestIds);
      });
    });

    it('returns correlation IDs and logs one safe terminal event for HTTP outcomes', async () => {
      await registration.runScenario(async ({ app }) => {
        const logger = app.get(StructuredLoggerService);
        const logCompleted = vi.spyOn(logger, 'logHttpRequestCompleted');
        const requestId = '123e4567-e89b-42d3-a456-426614174000';

        const success = await request(app.getHttpServer())
          .get('/api/v1/health/live?accessToken=secret')
          .set('X-Request-Id', requestId)
          .expect(200);
        const missing = await request(app.getHttpServer())
          .get('/not-found?accessToken=secret')
          .expect(404);
        await request(app.getHttpServer()).get('/api/v1/__test/rate-limit').expect(200);
        await request(app.getHttpServer()).get('/api/v1/__test/rate-limit').expect(200);
        const limited = await request(app.getHttpServer())
          .get('/api/v1/__test/rate-limit')
          .expect(429);
        const preflight = await request(app.getHttpServer())
          .options('/api/v1/health/live')
          .set('Origin', 'https://allowed.example')
          .set('Access-Control-Request-Method', 'GET')
          .set('Access-Control-Request-Headers', 'X-Request-Id')
          .expect(204);

        for (const response of [success, missing, limited, preflight]) {
          expect(response.headers['x-request-id']).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
          );
        }
        expect(success.headers['x-request-id']).toBe(requestId);
        expect(preflight.headers['access-control-allow-headers']).toBe(
          'Accept,Authorization,Content-Type,X-Request-Id',
        );
        expect(preflight.headers['access-control-expose-headers']).toBe('X-Request-Id');
        expect(logCompleted).toHaveBeenCalledTimes(6);
        expect(logCompleted).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'GET',
            route: '/api/v1/health/live',
            statusCode: 200,
            durationMs: expect.any(Number),
          }),
        );
        expect(logCompleted).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'GET', route: 'unmatched', statusCode: 404 }),
        );
        expect(logCompleted).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'GET',
            route: '/api/v1/__test/rate-limit',
            statusCode: 429,
          }),
        );
        expect(logCompleted).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'OPTIONS', route: 'unmatched', statusCode: 204 }),
        );
        for (const event of logCompleted.mock.calls.map(([event]) => event)) {
          expect(event).not.toHaveProperty('query');
          expect(event).not.toHaveProperty('headers');
          expect(event).not.toHaveProperty('body');
        }
      });
    });

    it.each(DEFAULT_HEALTH_PATHS)('%s is excluded from global throttling', async (path) => {
      await registration.runScenario(async ({ app }) => {
        await request(app.getHttpServer()).get(path).expect(200);
        await request(app.getHttpServer()).get(path).expect(200);
        await request(app.getHttpServer()).get(path).expect(200);
      });
    });

    it('keeps global throttling active for an E2E-only route', async () => {
      await registration.runScenario(async ({ app }) => {
        await request(app.getHttpServer()).get('/api/v1/__test/rate-limit').expect(200);
        await request(app.getHttpServer()).get('/api/v1/__test/rate-limit').expect(200);
        await request(app.getHttpServer()).get('/api/v1/__test/rate-limit').expect(429);
      });
    });

    it('serves health routes without a prefix when it is explicitly empty', async () => {
      await registration.runScenario(
        async ({ app }) => {
          for (const path of UNPREFIXED_HEALTH_PATHS) {
            await request(app.getHttpServer()).get(path).expect(200);
          }

          for (const path of DEFAULT_HEALTH_PATHS) {
            await request(app.getHttpServer()).get(path).expect(404);
          }

          await request(app.getHttpServer()).get('/v2/health/live').expect(404);

          for (const path of ['/health/live', '/health/ready']) {
            await request(app.getHttpServer()).get(path).expect(404);
          }
        },
        { application: { apiConfig: buildApiConfig({ API_GLOBAL_PREFIX: '' }) } },
      );
    });

    it.each(['/health/live', '/health/ready'])(
      '%s does not expose the removed route',
      async (path) => {
        await registration.runScenario(async ({ app }) => {
          await request(app.getHttpServer()).get(path).expect(404);
        });
      },
    );

    it.each(UNPREFIXED_HEALTH_PATHS)(
      '%s is not exposed when the default prefix is active',
      async (path) => {
        await registration.runScenario(async ({ app }) => {
          await request(app.getHttpServer()).get(path).expect(404);
        });
      },
    );

    it('does not expose an unimplemented V2 route', async () => {
      await registration.runScenario(async ({ app }) => {
        await request(app.getHttpServer()).get('/api/v2/health/live').expect(404);
      });
    });

    it('does not expose the removed root route', async () => {
      await registration.runScenario(async ({ app }) => {
        await request(app.getHttpServer()).get('/').expect(404);
      });
    });
  });
}
