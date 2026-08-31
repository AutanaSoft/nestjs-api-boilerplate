import type { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApplication } from './app.setup.js';
import httpConfig from './config/http.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigType<typeof httpConfig>>(httpConfig.KEY);

  setupApplication(app, config);
  await app.listen(config.port);
}
await bootstrap();
