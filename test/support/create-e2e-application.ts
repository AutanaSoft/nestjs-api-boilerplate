import type { INestApplication } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { setupApplication } from '../../src/app.setup.js';
import { setupOpenApi } from '../../src/common/openapi/openapi.setup.js';
import apiConfig from '../../src/config/api.config.js';
import type { ApiConfig } from '../../src/config/api.config.js';
import appConfig from '../../src/config/app.config.js';
import type { AppConfig } from '../../src/config/app.config.js';
import corsConfig from '../../src/config/cors.config.js';
import databaseConfig from '../../src/config/database.config.js';
import type { DatabaseConfig } from '../../src/config/database.config.js';
import httpConfig from '../../src/config/http.config.js';
import openapiConfig from '../../src/config/openapi.config.js';
import type { OpenApiConfig } from '../../src/config/openapi.config.js';
import rateLimitConfig from '../../src/config/rate-limit.config.js';
import type { RateLimitConfig } from '../../src/config/rate-limit.config.js';
import type { E2EContext } from './e2e-context.js';
import { E2EErrorHandlingController } from './e2e-error-handling.controller.js';
import { E2ERateLimitController } from './e2e-rate-limit.controller.js';
import { E2ERequestValidationController } from './e2e-request-validation.controller.js';
import { E2EResponseSerializationController } from './e2e-response-serialization.controller.js';

export type CreateE2EApplicationOptions = Readonly<{
  apiConfig?: ApiConfig;
  appConfig?: AppConfig;
  databaseConfig?: DatabaseConfig;
  openapiConfig?: OpenApiConfig;
  rateLimitConfig?: RateLimitConfig;
}>;

export async function createE2EApplication(
  options: CreateE2EApplicationOptions = {},
): Promise<E2EContext> {
  let app: INestApplication | undefined;

  try {
    const testingModule = Test.createTestingModule({
      imports: [AppModule],
      controllers: [
        E2EErrorHandlingController,
        E2ERateLimitController,
        E2EResponseSerializationController,
        E2ERequestValidationController,
      ],
    });

    if (options.apiConfig !== undefined) {
      testingModule.overrideProvider(apiConfig.KEY).useValue(options.apiConfig);
    }

    if (options.appConfig !== undefined) {
      testingModule.overrideProvider(appConfig.KEY).useValue(options.appConfig);
    }

    if (options.databaseConfig !== undefined) {
      testingModule.overrideProvider(databaseConfig.KEY).useValue(options.databaseConfig);
    }

    if (options.openapiConfig !== undefined) {
      testingModule.overrideProvider(openapiConfig.KEY).useValue(options.openapiConfig);
    }

    if (options.rateLimitConfig !== undefined) {
      testingModule.overrideProvider(rateLimitConfig.KEY).useValue(options.rateLimitConfig);
    }

    const moduleFixture = await testingModule.compile();

    app = moduleFixture.createNestApplication();
    const http = app.get<ConfigType<typeof httpConfig>>(httpConfig.KEY);
    const cors = app.get<ConfigType<typeof corsConfig>>(corsConfig.KEY);
    const api = app.get<ConfigType<typeof apiConfig>>(apiConfig.KEY);
    const application = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
    const openapi = app.get<ConfigType<typeof openapiConfig>>(openapiConfig.KEY);

    setupApplication(app, http, cors, api);
    setupOpenApi(app, application, openapi);
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
