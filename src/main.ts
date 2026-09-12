import type { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApplication } from './app.setup.js';
import corsConfig from './config/cors.config.js';
import httpConfig from './config/http.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const http = app.get<ConfigType<typeof httpConfig>>(httpConfig.KEY);
  const cors = app.get<ConfigType<typeof corsConfig>>(corsConfig.KEY);

  setupApplication(app, http, cors);
  await app.listen(http.port);
}
await bootstrap();
