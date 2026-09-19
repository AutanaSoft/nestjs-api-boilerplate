import request from 'supertest';
import { vi } from 'vitest';
import { StructuredLoggerService } from '../../../src/common/observability/logging/logger.service.js';
import type { E2ESuiteRegistration } from '../../support/e2e-context.js';

const CANONICAL_UUID_V4 = '123e4567-e89b-42d3-a456-426614174000';
const FORBIDDEN_DIAGNOSTIC_VALUES = [
  'response-secret',
  'invalid-response-value',
  'sensitive-cause',
  'issues',
  'stack',
  'schema',
  'Zod',
  'Nest',
];

export function registerSerializationE2ESuite(registration: E2ESuiteRegistration): void {
  describe('Response serialization (e2e)', () => {
    it('projects public fields and applies the declared schema transformation', async () => {
      await registration.runScenario(async ({ app }) => {
        const response = await request(app.getHttpServer()).get('/api/v1/__test/serialization/valid').expect(200);

        expect(response.body).toEqual({ publicName: 'PUBLIC: internal-name' });
        expect(response.body).not.toHaveProperty('internalSecret');
        expect(JSON.stringify(response.body)).not.toContain('response-secret');
      });
    });

    it('keeps an undecorated E2E response in native passthrough mode', async () => {
      await registration.runScenario(async ({ app }) => {
        const response = await request(app.getHttpServer()).get('/api/v1/__test/serialization/passthrough').expect(200);

        expect(response.body).toEqual({ internalName: 'passthrough-value' });
      });
    });

    it('returns a correlated safe error and emits one safe failure and terminal event', async () => {
      await registration.runScenario(async ({ app }) => {
        const logger = app.get(StructuredLoggerService);
        const logUnexpectedHttpError = vi.spyOn(logger, 'logUnexpectedHttpError');
        const logHttpRequestCompleted = vi.spyOn(logger, 'logHttpRequestCompleted');

        const response = await request(app.getHttpServer())
          .get('/api/v1/__test/serialization/invalid')
          .set('X-Request-Id', CANONICAL_UUID_V4)
          .expect(500);

        expect(response.body).toEqual({
          statusCode: 500,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred.',
          requestId: CANONICAL_UUID_V4,
        });
        expect(response.headers['x-request-id']).toBe(response.body.requestId);
        expect(response.body).not.toHaveProperty('details');
        expect(logUnexpectedHttpError).toHaveBeenCalledTimes(1);
        expect(logUnexpectedHttpError).toHaveBeenCalledWith({
          requestId: CANONICAL_UUID_V4,
          requestIdFallback: false,
          method: 'GET',
          route: '/api/v1/__test/serialization/invalid',
          errorType: 'RESPONSE_CONTRACT_VIOLATION',
        });
        expect(logHttpRequestCompleted).toHaveBeenCalledTimes(1);
        expect(logHttpRequestCompleted).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'GET',
            route: '/api/v1/__test/serialization/invalid',
            statusCode: 500,
          }),
        );

        for (const output of [
          JSON.stringify(response.body),
          JSON.stringify(logUnexpectedHttpError.mock.calls),
          JSON.stringify(logHttpRequestCompleted.mock.calls),
        ]) {
          for (const forbiddenValue of FORBIDDEN_DIAGNOSTIC_VALUES) {
            expect(output).not.toContain(forbiddenValue);
          }
        }
      });
    });
  });
}
