import request from 'supertest';
import type { E2ESuiteRegistration } from '../../support/e2e-context.js';

export function registerAppE2ESuite(registration: E2ESuiteRegistration): void {
  describe('AppController (e2e)', () => {
    it('/ (GET) returns the existing response with Helmet headers', async () => {
      await registration.runScenario(async ({ app }) => {
        const response = await request(app.getHttpServer()).get('/').expect(200);

        expect(response.text).toBe('Hello World!');
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      });
    });

    it('allows configured CORS origins and denies unconfigured origins', async () => {
      await registration.runScenario(async ({ app }) => {
        const allowed = await request(app.getHttpServer())
          .get('/')
          .set('Origin', 'https://allowed.example')
          .expect(200);
        const denied = await request(app.getHttpServer())
          .get('/')
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
          .options('/')
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

    it('returns 429 after the configured request limit', async () => {
      await registration.runScenario(async ({ app }) => {
        await request(app.getHttpServer()).get('/').expect(200);
        await request(app.getHttpServer()).get('/').expect(200);
        await request(app.getHttpServer()).get('/').expect(429);
      });
    });
  });
}
