import type { INestApplication } from '@nestjs/common';

export type E2EContext = Readonly<{
  app: INestApplication;
}>;

export type E2EScenario = (context: E2EContext) => Promise<void>;

export type RunE2EScenario = (scenario: E2EScenario) => Promise<void>;

export type E2ESuiteRegistration = Readonly<{
  runScenario: RunE2EScenario;
}>;

export type CreateE2EApplication = () => Promise<E2EContext>;

export async function runE2EScenario(
  createApplication: CreateE2EApplication,
  scenario: E2EScenario,
): Promise<void> {
  const context = await createApplication();
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
}
