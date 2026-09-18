import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { AppConfig } from '../../config/app.config.js';
import type { OpenApiConfig } from '../../config/openapi.config.js';
import { HealthModule } from '../../modules/health/health.module.js';
import { UsersModule } from '../../modules/users/users.module.js';

export function setupOpenApi(
  app: INestApplication,
  appConfig: AppConfig,
  openapiConfig: OpenApiConfig,
): void {
  if (!openapiConfig.enabled) {
    return;
  }

  const documentConfig = new DocumentBuilder()
    .setTitle(appConfig.name)
    .setDescription(appConfig.description)
    .setVersion(appConfig.version)
    .build();
  const document = SwaggerModule.createDocument(app, documentConfig, {
    include: [HealthModule, UsersModule],
  });
  const configuredRoutes = [openapiConfig.docsRoute, openapiConfig.documentRoute].map(
    (route) => `/${route}`,
  );
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
