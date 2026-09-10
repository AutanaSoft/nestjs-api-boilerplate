import type { ConfigType } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { setupApplication } from '../../src/app.setup.js';
import httpConfig from '../../src/config/http.config.js';
import type { E2EContext } from './e2e-context.js';

export async function createE2EApplication(): Promise<E2EContext> {
  let app: INestApplication | undefined;

  try {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    const config = app.get<ConfigType<typeof httpConfig>>(httpConfig.KEY);

    setupApplication(app, config);
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
