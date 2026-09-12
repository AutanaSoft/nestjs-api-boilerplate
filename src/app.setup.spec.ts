import type { INestApplication } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { StructuredLoggerService } from './common/observability/logging/logger.service.js';
import { RequestCorrelationMiddleware } from './common/observability/middleware/correlation.middleware.js';
import { HttpRequestLoggingMiddleware } from './common/observability/middleware/request-logging.middleware.js';
import { setupApplication } from './app.setup.js';
import { buildApiConfig } from './config/api.config.js';
import { buildCorsConfig } from './config/cors.config.js';
import { buildHttpConfig } from './config/http.config.js';

describe('setupApplication', () => {
  it('applies trust proxy before Helmet and the configured CORS policy', () => {
    const set = vi.fn();
    const use = vi.fn();
    const enableCors = vi.fn();
    const setGlobalPrefix = vi.fn();
    const enableVersioning = vi.fn();
    const useLogger = vi.fn();
    const requestCorrelation = { use: vi.fn() };
    const requestLogging = { use: vi.fn() };
    const logger = {};
    const get = vi.fn((provider: unknown) => {
      if (provider === RequestCorrelationMiddleware) return requestCorrelation;
      if (provider === HttpRequestLoggingMiddleware) return requestLogging;
      return logger;
    });
    const app = {
      getHttpAdapter: () => ({ getInstance: () => ({ set }) }),
      get,
      use,
      useLogger,
      enableCors,
      setGlobalPrefix,
      enableVersioning,
    } as unknown as INestApplication;
    const httpConfig = buildHttpConfig({ TRUST_PROXY_HOPS: '1' });
    const corsConfig = buildCorsConfig({ CORS_ORIGINS: 'https://api.example.com' });
    const apiConfig = buildApiConfig({});

    setupApplication(app, httpConfig, corsConfig, apiConfig);

    expect(set).toHaveBeenCalledWith('trust proxy', 1);
    expect(setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(enableVersioning).toHaveBeenCalledWith({
      type: 0,
      defaultVersion: '1',
    });
    expect(get).toHaveBeenCalledWith(RequestCorrelationMiddleware);
    expect(get).toHaveBeenCalledWith(HttpRequestLoggingMiddleware);
    expect(get).toHaveBeenCalledWith(StructuredLoggerService);
    expect(useLogger).toHaveBeenCalledWith(logger);
    expect(use).toHaveBeenCalledTimes(3);
    expect(enableCors).toHaveBeenCalledWith({
      origin: ['https://api.example.com'],
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'QUERY'],
      allowedHeaders: ['Accept', 'Authorization', 'Content-Type', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      credentials: false,
      maxAge: 600,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    });
  });

  it('does not set Express trust proxy when it is disabled', () => {
    const set = vi.fn();
    const app = {
      getHttpAdapter: () => ({ getInstance: () => ({ set }) }),
      get: vi.fn(() => ({ use: vi.fn() })),
      use: vi.fn(),
      useLogger: vi.fn(),
      enableCors: vi.fn(),
      setGlobalPrefix: vi.fn(),
      enableVersioning: vi.fn(),
    } as unknown as INestApplication;

    setupApplication(app, buildHttpConfig({}), buildCorsConfig({}), buildApiConfig({}));

    expect(set).not.toHaveBeenCalled();
  });

  it('omits the global prefix when it is explicitly empty', () => {
    const setGlobalPrefix = vi.fn();
    const app = {
      getHttpAdapter: () => ({ getInstance: () => ({ set: vi.fn() }) }),
      get: vi.fn(() => ({ use: vi.fn() })),
      use: vi.fn(),
      useLogger: vi.fn(),
      enableCors: vi.fn(),
      setGlobalPrefix,
      enableVersioning: vi.fn(),
    } as unknown as INestApplication;

    setupApplication(
      app,
      buildHttpConfig({}),
      buildCorsConfig({}),
      buildApiConfig({ API_GLOBAL_PREFIX: '' }),
    );

    expect(setGlobalPrefix).not.toHaveBeenCalled();
  });
});
