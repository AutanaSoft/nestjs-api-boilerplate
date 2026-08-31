import type { INestApplication } from '@nestjs/common';
import type { Express } from 'express';
import helmet from 'helmet';
import type { HttpConfig } from './config/http.config.js';

export function setupApplication(app: INestApplication, config: HttpConfig): void {
  if (config.trustProxyHops > 0) {
    const express = app.getHttpAdapter().getInstance() as Express;
    express.set('trust proxy', config.trustProxyHops);
  }

  app.use(helmet());
  app.enableCors({
    origin: config.corsOrigins,
    credentials: config.corsCredentials,
  });
}
