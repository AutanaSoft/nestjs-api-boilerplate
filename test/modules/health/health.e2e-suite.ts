import request from 'supertest';
import { buildApiConfig } from '../../../src/config/api.config.js';
import { createE2EApplication } from '../../support/create-e2e-application.js';
import { runE2EScenario } from '../../support/e2e-context.js';
import type { E2ESuiteRegistration } from '../../support/e2e-context.js';

const DEFAULT_HEALTH_PATHS = ['/api/v1/health/live', '/api/v1/health/ready'];
const UNPREFIXED_HEALTH_PATHS = ['/v1/health/live', '/v1/health/ready'];

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
          .set('Access-Control-Request-Headers', 'Authorization, Content-Type')
          .expect(204);

        expect(response.headers['access-control-allow-origin']).toBe('https://allowed.example');
        expect(response.headers['access-control-allow-methods']).toBe(
          'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS,QUERY',
        );
        expect(response.headers['access-control-allow-headers']).toBe(
          'Accept,Authorization,Content-Type',
        );
        expect(response.headers['access-control-max-age']).toBe('600');
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
      await runE2EScenario(
        () => createE2EApplication({ apiConfig: buildApiConfig({ API_GLOBAL_PREFIX: '' }) }),
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
