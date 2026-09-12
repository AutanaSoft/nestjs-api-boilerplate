import { VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { Express } from 'express';
import helmet from 'helmet';
import { API_VERSION } from './config/api.config.js';
import type { ApiConfig } from './config/api.config.js';
import type { CorsConfig } from './config/cors.config.js';
import type { HttpConfig } from './config/http.config.js';

export function setupApplication(
  app: INestApplication,
  httpConfig: HttpConfig,
  corsConfig: CorsConfig,
  apiConfig: ApiConfig,
): void {
  if (httpConfig.trustProxyHops > 0) {
    const express = app.getHttpAdapter().getInstance() as Express;
    express.set('trust proxy', httpConfig.trustProxyHops);
  }

  if (apiConfig.globalPrefix !== '') {
    app.setGlobalPrefix(apiConfig.globalPrefix);
  }

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: API_VERSION,
  });

  app.use(helmet());
  app.enableCors({
    origin: [...corsConfig.origins],
    methods: [...corsConfig.methods],
    allowedHeaders: [...corsConfig.allowedHeaders],
    exposedHeaders: [...corsConfig.exposedHeaders],
    credentials: corsConfig.credentials,
    maxAge: corsConfig.maxAge,
    preflightContinue: corsConfig.preflightContinue,
    optionsSuccessStatus: corsConfig.optionsSuccessStatus,
  });
}
