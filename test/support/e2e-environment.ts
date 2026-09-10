import { createE2EApplication } from './create-e2e-application.js';
import type { RunE2EScenario } from './e2e-context.js';

export type E2EEnvironment = Readonly<{
  runScenario: RunE2EScenario;
}>;

export async function createE2EEnvironment(): Promise<E2EEnvironment> {
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
  };
}
