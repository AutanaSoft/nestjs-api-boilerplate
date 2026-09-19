import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject, OperationObject, PathItemObject } from '@nestjs/swagger';
import type { AppConfig } from '../../config/app.config.js';
import type { OpenApiConfig } from '../../config/openapi.config.js';
import { HealthModule } from '../../modules/health/health.module.js';
import { UsersModule } from '../../modules/users/users.module.js';

export function setupOpenApi(app: INestApplication, appConfig: AppConfig, openapiConfig: OpenApiConfig): void {
  if (!openapiConfig.enabled) {
    return;
  }

  const documentConfig = new DocumentBuilder()
    .setTitle(appConfig.name)
    .setDescription(appConfig.description)
    .setVersion(appConfig.version)
    .build();
  const document = asOpenApi32Document(
    SwaggerModule.createDocument(app, documentConfig, {
      include: [HealthModule, UsersModule],
    }),
  );
  convertNullableSchemasToOpenApi32Unions(document);
  document.openapi = '3.2.0';
  const configuredRoutes = [openapiConfig.docsRoute, openapiConfig.documentRoute].map((route) => `/${route}`);
  deduplicateOperationParameters(document);
  const publishedPaths = Object.keys(document.paths ?? {});

  if (
    configuredRoutes.some((configuredRoute) =>
      publishedPaths.some(
        (publishedPath) =>
          configuredRoute === publishedPath ||
          configuredRoute.startsWith(`${publishedPath}/`) ||
          publishedPath.startsWith(`${configuredRoute}/`),
      ),
    )
  ) {
    throw new Error('OpenAPI routes must not overlap published API paths.');
  }

  SwaggerModule.setup(openapiConfig.docsRoute, app, document, {
    useGlobalPrefix: false,
    jsonDocumentUrl: openapiConfig.documentRoute,
    raw: ['json'],
  });
}

type OpenApi32PathItem = PathItemObject & { query?: OperationObject };
type OpenApi32Document = Omit<OpenAPIObject, 'openapi' | 'paths'> & {
  openapi: '3.2.0';
  paths: Record<string, OpenApi32PathItem>;
};

function asOpenApi32Document(document: OpenAPIObject): OpenApi32Document {
  // Swagger emits QUERY at runtime before its 3.0-oriented public types model the method.
  return document as OpenApi32Document;
}

function convertNullableSchemasToOpenApi32Unions(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      convertNullableSchemasToOpenApi32Unions(item);
    }
    return;
  }

  if (!isRecord(value)) return;

  for (const child of Object.values(value)) {
    convertNullableSchemasToOpenApi32Unions(child);
  }

  if (value.nullable !== true) return;

  delete value.nullable;

  if (typeof value.type === 'string') {
    value.type = value.type === 'null' ? ['null'] : [value.type, 'null'];
    return;
  }

  if (isStringArray(value.type)) {
    value.type = value.type.includes('null') ? value.type : [...value.type, 'null'];
    return;
  }

  const schema = { ...value };
  for (const key of Object.keys(value)) {
    delete value[key];
  }
  value.anyOf = [schema, { type: 'null' }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function deduplicateOperationParameters(document: OpenApi32Document): void {
  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const operation of [pathItem.get, pathItem.post, pathItem.patch, pathItem.delete, pathItem.query]) {
      if (operation?.parameters === undefined) continue;

      const parameters = new Map<string, (typeof operation.parameters)[number]>();
      for (const parameter of operation.parameters) {
        if ('$ref' in parameter) continue;
        parameters.set(`${parameter.in}:${parameter.name}`, parameter);
      }
      operation.parameters = [...parameters.values()];
    }
  }
}
