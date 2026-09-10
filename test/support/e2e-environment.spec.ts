import type { INestApplication } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { E2EContext } from './e2e-context.js';

describe('createE2EEnvironment', () => {
  it('applies only the E2E overrides and restores existing values on disposal', async () => {
    const originalCorsOrigins = process.env.CORS_ORIGINS;
    const originalThrottleLimit = process.env.THROTTLE_LIMIT;
    const originalThrottleTtlSeconds = process.env.THROTTLE_TTL_SECONDS;
    const originalUnrelated = process.env.UNRELATED_E2E_ENVIRONMENT_TEST;

    try {
      process.env.CORS_ORIGINS = 'https://before.example';
      process.env.THROTTLE_LIMIT = '10';
      process.env.THROTTLE_TTL_SECONDS = '30';
      process.env.UNRELATED_E2E_ENVIRONMENT_TEST = 'preserve-me';

      const { createE2EEnvironment } = await loadEnvironmentFactory();
      const environment = await createE2EEnvironment();

      expect(process.env.CORS_ORIGINS).toBe('https://allowed.example');
      expect(process.env.THROTTLE_LIMIT).toBe('2');
      expect(process.env.THROTTLE_TTL_SECONDS).toBe('60');
      expect(process.env.UNRELATED_E2E_ENVIRONMENT_TEST).toBe('preserve-me');

      await environment.dispose();

      expect(process.env.CORS_ORIGINS).toBe('https://before.example');
      expect(process.env.THROTTLE_LIMIT).toBe('10');
      expect(process.env.THROTTLE_TTL_SECONDS).toBe('30');
      expect(process.env.UNRELATED_E2E_ENVIRONMENT_TEST).toBe('preserve-me');
    } finally {
      restoreEnvironmentValue('CORS_ORIGINS', originalCorsOrigins);
      restoreEnvironmentValue('THROTTLE_LIMIT', originalThrottleLimit);
      restoreEnvironmentValue('THROTTLE_TTL_SECONDS', originalThrottleTtlSeconds);
      restoreEnvironmentValue('UNRELATED_E2E_ENVIRONMENT_TEST', originalUnrelated);
    }
  });

  it('restores absent values and does not restore them a second time', async () => {
    const originalCorsOrigins = process.env.CORS_ORIGINS;
    const originalThrottleLimit = process.env.THROTTLE_LIMIT;
    const originalThrottleTtlSeconds = process.env.THROTTLE_TTL_SECONDS;

    try {
      delete process.env.CORS_ORIGINS;
      delete process.env.THROTTLE_LIMIT;
      delete process.env.THROTTLE_TTL_SECONDS;

      const { createE2EEnvironment } = await loadEnvironmentFactory();
      const environment = await createE2EEnvironment();

      await environment.dispose();
      process.env.CORS_ORIGINS = 'changed-after-disposal';
      await environment.dispose();

      expect(Object.hasOwn(process.env, 'CORS_ORIGINS')).toBe(true);
      expect(process.env.CORS_ORIGINS).toBe('changed-after-disposal');
      expect(Object.hasOwn(process.env, 'THROTTLE_LIMIT')).toBe(false);
      expect(Object.hasOwn(process.env, 'THROTTLE_TTL_SECONDS')).toBe(false);
    } finally {
      restoreEnvironmentValue('CORS_ORIGINS', originalCorsOrigins);
      restoreEnvironmentValue('THROTTLE_LIMIT', originalThrottleLimit);
      restoreEnvironmentValue('THROTTLE_TTL_SECONDS', originalThrottleTtlSeconds);
    }
  });

  it('restores captured values when applying an override fails', async () => {
    const originalEnvironment = process.env;
    const overrideFailure = new Error('override failed');
    const restorationFailure = new Error('restoration failed');
    let throttleLimitWrites = 0;
    const proxyEnvironment = new Proxy(originalEnvironment, {
      set(target, property, value) {
        if (property === 'THROTTLE_LIMIT') {
          throttleLimitWrites += 1;
          throw throttleLimitWrites === 1 ? overrideFailure : restorationFailure;
        }

        return Reflect.set(target, property, value);
      },
    });

    const originalCorsOrigins = process.env.CORS_ORIGINS;
    const originalThrottleLimit = process.env.THROTTLE_LIMIT;
    const originalThrottleTtlSeconds = process.env.THROTTLE_TTL_SECONDS;

    try {
      process.env.CORS_ORIGINS = 'https://before.example';
      process.env.THROTTLE_LIMIT = '10';
      process.env.THROTTLE_TTL_SECONDS = '30';
      Object.defineProperty(process, 'env', {
        configurable: true,
        value: proxyEnvironment,
      });

      const { createE2EEnvironment } = await loadEnvironmentFactory();

      await expect(createE2EEnvironment()).rejects.toSatisfy(
        (error: unknown) =>
          typeof error === 'object' &&
          error !== null &&
          'errors' in error &&
          Array.isArray(error.errors) &&
          error.errors[0] === overrideFailure &&
          error.errors[1] === restorationFailure,
      );
      expect(process.env.CORS_ORIGINS).toBe('https://before.example');
    } finally {
      Object.defineProperty(process, 'env', {
        configurable: true,
        value: originalEnvironment,
      });
      restoreEnvironmentValue('CORS_ORIGINS', originalCorsOrigins);
      restoreEnvironmentValue('THROTTLE_LIMIT', originalThrottleLimit);
      restoreEnvironmentValue('THROTTLE_TTL_SECONDS', originalThrottleTtlSeconds);
    }
  });

  it('creates and closes a fresh application for every successful scenario', async () => {
    const firstApplication = createApplicationDouble();
    const secondApplication = createApplicationDouble();
    const { createE2EEnvironment, createE2EApplication } = await loadEnvironmentFactory([
      firstApplication.context,
      secondApplication.context,
    ]);
    const environment = await createE2EEnvironment();

    try {
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
    } finally {
      await environment.dispose();
    }
  });

  it('propagates the original scenario failure after successful application cleanup', async () => {
    const originalCorsOrigins = process.env.CORS_ORIGINS;
    const originalThrottleLimit = process.env.THROTTLE_LIMIT;
    const originalThrottleTtlSeconds = process.env.THROTTLE_TTL_SECONDS;
    const scenarioFailure = new Error('scenario failed');
    const application = createApplicationDouble();
    const { createE2EEnvironment } = await loadEnvironmentFactory([application.context]);

    try {
      const environment = await createE2EEnvironment();

      await expect(
        environment.runScenario(async () => {
          throw scenarioFailure;
        }),
      ).rejects.toBe(scenarioFailure);
      expect(application.close).toHaveBeenCalledOnce();

      await environment.dispose();
    } finally {
      restoreEnvironmentValue('CORS_ORIGINS', originalCorsOrigins);
      restoreEnvironmentValue('THROTTLE_LIMIT', originalThrottleLimit);
      restoreEnvironmentValue('THROTTLE_TTL_SECONDS', originalThrottleTtlSeconds);
    }
  });

  it('preserves a scenario failure before its cleanup failure', async () => {
    const scenarioFailure = new Error('scenario failed');
    const cleanupFailure = new Error('cleanup failed');
    const application = createApplicationDouble(cleanupFailure);
    const { createE2EEnvironment } = await loadEnvironmentFactory([application.context]);
    const environment = await createE2EEnvironment();

    try {
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
    } finally {
      await environment.dispose();
    }
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

function restoreEnvironmentValue(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
