import type { INestApplication } from '@nestjs/common';
import type { CreateE2EApplicationOptions } from './create-e2e-application.js';

export type E2EContext = Readonly<{
  app: INestApplication;
}>;

export type E2EScenario = (context: E2EContext) => Promise<void>;

export type E2EScenarioOptions = Readonly<{
  application?: CreateE2EApplicationOptions;
}>;

export type RunE2EScenario = (scenario: E2EScenario, options?: E2EScenarioOptions) => Promise<void>;

export type E2ESuiteRegistration = Readonly<{
  runScenario: RunE2EScenario;
}>;

export type CreateE2EApplication = (options?: CreateE2EApplicationOptions) => Promise<E2EContext>;

export async function runE2EScenario(
  createApplication: CreateE2EApplication,
  scenario: E2EScenario,
  options: E2EScenarioOptions = {},
): Promise<void> {
  const context = await createApplication(options.application);
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
      throw new AggregateError([scenarioError, cleanupError], 'E2E scenario and application cleanup failed');
    }

    throw cleanupError;
  }

  if (scenarioFailed) {
    throw scenarioError;
  }
}
