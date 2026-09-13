import type { INestApplication } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { setupApplication } from '../../src/app.setup.js';
import apiConfig from '../../src/config/api.config.js';
import type { ApiConfig } from '../../src/config/api.config.js';
import corsConfig from '../../src/config/cors.config.js';
import httpConfig from '../../src/config/http.config.js';
import type { E2EContext } from './e2e-context.js';
import { E2EErrorHandlingController } from './e2e-error-handling.controller.js';
import { E2ERateLimitController } from './e2e-rate-limit.controller.js';

export type CreateE2EApplicationOptions = Readonly<{
  apiConfig?: ApiConfig;
}>;

export async function createE2EApplication(
  options: CreateE2EApplicationOptions = {},
): Promise<E2EContext> {
  let app: INestApplication | undefined;

  try {
    const testingModule = Test.createTestingModule({
      imports: [AppModule],
      controllers: [E2EErrorHandlingController, E2ERateLimitController],
    });

    if (options.apiConfig !== undefined) {
      testingModule.overrideProvider(apiConfig.KEY).useValue(options.apiConfig);
    }

    const moduleFixture = await testingModule.compile();

    app = moduleFixture.createNestApplication();
    const http = app.get<ConfigType<typeof httpConfig>>(httpConfig.KEY);
    const cors = app.get<ConfigType<typeof corsConfig>>(corsConfig.KEY);
    const api = app.get<ConfigType<typeof apiConfig>>(apiConfig.KEY);

    setupApplication(app, http, cors, api);
    await app.init();
    await app.listen(0, '127.0.0.1');

    return { app };
  } catch (error: unknown) {
    if (app === undefined) {
      throw error;
    }

    try {
      await app.close();
    } catch (cleanupError: unknown) {
      throw new AggregateError(
        [error, cleanupError],
        'E2E application bootstrap and cleanup failed',
      );
    }

    throw error;
  }
}
