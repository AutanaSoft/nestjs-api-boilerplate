import { describe, expect, it } from 'vitest';
import { RequestContextService } from './request-context.service.js';

describe('RequestContextService', () => {
  it('returns no request ID outside an HTTP context', () => {
    const service = new RequestContextService();

    expect(service.getRequestId()).toBeUndefined();
  });

  it('exposes the request ID throughout an asynchronous callback', async () => {
    const service = new RequestContextService();

    const requestId = await service.run('11111111-1111-4111-8111-111111111111', async () => {
      await Promise.resolve();
      return service.getRequestId();
    });

    expect(requestId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('isolates concurrent request contexts', async () => {
    const service = new RequestContextService();

    const requestIds = await Promise.all([
      service.run('11111111-1111-4111-8111-111111111111', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return service.getRequestId();
      }),
      service.run('22222222-2222-4222-8222-222222222222', async () => {
        await Promise.resolve();
        return service.getRequestId();
      }),
    ]);

    expect(requestIds).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);
  });
});
