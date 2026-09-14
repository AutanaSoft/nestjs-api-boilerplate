import request from 'supertest';
import { vi } from 'vitest';
import { StructuredLoggerService } from '../../../src/common/observability/logging/logger.service.js';
import type { E2ESuiteRegistration } from '../../support/e2e-context.js';

const CANONICAL_UUID_V4 = '123e4567-e89b-42d3-a456-426614174000';
const VALID_PAYLOAD = Object.freeze({ value: 'external-input' });
const FORBIDDEN_DIAGNOSTIC_VALUES = [
  'issues',
  'path',
  'external-input',
  'rejected-value',
  'schema',
  'stack',
  'cause',
  'Zod',
];

export function registerRequestValidationE2ESuite(registration: E2ESuiteRegistration): void {
  describe('Request validation (e2e)', () => {
    it('transforms valid external input before it reaches the handler', async () => {
      await registration.runScenario(async ({ app }) => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/__test/validation')
          .send(VALID_PAYLOAD)
          .expect(201);

        expect(response.body).toEqual({ value: 'NORMALIZED: external-input' });
      });
    });

    it.each([
      ['a missing required field', {}],
      ['a wrong-type field', { value: 42 }],
      ['an additional field', { ...VALID_PAYLOAD, additional: 'rejected-value' }],
    ])('returns the safe correlated BAD_REQUEST contract for %s', async (_caseName, payload) => {
      await registration.runScenario(async ({ app }) => {
        const logger = app.get(StructuredLoggerService);
        const logUnexpectedHttpError = vi.spyOn(logger, 'logUnexpectedHttpError');
        const logHttpRequestCompleted = vi.spyOn(logger, 'logHttpRequestCompleted');

        const response = await request(app.getHttpServer())
          .post('/api/v1/__test/validation')
          .set('X-Request-Id', CANONICAL_UUID_V4)
          .send(payload)
          .expect(400);

        expect(response.body).toEqual({
          statusCode: 400,
          code: 'BAD_REQUEST',
          message: 'The request is invalid.',
          requestId: CANONICAL_UUID_V4,
        });
        expect(response.headers['x-request-id']).toBe(response.body.requestId);
        expect(logUnexpectedHttpError).not.toHaveBeenCalled();
        expect(logHttpRequestCompleted).toHaveBeenCalledTimes(1);
        expect(logHttpRequestCompleted).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            route: '/api/v1/__test/validation',
            statusCode: 400,
          }),
        );

        const output = JSON.stringify({
          body: response.body,
          terminalEvents: logHttpRequestCompleted.mock.calls,
        });
        for (const forbiddenValue of FORBIDDEN_DIAGNOSTIC_VALUES) {
          expect(output).not.toContain(forbiddenValue);
        }
      });
    });
  });
}
