import type { INestApplication } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApplication } from './app.setup.js';
import { setupOpenApi } from './common/openapi/openapi.setup.js';
import { ShutdownCoordinatorService } from './common/shutdown/shutdown-coordinator.service.js';
import apiConfig from './config/api.config.js';
import appConfig from './config/app.config.js';
import corsConfig from './config/cors.config.js';
import httpConfig from './config/http.config.js';
import openapiConfig from './config/openapi.config.js';

type CreateApplication = () => Promise<INestApplication>;

export async function bootstrap(
  createApplication: CreateApplication = () => NestFactory.create(AppModule, { bufferLogs: true }),
): Promise<void> {
  let app: INestApplication | undefined;

  try {
    app = await createApplication();
    const appMetadata = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
    const http = app.get<ConfigType<typeof httpConfig>>(httpConfig.KEY);
    const cors = app.get<ConfigType<typeof corsConfig>>(corsConfig.KEY);
    const api = app.get<ConfigType<typeof apiConfig>>(apiConfig.KEY);
    const openapi = app.get<ConfigType<typeof openapiConfig>>(openapiConfig.KEY);

    setupApplication(app, http, cors, api);
    setupOpenApi(app, appMetadata, openapi);
    await app.listen(http.port);
    app.get(ShutdownCoordinatorService).install(app);
  } catch (error) {
    if (app === undefined) {
      throw error;
    }

    try {
      await app.close();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Application startup and cleanup failed');
    }
    throw error;
  }
}

if (process.env.NODE_ENV !== 'test') {
  await bootstrap();
}
