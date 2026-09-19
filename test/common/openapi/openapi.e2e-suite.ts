import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorResponseSchema } from '../../../src/common/error-handling/error-response.js';
import { toOpenApiSchema } from '../../../src/common/openapi/openapi-schema.js';
import { appConfigFactory } from '../../../src/config/app.config.js';
import { buildApiConfig } from '../../../src/config/api.config.js';
import { buildOpenApiConfig } from '../../../src/config/openapi.config.js';
import { healthResponseSchema } from '../../../src/modules/health/contracts/health-response.schema.js';
import { createUserRequestSchema } from '../../../src/modules/users/contracts/create-user-request.schema.js';
import { listUsersRequestSchema } from '../../../src/modules/users/contracts/list-users-request.schema.js';
import { queryUsersRequestSchema } from '../../../src/modules/users/contracts/query-users-request.schema.js';
import { updateUserRequestSchema } from '../../../src/modules/users/contracts/update-user-request.schema.js';
import { userResponseSchema } from '../../../src/modules/users/contracts/user-response.schema.js';
import { userSchema } from '../../../src/modules/users/contracts/user.schema.js';
import type { E2ESuiteRegistration } from '../../support/e2e-context.js';

const HEALTH_OPENAPI_PATHS = ['/api/v1/health/live', '/api/v1/health/ready'];
const USER_RETRIEVAL_OPENAPI_PATH = '/api/v1/users/{userId}';
const OPENAPI_PATHS = [...HEALTH_OPENAPI_PATHS, '/api/v1/users', USER_RETRIEVAL_OPENAPI_PATH];
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function registerOpenApiE2ESuite(registration: E2ESuiteRegistration): void {
  describe('OpenAPI (e2e)', () => {
    it('does not expose documentation routes while disabled by default', async () => {
      await registration.runScenario(async ({ app }) => {
        for (const path of [
          '/docs',
          '/openapi.json',
          '/api/docs',
          '/api/openapi.json',
          '/api/v1/docs',
          '/api/v1/openapi.json',
          '/v1/docs',
          '/v1/openapi.json',
        ]) {
          await request(app.getHttpServer()).get(path).expect(404);
        }
      });
    });

    it('exposes only the configured unversioned JSON document and UI with application metadata', async () => {
      const appConfig = appConfigFactory({
        NODE_ENV: 'test',
        APP_NAME: 'OpenAPI E2E API',
        APP_DESCRIPTION: 'OpenAPI E2E description',
        APP_VERSION: '9.8.7',
      });
      const openapiConfig = buildOpenApiConfig({ OPENAPI_ENABLED: 'true' });

      await registration.runScenario(
        async ({ app }) => {
          const document = await request(app.getHttpServer()).get('/openapi.json').expect(200);
          const docs = await request(app.getHttpServer())
            .get('/docs')
            .set('Origin', 'https://allowed.example')
            .expect(200);

          expect(document.headers['content-type']).toContain('application/json');
          expect(document.headers['x-content-type-options']).toBe('nosniff');
          expect(document.headers['x-frame-options']).toBe('SAMEORIGIN');
          expect(document.headers['x-request-id']).toMatch(UUID_V4);
          expect(document.headers['access-control-allow-origin']).toBeUndefined();
          expect(docs.headers['x-content-type-options']).toBe('nosniff');
          expect(docs.headers['x-frame-options']).toBe('SAMEORIGIN');
          expect(docs.headers['x-request-id']).toMatch(UUID_V4);
          expect(docs.headers['access-control-allow-origin']).toBe('https://allowed.example');
          expect(docs.headers['content-security-policy']).toContain("default-src 'self'");
          expect(docs.headers['content-security-policy']).toContain("script-src 'self'");
          expect(docs.headers['content-security-policy']).toContain("style-src 'self' https: 'unsafe-inline'");
          expect(docs.headers['content-security-policy']).toContain("img-src 'self' data:");

          expect(document.body.openapi).toBe('3.2.0');
          expect(document.body.info).toMatchObject({
            title: appConfig.name,
            description: appConfig.description,
            version: appConfig.version,
          });
          expect(Object.keys(document.body.paths)).toEqual(OPENAPI_PATHS);
          expect(document.body.paths['/api/v1/health/live'].get.operationId).toBe('healthLive');
          expect(document.body.paths['/api/v1/health/ready'].get.operationId).toBe('healthReady');

          for (const path of HEALTH_OPENAPI_PATHS) {
            const responses = document.body.paths[path].get.responses;
            expect(Object.keys(responses)).toEqual(['200', '500', '503']);
            expect(responses['200'].content['application/json'].schema).toEqual(
              toOpenApiSchema(healthResponseSchema, 'output'),
            );
            expect(responses['500'].content['application/json'].schema).toEqual(
              toOpenApiSchema(errorResponseSchema, 'output'),
            );
            expect(responses['503'].content['application/json'].schema).toEqual(
              toOpenApiSchema(healthResponseSchema, 'output'),
            );
          }

          const getUser = document.body.paths[USER_RETRIEVAL_OPENAPI_PATH].get;
          expect(getUser.operationId).toBe('getUser');
          expect(getUser.parameters).toEqual([
            {
              name: 'userId',
              required: true,
              in: 'path',
              schema: toOpenApiSchema(userSchema.shape.id, 'input'),
            },
          ]);
          expect(Object.keys(getUser.responses)).toEqual(['200', '400', '404', '429', '500']);
          expect(getUser.responses['200'].content['application/json'].schema).toEqual(
            toOpenApiSchema(userResponseSchema, 'output'),
          );
          for (const status of ['400', '404', '429', '500']) {
            expect(getUser.responses[status].content['application/json'].schema).toEqual(
              toOpenApiSchema(errorResponseSchema, 'output'),
            );
          }

          const updateUser = document.body.paths[USER_RETRIEVAL_OPENAPI_PATH].patch;
          expect(updateUser.operationId).toBe('updateUser');
          expect(updateUser.parameters).toEqual([
            {
              name: 'userId',
              required: true,
              in: 'path',
              schema: toOpenApiSchema(userSchema.shape.id, 'input'),
            },
          ]);
          expect(updateUser.requestBody.content['application/json'].schema).toEqual(
            toOpenApiSchema(updateUserRequestSchema, 'input'),
          );
          expect(Object.keys(updateUser.responses)).toEqual(['200', '400', '404', '409', '429', '500']);
          expect(updateUser.responses['200'].content['application/json'].schema).toEqual(
            toOpenApiSchema(userResponseSchema, 'output'),
          );
          for (const status of ['400', '404', '409', '429', '500']) {
            expect(updateUser.responses[status].content['application/json'].schema).toEqual(
              toOpenApiSchema(errorResponseSchema, 'output'),
            );
          }

          const deleteUser = document.body.paths[USER_RETRIEVAL_OPENAPI_PATH].delete;
          expect(deleteUser.operationId).toBe('deleteUser');
          expect(deleteUser.parameters).toEqual([
            {
              name: 'userId',
              required: true,
              in: 'path',
              schema: toOpenApiSchema(userSchema.shape.id, 'input'),
            },
          ]);
          expect(Object.keys(deleteUser.responses)).toEqual(['204', '400', '404', '429', '500']);
          expect(deleteUser.responses['204']).toEqual(expect.objectContaining({ description: expect.any(String) }));
          expect(deleteUser.responses['204'].content).toBeUndefined();
          for (const status of ['400', '404', '429', '500']) {
            expect(deleteUser.responses[status].content['application/json'].schema).toEqual(
              toOpenApiSchema(errorResponseSchema, 'output'),
            );
          }

          const listUsers = document.body.paths['/api/v1/users'].get;
          expect(listUsers.operationId).toBe('listUsers');
          expect(listUsers.parameters).toEqual([
            {
              name: 'email',
              required: false,
              in: 'query',
              schema: toOpenApiSchema(listUsersRequestSchema.shape.email, 'input'),
            },
            {
              name: 'sort',
              required: false,
              in: 'query',
              schema: toOpenApiSchema(listUsersRequestSchema.shape.sort, 'input'),
            },
            {
              name: 'direction',
              required: false,
              in: 'query',
              schema: toOpenApiSchema(listUsersRequestSchema.shape.direction, 'input'),
            },
            {
              name: 'limit',
              required: false,
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 250, default: 25 },
            },
            {
              name: 'after',
              required: false,
              in: 'query',
              schema: { type: 'string', maxLength: 1024 },
            },
            {
              name: 'before',
              required: false,
              in: 'query',
              schema: { type: 'string', maxLength: 1024 },
            },
          ]);
          expect(Object.keys(listUsers.responses)).toEqual(['200', '400', '429', '500']);
          expect(listUsers.responses['200'].content['application/json'].schema).toEqual(
            expect.objectContaining({
              type: 'object',
              properties: expect.objectContaining({
                pageInfo: expect.objectContaining({
                  properties: expect.objectContaining({
                    nextCursor: { type: ['string', 'null'] },
                    previousCursor: { type: ['string', 'null'] },
                  }),
                }),
              }),
            }),
          );
          for (const status of ['400', '429', '500']) {
            expect(listUsers.responses[status].content['application/json'].schema).toEqual(
              toOpenApiSchema(errorResponseSchema, 'output'),
            );
          }

          const queryUsers = document.body.paths['/api/v1/users'].query;
          expect(queryUsers.operationId).toBe('queryUsers');
          expect(queryUsers.parameters).toEqual([]);
          expect(queryUsers.requestBody.content['application/json'].schema).toEqual(
            toOpenApiSchema(queryUsersRequestSchema, 'input'),
          );
          expect(Object.keys(queryUsers.responses)).toEqual(['200', '400', '429', '500']);
          expect(queryUsers.responses['200'].content['application/json'].schema).toEqual(
            expect.objectContaining({
              type: 'object',
              properties: expect.objectContaining({
                pageInfo: expect.objectContaining({
                  properties: expect.objectContaining({
                    nextCursor: { type: ['string', 'null'] },
                    previousCursor: { type: ['string', 'null'] },
                  }),
                }),
              }),
            }),
          );
          for (const status of ['400', '429', '500']) {
            expect(queryUsers.responses[status].content['application/json'].schema).toEqual(
              toOpenApiSchema(errorResponseSchema, 'output'),
            );
          }

          const createUser = document.body.paths['/api/v1/users'].post;
          expect(createUser.operationId).toBe('createUser');
          expect(createUser.requestBody.content['application/json'].schema).toEqual(
            toOpenApiSchema(createUserRequestSchema, 'input'),
          );
          expect(Object.keys(createUser.responses)).toEqual(['201', '400', '409', '429', '500']);
          expect(createUser.responses['201'].content['application/json'].schema).toEqual(
            toOpenApiSchema(userResponseSchema, 'output'),
          );
          for (const status of ['400', '409', '429', '500']) {
            expect(createUser.responses[status].content['application/json'].schema).toEqual(
              toOpenApiSchema(errorResponseSchema, 'output'),
            );
          }

          expect(JSON.stringify(document.body)).not.toContain('"nullable":');
          expect(JSON.stringify(document.body)).not.toMatch(/NotFound|__test|rate.limit|serializ|validat/i);

          for (const path of [
            '/openapi.yaml',
            '/docs-json',
            '/docs-yaml',
            '/api-json',
            '/api/openapi.json',
            '/api/v1/openapi.json',
            '/v1/openapi.json',
          ]) {
            await request(app.getHttpServer()).get(path).expect(404);
          }
        },
        { application: { appConfig, openapiConfig } },
      );
    });

    it('uses configured routes and does not retain default document endpoints', async () => {
      await registration.runScenario(
        async ({ app }) => {
          await request(app.getHttpServer()).get('/reference').expect(200);
          await request(app.getHttpServer()).get('/schema.json').expect(200);

          for (const path of ['/docs', '/openapi.json', '/api/reference', '/api/schema.json']) {
            await request(app.getHttpServer()).get(path).expect(404);
          }
        },
        {
          application: {
            openapiConfig: buildOpenApiConfig({
              OPENAPI_ENABLED: 'true',
              OPENAPI_DOCS_ROUTE: 'reference',
              OPENAPI_DOCUMENT_ROUTE: 'schema.json',
            }),
          },
        },
      );
    });

    it('keeps documentation routes unprefixed while document paths retain versioning', async () => {
      await registration.runScenario(
        async ({ app }) => {
          const document = await request(app.getHttpServer()).get('/openapi.json').expect(200);
          expect(Object.keys(document.body.paths)).toEqual([
            '/v1/health/live',
            '/v1/health/ready',
            '/v1/users',
            '/v1/users/{userId}',
          ]);
          await request(app.getHttpServer()).get('/v1/openapi.json').expect(404);
          await request(app.getHttpServer()).get('/api/openapi.json').expect(404);
        },
        {
          application: {
            apiConfig: buildApiConfig({ API_GLOBAL_PREFIX: '' }),
            openapiConfig: buildOpenApiConfig({ OPENAPI_ENABLED: 'true' }),
          },
        },
      );
    });
  });
}
