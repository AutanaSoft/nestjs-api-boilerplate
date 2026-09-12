import type { HealthCheckService } from '@nestjs/terminus';
import { describe, expect, it, vi } from 'vitest';
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
});
