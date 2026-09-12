import { VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { Express } from 'express';
import helmet from 'helmet';
import { StructuredLoggerService } from './common/observability/logging/logger.service.js';
import { RequestCorrelationMiddleware } from './common/observability/middleware/correlation.middleware.js';
import { HttpRequestLoggingMiddleware } from './common/observability/middleware/request-logging.middleware.js';
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

  const requestCorrelation = app.get(RequestCorrelationMiddleware);
  const requestLogging = app.get(HttpRequestLoggingMiddleware);
  const logger = app.get(StructuredLoggerService);

  app.useLogger(logger);
  app.use(requestCorrelation.use.bind(requestCorrelation));
  app.use(requestLogging.use.bind(requestLogging));
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
