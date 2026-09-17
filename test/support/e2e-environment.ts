import { createE2EApplication } from './create-e2e-application.js';
import { runE2EScenario } from './e2e-context.js';
import type { RunE2EScenario } from './e2e-context.js';

export type E2EEnvironment = Readonly<{
  runScenario: RunE2EScenario;
}>;

export async function createE2EEnvironment(): Promise<E2EEnvironment> {
  return {
    runScenario: async (scenario, options) =>
      runE2EScenario(createE2EApplication, scenario, options),
  };
}
