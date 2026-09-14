import type { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApplication } from './app.setup.js';
import { setupOpenApi } from './common/openapi/openapi.setup.js';
import apiConfig from './config/api.config.js';
import appConfig from './config/app.config.js';
import corsConfig from './config/cors.config.js';
import httpConfig from './config/http.config.js';
import openapiConfig from './config/openapi.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const appMetadata = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  const http = app.get<ConfigType<typeof httpConfig>>(httpConfig.KEY);
  const cors = app.get<ConfigType<typeof corsConfig>>(corsConfig.KEY);
  const api = app.get<ConfigType<typeof apiConfig>>(apiConfig.KEY);
  const openapi = app.get<ConfigType<typeof openapiConfig>>(openapiConfig.KEY);

  setupApplication(app, http, cors, api);
  setupOpenApi(app, appMetadata, openapi);
  await app.listen(http.port);
}
await bootstrap();
