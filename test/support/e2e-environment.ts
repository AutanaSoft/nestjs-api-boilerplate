import { createE2EApplication } from './create-e2e-application.js';
import type { RunE2EScenario } from './e2e-context.js';

const E2E_ENVIRONMENT_KEYS = ['CORS_ORIGINS', 'THROTTLE_LIMIT', 'THROTTLE_TTL_SECONDS'] as const;

type E2EEnvironmentKey = (typeof E2E_ENVIRONMENT_KEYS)[number];

type EnvironmentSnapshot = Readonly<{
  existed: boolean;
  value: string | undefined;
}>;

type E2EEnvironmentSnapshot = Readonly<Record<E2EEnvironmentKey, EnvironmentSnapshot>>;

export type E2EEnvironment = Readonly<{
  runScenario: RunE2EScenario;
  dispose: () => Promise<void>;
}>;

export async function createE2EEnvironment(): Promise<E2EEnvironment> {
  const snapshot = captureEnvironment();

  try {
    process.env.CORS_ORIGINS = 'https://allowed.example';
    process.env.THROTTLE_LIMIT = '2';
    process.env.THROTTLE_TTL_SECONDS = '60';
  } catch (error: unknown) {
    await restoreAfterFailure(snapshot, error, 'E2E environment preparation and cleanup failed');
  }

  let disposed = false;

  return {
    runScenario: async (scenario) => {
      const context = await createE2EApplication();
      let scenarioFailed = false;
      let scenarioError: unknown;

      try {
        await scenario(context);
      } catch (error: unknown) {
        scenarioFailed = true;
        scenarioError = error;
      }

      try {
        await context.app.close();
      } catch (cleanupError: unknown) {
        if (scenarioFailed) {
          throw new AggregateError(
            [scenarioError, cleanupError],
            'E2E scenario and application cleanup failed',
          );
        }

        throw cleanupError;
      }

      if (scenarioFailed) {
        throw scenarioError;
      }
    },
    dispose: async () => {
      if (disposed) {
        return;
      }

      disposed = true;
      await restoreEnvironment(snapshot);
    },
  };
}

function captureEnvironment(): E2EEnvironmentSnapshot {
  return {
    CORS_ORIGINS: captureEnvironmentValue('CORS_ORIGINS'),
    THROTTLE_LIMIT: captureEnvironmentValue('THROTTLE_LIMIT'),
    THROTTLE_TTL_SECONDS: captureEnvironmentValue('THROTTLE_TTL_SECONDS'),
  };
}

function captureEnvironmentValue(key: E2EEnvironmentKey): EnvironmentSnapshot {
  return {
    existed: Object.hasOwn(process.env, key),
    value: process.env[key],
  };
}

async function restoreAfterFailure(
  snapshot: E2EEnvironmentSnapshot,
  error: unknown,
  message: string,
): Promise<never> {
  try {
    await restoreEnvironment(snapshot);
  } catch (cleanupError: unknown) {
    throw new AggregateError([error, cleanupError], message);
  }

  throw error;
}

async function restoreEnvironment(snapshot: E2EEnvironmentSnapshot): Promise<void> {
  const restorationErrors: unknown[] = [];

  for (const key of E2E_ENVIRONMENT_KEYS) {
    try {
      const { existed, value } = snapshot[key];

      if (existed) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    } catch (error: unknown) {
      restorationErrors.push(error);
    }
  }

  if (restorationErrors.length === 1) {
    throw restorationErrors[0];
  }

  if (restorationErrors.length > 1) {
    throw new AggregateError(restorationErrors, 'E2E environment restoration failed');
  }
}
