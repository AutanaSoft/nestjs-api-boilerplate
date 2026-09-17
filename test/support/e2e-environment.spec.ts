import type { INestApplication } from '@nestjs/common';
import { buildApiConfig } from '../../src/config/api.config.js';
import { describe, expect, it, vi } from 'vitest';
import type { E2EContext, E2EScenarioOptions } from './e2e-context.js';

describe('createE2EEnvironment', () => {
  it('does not mutate the controlled environment keys during construction or execution', async () => {
    const originalEnvironment = captureEnvironment();
    const application = createApplicationDouble();
    const { createE2EEnvironment } = await loadEnvironmentFactory([application.context]);

    const environment = await createE2EEnvironment();

    expect(captureEnvironment()).toEqual(originalEnvironment);

    await environment.runScenario(async () => undefined);

    expect(captureEnvironment()).toEqual(originalEnvironment);
    expect(environment).not.toHaveProperty('dispose');
    expect(application.close).toHaveBeenCalledOnce();
  });

  it('creates and closes a fresh application for every successful scenario', async () => {
    const firstApplication = createApplicationDouble();
    const secondApplication = createApplicationDouble();
    const { createE2EEnvironment, createE2EApplication } = await loadEnvironmentFactory([
      firstApplication.context,
      secondApplication.context,
    ]);
    const environment = await createE2EEnvironment();
    const applications: INestApplication[] = [];

    await environment.runScenario(async ({ app }) => {
      applications.push(app);
    });
    await environment.runScenario(async ({ app }) => {
      applications.push(app);
    });

    expect(createE2EApplication).toHaveBeenCalledTimes(2);
    expect(applications).toEqual([firstApplication.app, secondApplication.app]);
    expect(firstApplication.close).toHaveBeenCalledOnce();
    expect(secondApplication.close).toHaveBeenCalledOnce();
  });

  it('applies typed application overrides to the scenario application', async () => {
    const application = createApplicationDouble();
    const { createE2EEnvironment, createE2EApplication } = await loadEnvironmentFactory([
      application.context,
    ]);
    const environment = await createE2EEnvironment();
    const options: E2EScenarioOptions = {
      application: {
        apiConfig: buildApiConfig({ API_GLOBAL_PREFIX: '' }),
      },
    };

    await environment.runScenario(async () => undefined, options);

    expect(createE2EApplication).toHaveBeenCalledWith(options.application);
    expect(application.close).toHaveBeenCalledOnce();
  });

  it('propagates an application cleanup failure after a successful scenario', async () => {
    const cleanupFailure = new Error('cleanup failed');
    const application = createApplicationDouble(cleanupFailure);
    const { createE2EEnvironment } = await loadEnvironmentFactory([application.context]);
    const environment = await createE2EEnvironment();

    await expect(environment.runScenario(async () => undefined)).rejects.toBe(cleanupFailure);
    expect(application.close).toHaveBeenCalledOnce();
  });

  it('propagates the original scenario failure after successful application cleanup', async () => {
    const scenarioFailure = new Error('scenario failed');
    const application = createApplicationDouble();
    const { createE2EEnvironment } = await loadEnvironmentFactory([application.context]);
    const environment = await createE2EEnvironment();

    await expect(
      environment.runScenario(async () => {
        throw scenarioFailure;
      }),
    ).rejects.toBe(scenarioFailure);
    expect(application.close).toHaveBeenCalledOnce();
  });

  it('preserves a scenario failure before its cleanup failure', async () => {
    const scenarioFailure = new Error('scenario failed');
    const cleanupFailure = new Error('cleanup failed');
    const application = createApplicationDouble(cleanupFailure);
    const { createE2EEnvironment } = await loadEnvironmentFactory([application.context]);
    const environment = await createE2EEnvironment();

    await expect(
      environment.runScenario(async () => {
        throw scenarioFailure;
      }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof AggregateError &&
        error.errors[0] === scenarioFailure &&
        error.errors[1] === cleanupFailure,
    );
    expect(application.close).toHaveBeenCalledOnce();
  });
});

type ApplicationDouble = Readonly<{
  app: INestApplication;
  close: ReturnType<typeof vi.fn>;
  context: E2EContext;
}>;

function createApplicationDouble(closeFailure?: Error): ApplicationDouble {
  const close = vi.fn(async () => {
    if (closeFailure !== undefined) {
      throw closeFailure;
    }
  });
  const app = { close } as unknown as INestApplication;

  return { app, close, context: { app } };
}

async function loadEnvironmentFactory(contexts: E2EContext[] = []) {
  vi.resetModules();
  const createE2EApplication = vi.fn(async () => {
    const context = contexts.shift();

    if (context === undefined) {
      throw new Error('No E2E application context was configured');
    }

    return context;
  });

  vi.doMock('./create-e2e-application.js', () => ({ createE2EApplication }));

  return {
    createE2EApplication,
    createE2EEnvironment: (await import('./e2e-environment.js')).createE2EEnvironment,
  };
}

function captureEnvironment(): Readonly<Record<string, string | undefined>> {
  return {
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    THROTTLE_LIMIT: process.env.THROTTLE_LIMIT,
    THROTTLE_TTL_SECONDS: process.env.THROTTLE_TTL_SECONDS,
  };
}
