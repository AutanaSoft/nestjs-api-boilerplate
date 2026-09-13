import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { RequestContextService } from '../context/request-context.service.js';
import type { ApplicationLogger } from '../logging/application-logger.js';
import { HttpRequestLoggingMiddleware } from './request-logging.middleware.js';

describe('HttpRequestLoggingMiddleware', () => {
  it('accepts Express request and response types', () => {
    expectTypeOf<Request>().toExtend<Parameters<HttpRequestLoggingMiddleware['use']>[0]>();
    expectTypeOf<Response>().toExtend<Parameters<HttpRequestLoggingMiddleware['use']>[1]>();
  });

  it('emits exactly one terminal event with the final status, stable route, and duration', () => {
    const context = new RequestContextService();
    const logger: ApplicationLogger = {
      logHttpRequestCompleted: vi.fn(() => {
        expect(context.getRequestId()).toBe('123e4567-e89b-42d3-a456-426614174000');
      }),
      logUnexpectedHttpError: vi.fn(),
    };
    const middleware = new HttpRequestLoggingMiddleware(context, logger, () => 20);
    const response = Object.assign(new EventEmitter(), { statusCode: 404 });
    const unmatchedRequestWithSensitiveUrl = {
      method: 'GET',
      route: undefined,
      originalUrl: '/unknown?accessToken=secret',
    };

    context.run('123e4567-e89b-42d3-a456-426614174000', () => {
      middleware.use(unmatchedRequestWithSensitiveUrl, response, vi.fn());
    });
    response.emit('finish');
    response.emit('finish');

    expect(logger.logHttpRequestCompleted).toHaveBeenCalledOnce();
    expect(logger.logUnexpectedHttpError).not.toHaveBeenCalled();
    expect(logger.logHttpRequestCompleted).toHaveBeenCalledWith({
      method: 'GET',
      route: 'unmatched',
      statusCode: 404,
      durationMs: 0,
    });
  });
});
