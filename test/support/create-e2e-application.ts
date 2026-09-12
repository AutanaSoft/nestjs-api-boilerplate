import type { INestApplication } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { setupApplication } from '../../src/app.setup.js';
import corsConfig from '../../src/config/cors.config.js';
import httpConfig from '../../src/config/http.config.js';
import type { E2EContext } from './e2e-context.js';
import { E2ERateLimitController } from './e2e-rate-limit.controller.js';

export async function createE2EApplication(): Promise<E2EContext> {
  let app: INestApplication | undefined;

  try {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [E2ERateLimitController],
    }).compile();

    app = moduleFixture.createNestApplication();
    const http = app.get<ConfigType<typeof httpConfig>>(httpConfig.KEY);
    const cors = app.get<ConfigType<typeof corsConfig>>(corsConfig.KEY);

    setupApplication(app, http, cors);
    await app.init();

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
