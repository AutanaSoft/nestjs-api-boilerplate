import { buildDatabaseConfig } from '../../src/config/database.config.js';
import { createE2EApplication } from './create-e2e-application.js';
import { runE2EScenario } from './e2e-context.js';
import { applyE2EDatabaseMigrations, createE2EDatabase } from './e2e-database.js';
import type { RunE2EScenario } from './e2e-context.js';

export type E2EEnvironment = Readonly<{
  runScenario: RunE2EScenario;
}>;

export async function createE2EEnvironment(): Promise<E2EEnvironment> {
  return {
    runScenario: async (scenario, options) => {
      const database = await createE2EDatabase();
      let scenarioError: unknown;

      try {
        await applyE2EDatabaseMigrations(database.url);
        await runE2EScenario(createE2EApplication, scenario, {
          application: {
            ...options?.application,
            databaseConfig: buildDatabaseConfig({ DATABASE_URL: database.url }),
          },
        });
      } catch (error: unknown) {
        scenarioError = error;
      }

      try {
        await database.dispose();
      } catch (cleanupError: unknown) {
        if (scenarioError !== undefined) {
          throw new AggregateError([scenarioError, cleanupError], 'E2E scenario and database cleanup failed');
        }

        throw cleanupError;
      }

      if (scenarioError !== undefined) {
        throw scenarioError;
      }
    },
  };
}
