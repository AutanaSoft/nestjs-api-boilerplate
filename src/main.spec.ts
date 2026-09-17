import { describe, expect, it, vi } from 'vitest';

vi.mock('./app.setup.js', () => ({ setupApplication: vi.fn() }));
vi.mock('./common/openapi/openapi.setup.js', () => ({ setupOpenApi: vi.fn() }));

import { bootstrap } from './main.js';

describe('bootstrap', () => {
  it('installs runtime signal listeners only after the application listens', async () => {
    const coordinator = { install: vi.fn() };
    const app = {
      get: vi
        .fn()
        .mockReturnValueOnce({ nodeEnv: 'test' })
        .mockReturnValueOnce({ port: 3000 })
        .mockReturnValueOnce({})
        .mockReturnValueOnce({ globalPrefix: '' })
        .mockReturnValueOnce({})
        .mockReturnValueOnce(coordinator),
      getHttpAdapter: vi.fn().mockReturnValue({ getInstance: vi.fn() }),
      setGlobalPrefix: vi.fn(),
      enableVersioning: vi.fn(),
      useLogger: vi.fn(),
      use: vi.fn(),
      enableCors: vi.fn(),
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };

    await bootstrap(vi.fn().mockResolvedValue(app));

    expect(app.listen).toHaveBeenCalledBefore(coordinator.install);
    expect(coordinator.install).toHaveBeenCalledExactlyOnceWith(app);
  });

  it('preserves startup failure after closing a partially created application', async () => {
    const failure = new Error('listen failed');
    const app = {
      get: vi.fn().mockReturnValueOnce({}).mockReturnValueOnce({ port: 3000 }).mockReturnValue({}),
      close: vi.fn().mockResolvedValue(undefined),
    };

    await expect(bootstrap(vi.fn().mockRejectedValue(failure))).rejects.toBe(failure);
    expect(app.close).not.toHaveBeenCalled();

    await expect(
      bootstrap(vi.fn().mockResolvedValue({ ...app, listen: vi.fn().mockRejectedValue(failure) })),
    ).rejects.toBe(failure);
    expect(app.close).toHaveBeenCalledExactlyOnceWith();
  });

  it('aggregates startup and cleanup failures', async () => {
    const startupFailure = new Error('listen failed');
    const cleanupFailure = new Error('close failed');
    const app = {
      get: vi.fn().mockReturnValueOnce({}).mockReturnValueOnce({ port: 3000 }).mockReturnValue({}),
      listen: vi.fn().mockRejectedValue(startupFailure),
      close: vi.fn().mockRejectedValue(cleanupFailure),
    };

    await expect(bootstrap(vi.fn().mockResolvedValue(app))).rejects.toMatchObject({
      errors: [startupFailure, cleanupFailure],
    });
  });
});
