import type { INestApplication } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import appConfig from '../../src/config/app.config.js';
import corsConfig from '../../src/config/cors.config.js';
import httpConfig from '../../src/config/http.config.js';
import openapiConfig from '../../src/config/openapi.config.js';

describe('createE2EApplication', () => {
  it('returns an initialized application assembled from the production root module', async () => {
    const createApplication = await loadProductionBootstrapFactory();
    const context = await createApplication();

    try {
      expect(context.app.getHttpServer()).toBeDefined();
    } finally {
      await context.app.close();
    }
  });

  it('propagates a compilation failure before an application is created', async () => {
    const compilationFailure = new Error('compilation failed');
    const { app, createE2EApplication: createFailingApplication } = await loadApplicationFactory({
      compilationFailure,
    });

    await expect(createFailingApplication()).rejects.toBe(compilationFailure);
    expect(app.close).not.toHaveBeenCalled();
  });

  it('closes a partially bootstrapped application when setup fails', async () => {
    const setupFailure = new Error('setup failed');
    const { app, createE2EApplication: createFailingApplication } = await loadApplicationFactory({
      setupFailure,
    });

    await expect(createFailingApplication()).rejects.toBe(setupFailure);
    expect(app.get).toHaveBeenCalledWith(httpConfig.KEY);
    expect(app.get).toHaveBeenCalledWith(corsConfig.KEY);
    expect(app.get).toHaveBeenCalledWith(appConfig.KEY);
    expect(app.get).toHaveBeenCalledWith(openapiConfig.KEY);
    expect(app.close).toHaveBeenCalledOnce();
  });

  it('closes the application when binding the loopback listener fails', async () => {
    const listenerFailure = new Error('listener failed');
    const { app, createE2EApplication: createFailingApplication } = await loadApplicationFactory({
      listenerFailure,
    });

    await expect(createFailingApplication()).rejects.toBe(listenerFailure);
    expect(app.listen).toHaveBeenCalledWith(0, '127.0.0.1');
    expect(app.close).toHaveBeenCalledOnce();
  });

  it('preserves the initialization failure before the cleanup failure', async () => {
    const initializationFailure = new Error('initialization failed');
    const cleanupFailure = new Error('cleanup failed');
    const { app, createE2EApplication: createFailingApplication } = await loadApplicationFactory({
      initializationFailure,
      cleanupFailure,
    });

    await expect(createFailingApplication()).rejects.toSatisfy((error: unknown) => {
      return (
        error instanceof AggregateError &&
        error.errors[0] === initializationFailure &&
        error.errors[1] === cleanupFailure
      );
    });
    expect(app.close).toHaveBeenCalledOnce();
  });
});

type BootstrapFailures = Readonly<{
  compilationFailure?: Error;
  setupFailure?: Error;
  initializationFailure?: Error;
  listenerFailure?: Error;
  cleanupFailure?: Error;
}>;

type ApplicationDouble = Readonly<{
  get: ReturnType<typeof vi.fn>;
  init: ReturnType<typeof vi.fn>;
  listen: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}>;

async function loadProductionBootstrapFactory() {
  vi.resetModules();
  vi.doMock('../../src/database/prisma.service.js', () => ({
    PrismaService: class PrismaService {},
  }));

  return (await import('./create-e2e-application.js')).createE2EApplication;
}

async function loadApplicationFactory(failures: BootstrapFailures): Promise<{
  app: ApplicationDouble;
  createE2EApplication: () => Promise<Readonly<{ app: INestApplication }>>;
}> {
  vi.resetModules();

  const app: ApplicationDouble = {
    get: vi.fn(() => ({})),
    init: vi.fn(async () => {
      if (failures.initializationFailure !== undefined) {
        throw failures.initializationFailure;
      }
    }),
    listen: vi.fn(async () => {
      if (failures.listenerFailure !== undefined) {
        throw failures.listenerFailure;
      }
    }),
    close: vi.fn(async () => {
      if (failures.cleanupFailure !== undefined) {
        throw failures.cleanupFailure;
      }
    }),
  };

  vi.doMock('@nestjs/testing', () => ({
    Test: {
      createTestingModule: () => ({
        compile: async () => {
          if (failures.compilationFailure !== undefined) {
            throw failures.compilationFailure;
          }

          return {
            createNestApplication: () => app,
          };
        },
      }),
    },
  }));
  vi.doMock('../../src/app.setup.js', () => ({
    setupApplication: () => {
      if (failures.setupFailure !== undefined) {
        throw failures.setupFailure;
      }
    },
  }));

  return {
    app,
    createE2EApplication: (await import('./create-e2e-application.js')).createE2EApplication,
  };
}
