import { registerErrorHandlingE2ESuite } from './common/error-handling/error-handling.e2e-suite.js';
import { registerOpenApiE2ESuite } from './common/openapi/openapi.e2e-suite.js';
import { registerSerializationE2ESuite } from './common/serialization/serialization.e2e-suite.js';
import { registerRequestValidationE2ESuite } from './common/validation/request-validation.e2e-suite.js';
import { registerHealthE2ESuite } from './modules/health/health.e2e-suite.js';
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
registerOpenApiE2ESuite({ runScenario });
registerSerializationE2ESuite({ runScenario });
registerRequestValidationE2ESuite({ runScenario });
registerErrorHandlingE2ESuite({ runScenario });
