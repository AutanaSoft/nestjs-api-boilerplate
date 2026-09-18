import { describe, expect, it, vi } from 'vitest';

vi.mock('./app.setup.js', () => ({ setupApplication: vi.fn() }));
vi.mock('./common/openapi/openapi.setup.js', () => ({ setupOpenApi: vi.fn() }));
vi.mock('@nestjs/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nestjs/core')>()),
  NestFactory: { create: vi.fn() },
}));

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { bootstrap } from './main.js';

describe('bootstrap', () => {
  it('buffers Nest bootstrap logs until StructuredLoggerService is installed', async () => {
    const logger = { logStartupCompleted: vi.fn() };
    const coordinator = { install: vi.fn() };
    const app = {
      get: vi
        .fn()
        .mockReturnValueOnce({ nodeEnv: 'test' })
        .mockReturnValueOnce({ port: 3000 })
        .mockReturnValueOnce({})
        .mockReturnValueOnce({ globalPrefix: 'api' })
        .mockReturnValueOnce({ enabled: false, docsRoute: 'docs' })
        .mockReturnValueOnce(logger)
        .mockReturnValueOnce(coordinator),
      getUrl: vi.fn().mockResolvedValue('http://127.0.0.1:3000'),
      listen: vi.fn().mockResolvedValue(undefined),
      flushLogs: vi.fn(),
    };
    vi.mocked(NestFactory.create).mockResolvedValue(app as never);

    await bootstrap();

    expect(NestFactory.create).toHaveBeenCalledExactlyOnceWith(AppModule, { bufferLogs: true });
    expect(app.flushLogs).not.toHaveBeenCalled();
  });

  it.each([
    ['api', true, 'docs', '/api/v1', '/docs'],
    ['', false, 'docs', '/v1', undefined],
    ['internal/api', true, 'developer/openapi', '/internal/api/v1', '/developer/openapi'],
  ])(
    'logs the startup summary with normalized paths for prefix %j',
    async (globalPrefix, openapiEnabled, docsRoute, apiBasePath, openapiUrl) => {
      const lifecycle: string[] = [];
      const logger = {
        logStartupCompleted: vi.fn(() => lifecycle.push('startup log')),
      };
      const coordinator = {
        install: vi.fn(() => lifecycle.push('shutdown install')),
      };
      const app = {
        get: vi
          .fn()
          .mockReturnValueOnce({ nodeEnv: 'test' })
          .mockReturnValueOnce({ port: 3000 })
          .mockReturnValueOnce({})
          .mockReturnValueOnce({ globalPrefix })
          .mockReturnValueOnce({ enabled: openapiEnabled, docsRoute })
          .mockReturnValueOnce(logger)
          .mockReturnValueOnce(coordinator),
        getUrl: vi.fn(async () => {
          lifecycle.push('getUrl');
          return 'http://127.0.0.1:3000';
        }),
        listen: vi.fn(async () => {
          lifecycle.push('listen');
        }),
      };

      await bootstrap(vi.fn().mockResolvedValue(app));

      expect(logger.logStartupCompleted).toHaveBeenCalledExactlyOnceWith({
        serverUrl: 'http://127.0.0.1:3000',
        apiBasePath,
        ...(openapiUrl === undefined ? {} : { openapiUrl }),
      });
      expect(lifecycle).toEqual(['listen', 'getUrl', 'startup log', 'shutdown install']);
      expect(coordinator.install).toHaveBeenCalledExactlyOnceWith(app);
    },
  );

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
