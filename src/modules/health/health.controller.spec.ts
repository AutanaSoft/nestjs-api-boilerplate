import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { HealthCheckService } from '@nestjs/terminus';
import { lastValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ResponseSchemaSerializerInterceptor } from '../../common/serialization/response-schema-serializer.interceptor.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('delegates liveness to Terminus with only the basic checks and returns its result', async () => {
    const result = { status: 'ok', info: {}, error: {}, details: {} };
    const healthCheckService = {
      check: vi.fn().mockResolvedValue(result),
    } as unknown as HealthCheckService;
    const controller = new HealthController(healthCheckService);

    await expect(controller.live()).resolves.toBe(result);
    expect(healthCheckService.check).toHaveBeenCalledWith([]);
  });

  it('delegates readiness to Terminus with only the basic checks and returns its result', async () => {
    const result = { status: 'ok', info: {}, error: {}, details: {} };
    const healthCheckService = {
      check: vi.fn().mockResolvedValue(result),
    } as unknown as HealthCheckService;
    const controller = new HealthController(healthCheckService);

    await expect(controller.ready()).resolves.toBe(result);
    expect(healthCheckService.check).toHaveBeenCalledWith([]);
  });

  it.each(['live', 'ready'] as const)(
    'declares a response schema consumed by the serializer for %s',
    async (method) => {
      const interceptor = new ResponseSchemaSerializerInterceptor(new Reflector());
      const context = {
        getClass: () => HealthController,
        getHandler: () => HealthController.prototype[method],
      } as unknown as ExecutionContext;
      const next: CallHandler = {
        handle: () =>
          of({ status: 'ok', info: {}, error: {}, details: {}, internalOnly: 'do-not-expose' }),
      };

      await expect(lastValueFrom(interceptor.intercept(context, next))).resolves.toEqual({
        status: 'ok',
        info: {},
        error: {},
        details: {},
      });
    },
  );
});
