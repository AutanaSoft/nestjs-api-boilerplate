import type { INestApplication } from '@nestjs/common';

export type E2EContext = Readonly<{
  app: INestApplication;
}>;

export type E2EScenario = (context: E2EContext) => Promise<void>;

export type RunE2EScenario = (scenario: E2EScenario) => Promise<void>;

export type E2ESuiteRegistration = Readonly<{
  runScenario: RunE2EScenario;
}>;
