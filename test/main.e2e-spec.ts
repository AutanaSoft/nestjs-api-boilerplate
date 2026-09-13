import { registerErrorHandlingE2ESuite } from './modules/error-handling/error-handling.e2e-suite.js';
import { registerHealthE2ESuite } from './modules/health/health.e2e-suite.js';
import { registerSerializationE2ESuite } from './modules/serialization/serialization.e2e-suite.js';
import { createE2EEnvironment } from './support/e2e-environment.js';
import type { E2EEnvironment } from './support/e2e-environment.js';
import type { RunE2EScenario } from './support/e2e-context.js';

let environment: E2EEnvironment | undefined;

beforeAll(async () => {
  environment = await createE2EEnvironment();
});

const runScenario: RunE2EScenario = async (scenario) => {
  if (environment === undefined) {
    throw new Error('E2E environment is not initialized');
  }

  await environment.runScenario(scenario);
};

registerHealthE2ESuite({ runScenario });
registerSerializationE2ESuite({ runScenario });
registerErrorHandlingE2ESuite({ runScenario });
