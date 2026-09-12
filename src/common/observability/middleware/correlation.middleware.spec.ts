import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { RequestContextService } from '../context/request-context.service.js';
import { RequestCorrelationMiddleware } from './correlation.middleware.js';

describe('RequestCorrelationMiddleware', () => {
  it('accepts Express request and response types', () => {
    expectTypeOf<Request>().toExtend<Parameters<RequestCorrelationMiddleware['use']>[0]>();
    expectTypeOf<Response>().toExtend<Parameters<RequestCorrelationMiddleware['use']>[1]>();
  });

  it('adopts a canonical UUIDv4 and exposes it to the downstream callback', () => {
    const context = new RequestContextService();
    const middleware = new RequestCorrelationMiddleware(context);
    const requestId = '123e4567-e89b-42d3-a456-426614174000';
    const response = createResponse();
    const next = vi.fn(() => {
      expect(context.getRequestId()).toBe(requestId);
    });

    middleware.use({ get: vi.fn((_header: 'X-Request-Id') => requestId) }, response, next);

    expect(response.setHeader).toHaveBeenCalledWith('X-Request-Id', requestId);
    expect(next).toHaveBeenCalledOnce();
  });

  it.each([
    '123e4567-e89b-12d3-a456-426614174000',
    '123E4567-E89B-42D3-A456-426614174000',
    '123e4567-e89b-42d3-c456-426614174000',
    'invalid',
    undefined,
  ])('replaces an invalid inbound request ID: %s', (requestId) => {
    const context = new RequestContextService();
    const middleware = new RequestCorrelationMiddleware(context);
    const response = createResponse();

    middleware.use({ get: vi.fn((_header: 'X-Request-Id') => requestId) }, response, vi.fn());

    const generatedRequestId = response.setHeader.mock.calls[0]?.[1];
    expect(generatedRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(generatedRequestId).not.toBe(requestId);
  });
});

function createResponse() {
  return Object.assign(new EventEmitter(), {
    setHeader: vi.fn<(_header: 'X-Request-Id', _value: string) => void>(),
  });
}
