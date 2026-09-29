import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RefreshCleanupService } from '../../../src/modules/auth/refresh-cleanup.service.js';
import type { SessionsRepository } from '../../../src/modules/auth/repositories/sessions.repository.js';

const NOW = new Date('2026-09-29T12:00:00.000Z');
const CUTOFF = new Date(NOW.getTime() - 7 * 86_400_000);
const repository = (purgeRetired: ReturnType<typeof vi.fn>) => ({ purgeRetired }) as unknown as SessionsRepository;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('RefreshCleanupService', () => {
  it('drains multiple batches at startup and uses expiry minus seven days as cutoff', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const purgeRetired = vi.fn().mockResolvedValueOnce(256).mockResolvedValueOnce(256).mockResolvedValueOnce(3);
    const service = new RefreshCleanupService(repository(purgeRetired));
    await service.onModuleInit();
    await service.runOnce();
    expect(purgeRetired).toHaveBeenCalledTimes(3);
    expect(purgeRetired).toHaveBeenCalledWith(CUTOFF);
    await service.onModuleDestroy();
  });

  it('does not await startup backlog and drains the active batch on shutdown', async () => {
    vi.useFakeTimers();
    let release!: (count: number) => void;
    const purgeRetired = vi.fn().mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          release = resolve;
        }),
    );
    const service = new RefreshCleanupService(repository(purgeRetired));
    await service.onModuleInit();
    expect(purgeRetired).toHaveBeenCalledTimes(1);
    const shutdown = service.onModuleDestroy();
    release(256);
    await shutdown;
    expect(purgeRetired).toHaveBeenCalledTimes(1);
  });

  it('ticks without HTTP activity and stops ticks after shutdown', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const purgeRetired = vi.fn().mockResolvedValue(0);
    const service = new RefreshCleanupService(repository(purgeRetired));
    await service.onModuleInit();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(purgeRetired).toHaveBeenCalledTimes(2);
    expect(purgeRetired).toHaveBeenLastCalledWith(new Date(CUTOFF.getTime() + 60_000));
    await service.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(purgeRetired).toHaveBeenCalledTimes(2);
  });

  it('does not overlap a running tick and waits for its completion on shutdown', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    let release!: (count: number) => void;
    const purgeRetired = vi
      .fn()
      .mockResolvedValueOnce(0)
      .mockImplementationOnce(
        () =>
          new Promise<number>((resolve) => {
            release = resolve;
          }),
      );
    const service = new RefreshCleanupService(repository(purgeRetired));
    await service.onModuleInit();
    await service.runOnce();
    vi.advanceTimersByTime(60_000);
    const pending = service.runOnce();
    expect(purgeRetired).toHaveBeenCalledTimes(2);
    const shutdown = service.onModuleDestroy();
    release(0);
    await Promise.all([pending, shutdown]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(purgeRetired).toHaveBeenCalledTimes(2);
  });

  it('contains a cleanup failure and retries on the next tick without exposing the error', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const purgeRetired = vi
      .fn()
      .mockRejectedValueOnce(new Error('sensitive database diagnostic'))
      .mockResolvedValueOnce(256)
      .mockResolvedValueOnce(0);
    const service = new RefreshCleanupService(repository(purgeRetired));
    await service.onModuleInit();
    await service.runOnce();
    expect(warn).toHaveBeenCalledWith('Refresh history cleanup failed; the next tick will retry.');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(purgeRetired).toHaveBeenCalledTimes(3);
    await service.onModuleDestroy();
  });
});
