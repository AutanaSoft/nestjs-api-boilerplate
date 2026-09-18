import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module.js';
import { errorResponseSchema } from '../error-handling/error-response.js';
import { setupApplication } from '../../app.setup.js';
import { appConfigFactory } from '../../config/app.config.js';
import type { AppConfig } from '../../config/app.config.js';
import { buildApiConfig } from '../../config/api.config.js';
import { buildCorsConfig } from '../../config/cors.config.js';
import { buildHttpConfig } from '../../config/http.config.js';
import { buildOpenApiConfig } from '../../config/openapi.config.js';
import type { OpenApiConfig } from '../../config/openapi.config.js';
import { healthResponseSchema } from '../../modules/health/contracts/health-response.schema.js';
import { createUserRequestSchema } from '../../modules/users/contracts/create-user-request.schema.js';
import { userResponseSchema } from '../../modules/users/contracts/user-response.schema.js';
import { toOpenApiSchema } from './openapi-schema.js';
import { setupOpenApi } from './openapi.setup.js';

vi.mock('@nestjs/swagger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nestjs/swagger')>();

  return {
    ...actual,
    SwaggerModule: {
      ...actual.SwaggerModule,
      createDocument: vi.fn(actual.SwaggerModule.createDocument),
      setup: vi.fn(),
    },
  };
});

describe('setupOpenApi', () => {
  const app = {} as INestApplication;
  const appConfig: AppConfig = {
    nodeEnv: 'test',
    name: 'Test API',
    description: 'Test API description',
    version: '1.2.3',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not create a document or register routes when disabled', () => {
    setupOpenApi(app, appConfig, {
      enabled: false,
      docsRoute: 'docs',
      documentRoute: 'openapi.json',
    });

    expect(SwaggerModule.createDocument).not.toHaveBeenCalled();
    expect(SwaggerModule.setup).not.toHaveBeenCalled();
  });

  it.each([
    ['docsRoute', 'api/v1/health/live'],
    ['docsRoute', 'api'],
    ['documentRoute', 'api/v1/health/live'],
    ['documentRoute', 'api'],
  ] as const)(
    'rejects a %s that overlaps a published API path before route registration',
    (key, route) => {
      vi.mocked(SwaggerModule.createDocument).mockReturnValueOnce({
        paths: { '/api/v1/health/live': {} },
      } as never);

      expect(() =>
        setupOpenApi(app, appConfig, {
          enabled: true,
          docsRoute: key === 'docsRoute' ? route : 'docs',
          documentRoute: key === 'documentRoute' ? route : 'openapi.json',
        }),
      ).toThrow('OpenAPI routes must not overlap published API paths.');
      expect(SwaggerModule.setup).not.toHaveBeenCalled();
    },
  );

  it('builds a document from app metadata and exposes only configured JSON', () => {
    const setTitle = vi.spyOn(DocumentBuilder.prototype, 'setTitle');
    const setDescription = vi.spyOn(DocumentBuilder.prototype, 'setDescription');
    const setVersion = vi.spyOn(DocumentBuilder.prototype, 'setVersion');
    vi.mocked(SwaggerModule.createDocument).mockReturnValueOnce({} as never);

    const openapiConfig: OpenApiConfig = {
      enabled: true,
      docsRoute: 'docs',
      documentRoute: 'openapi.json',
    };

    setupOpenApi(app, appConfig, openapiConfig);

    expect(setTitle).toHaveBeenCalledWith(appConfig.name);
    expect(setDescription).toHaveBeenCalledWith(appConfig.description);
    expect(setVersion).toHaveBeenCalledWith(appConfig.version);
    expect(vi.mocked(SwaggerModule.createDocument)).toHaveBeenCalledWith(
      app,
      expect.objectContaining({
        info: expect.objectContaining({
          title: appConfig.name,
          description: appConfig.description,
          version: appConfig.version,
        }),
      }),
      expect.objectContaining({ include: expect.any(Array) }),
    );
    expect(SwaggerModule.setup).toHaveBeenCalledWith(
      'docs',
      app,
      {},
      {
        useGlobalPrefix: false,
        jsonDocumentUrl: 'openapi.json',
        raw: ['json'],
      },
    );
  });

  it('generates only canonical public health operations with stable paths and schemas', async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const documentApp = moduleFixture.createNestApplication();
    const appConfig = appConfigFactory({
      NODE_ENV: 'test',
      APP_NAME: 'OpenAPI document test',
      APP_DESCRIPTION: 'Deterministic OpenAPI document test',
      APP_VERSION: '3.2.1',
    });

    try {
      setupApplication(
        documentApp,
        buildHttpConfig({}),
        buildCorsConfig({}),
        buildApiConfig({ API_GLOBAL_PREFIX: 'api' }),
      );
      setupOpenApi(documentApp, appConfig, buildOpenApiConfig({ OPENAPI_ENABLED: 'true' }));
      await documentApp.init();

      const document = vi.mocked(SwaggerModule.setup).mock.calls[0]?.[2] as
        OpenAPIObject | undefined;
      expect(document?.info).toMatchObject({
        title: appConfig.name,
        description: appConfig.description,
        version: appConfig.version,
      });

      const paths = document?.paths ?? {};
      expect(Object.keys(paths)).toEqual([
        '/api/v1/health/live',
        '/api/v1/health/ready',
        '/api/v1/users',
      ]);
      const healthOperations = ['/api/v1/health/live', '/api/v1/health/ready'].map(
        (path) => paths[path]?.get,
      );
      expect(healthOperations.map((operation) => operation?.operationId)).toEqual([
        'healthLive',
        'healthReady',
      ]);

      for (const operation of healthOperations) {
        expect(operation).toBeDefined();
        expect(Object.keys(operation?.responses ?? {})).toEqual(['200', '500', '503']);
        expect(operation?.responses?.['200']).toEqual(
          expect.objectContaining({
            content: {
              'application/json': {
                schema: toOpenApiSchema(healthResponseSchema, 'output'),
              },
            },
          }),
        );
        expect(operation?.responses?.['503']).toEqual(
          expect.objectContaining({
            content: {
              'application/json': {
                schema: toOpenApiSchema(healthResponseSchema, 'output'),
              },
            },
          }),
        );
        expect(operation?.responses?.['500']).toEqual(
          expect.objectContaining({
            content: {
              'application/json': {
                schema: toOpenApiSchema(errorResponseSchema, 'output'),
              },
            },
          }),
        );
      }

      const createUser = paths['/api/v1/users']?.post;
      expect(createUser?.operationId).toBe('createUser');
      expect(createUser?.requestBody).toEqual(
        expect.objectContaining({
          content: {
            'application/json': { schema: toOpenApiSchema(createUserRequestSchema, 'input') },
          },
        }),
      );
      expect(Object.keys(createUser?.responses ?? {})).toEqual(['201', '400', '409', '429', '500']);
      expect(createUser?.responses?.['201']).toEqual(
        expect.objectContaining({
          content: {
            'application/json': { schema: toOpenApiSchema(userResponseSchema, 'output') },
          },
        }),
      );
      for (const status of ['400', '409', '429', '500']) {
        expect(createUser?.responses?.[status]).toEqual(
          expect.objectContaining({
            content: {
              'application/json': { schema: toOpenApiSchema(errorResponseSchema, 'output') },
            },
          }),
        );
      }
      expect(JSON.stringify(document)).not.toMatch(
        /NotFound|__test|rate.limit|serializ|validat|error.handling/i,
      );
    } finally {
      await documentApp.close();
    }
  });

  it('keeps document paths versioned when the global prefix is empty', async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const documentApp = moduleFixture.createNestApplication();

    try {
      setupApplication(
        documentApp,
        buildHttpConfig({}),
        buildCorsConfig({}),
        buildApiConfig({ API_GLOBAL_PREFIX: '' }),
      );
      setupOpenApi(
        documentApp,
        appConfigFactory({ NODE_ENV: 'test' }),
        buildOpenApiConfig({ OPENAPI_ENABLED: 'true' }),
      );
      await documentApp.init();

      const document = vi.mocked(SwaggerModule.setup).mock.calls[0]?.[2] as
        OpenAPIObject | undefined;
      expect(Object.keys(document?.paths ?? {})).toEqual([
        '/v1/health/live',
        '/v1/health/ready',
        '/v1/users',
      ]);
    } finally {
      await documentApp.close();
    }
  });
});
