import request from 'supertest';
import { vi } from 'vitest';
import { StructuredLoggerService } from '../../../src/common/observability/logging/logger.service.js';
import type { E2ESuiteRegistration } from '../../support/e2e-context.js';

const CANONICAL_UUID_V4 = '123e4567-e89b-42d3-a456-426614174000';
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SENSITIVE_VALUES = ['sensitive-token', 'sensitive-context', 'sensitive-cause'];

type ErrorContract = Readonly<{
  statusCode: number;
  code: string;
  message: string;
}>;

function expectErrorContract(
  response: request.Response,
  expected: ErrorContract,
  requestId: string,
): void {
  expect(response.body).toEqual({ ...expected, requestId });
  expect(response.headers['x-request-id']).toBe(requestId);
  expect(response.body).not.toHaveProperty('details');
  expect(response.body).not.toHaveProperty('stack');
  expect(response.body).not.toHaveProperty('cause');
  expect(response.body).not.toHaveProperty('token');
  expect(response.body).not.toHaveProperty('context');

  for (const sensitiveValue of SENSITIVE_VALUES) {
    expect(JSON.stringify(response.body)).not.toContain(sensitiveValue);
  }
}

export function registerErrorHandlingE2ESuite(registration: E2ESuiteRegistration): void {
  describe('HTTP error handling (e2e)', () => {
    it('returns the route-not-found contract and generates a correlation ID', async () => {
      await registration.runScenario(async ({ app }) => {
        const response = await request(app.getHttpServer()).get('/api/v1/not-found').expect(404);
        const requestId = response.headers['x-request-id'];

        expect(requestId).toMatch(UUID_V4_PATTERN);
        expectErrorContract(
          response,
          {
            statusCode: 404,
            code: 'ROUTE_NOT_FOUND',
            message: 'The requested route was not found.',
          },
          requestId,
        );
      });
    });

    it('returns the rate-limit contract on the third real request', async () => {
      await registration.runScenario(async ({ app }) => {
        await request(app.getHttpServer()).get('/api/v1/__test/rate-limit').expect(200);
        await request(app.getHttpServer()).get('/api/v1/__test/rate-limit').expect(200);
        const response = await request(app.getHttpServer())
          .get('/api/v1/__test/rate-limit')
          .set('X-Request-Id', CANONICAL_UUID_V4)
          .expect(429);

        expectErrorContract(
          response,
          {
            statusCode: 429,
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests.',
          },
          CANONICAL_UUID_V4,
        );
      });
    });

    it('maps an ApplicationError without exposing its sensitive context', async () => {
      await registration.runScenario(async ({ app }) => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/__test/errors/application-error')
          .set('X-Request-Id', 'not-a-canonical-uuid')
          .expect(404);
        const requestId = response.headers['x-request-id'];

        expect(requestId).toMatch(UUID_V4_PATTERN);
        expect(requestId).not.toBe('not-a-canonical-uuid');
        expectErrorContract(
          response,
          {
            statusCode: 404,
            code: 'RESOURCE_NOT_FOUND',
            message: 'The requested resource was not found.',
          },
          requestId,
        );
      });
    });

    it('maps an unknown error without exposing its message or cause', async () => {
      await registration.runScenario(async ({ app }) => {
        const logger = app.get(StructuredLoggerService);
        const logUnexpectedHttpError = vi.spyOn(logger, 'logUnexpectedHttpError');
        const response = await request(app.getHttpServer())
          .get('/api/v1/__test/errors/unknown-error')
          .set('X-Request-Id', CANONICAL_UUID_V4)
          .expect(500);

        expectErrorContract(
          response,
          {
            statusCode: 500,
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred.',
          },
          CANONICAL_UUID_V4,
        );
        expect(logUnexpectedHttpError).toHaveBeenCalledTimes(1);
        expect(logUnexpectedHttpError).toHaveBeenCalledWith({
          requestId: CANONICAL_UUID_V4,
          requestIdFallback: false,
          method: 'GET',
          route: '/api/v1/__test/errors/unknown-error',
          errorType: 'UNKNOWN_ERROR',
        });
      });
    });

    it('logs no unexpected error for expected failures and records terminal error statuses', async () => {
      await registration.runScenario(async ({ app }) => {
        const logger = app.get(StructuredLoggerService);
        const logUnexpectedHttpError = vi.spyOn(logger, 'logUnexpectedHttpError');
        const logHttpRequestCompleted = vi.spyOn(logger, 'logHttpRequestCompleted');

        await request(app.getHttpServer()).get('/api/v1/not-found').expect(404);
        await request(app.getHttpServer()).get('/api/v1/__test/rate-limit').expect(200);
        await request(app.getHttpServer()).get('/api/v1/__test/rate-limit').expect(200);
        await request(app.getHttpServer()).get('/api/v1/__test/rate-limit').expect(429);
        await request(app.getHttpServer())
          .get('/api/v1/__test/errors/application-error')
          .expect(404);
        await request(app.getHttpServer()).get('/api/v1/__test/errors/unknown-error').expect(500);

        expect(logUnexpectedHttpError).toHaveBeenCalledTimes(1);
        expect(logHttpRequestCompleted).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'GET', route: 'unmatched', statusCode: 404 }),
        );
        expect(logHttpRequestCompleted).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'GET',
            route: '/api/v1/__test/rate-limit',
            statusCode: 429,
          }),
        );
        expect(logHttpRequestCompleted).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'GET',
            route: '/api/v1/__test/errors/unknown-error',
            statusCode: 500,
          }),
        );
      });
    });
  });
}
