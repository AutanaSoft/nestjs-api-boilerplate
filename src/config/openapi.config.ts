import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const relativeRouteSchema = z.string().superRefine((route, context) => {
  if (
    route.length === 0 ||
    route.startsWith('/') ||
    route.endsWith('/') ||
    route.includes('?') ||
    route.includes('#')
  ) {
    context.addIssue({ code: 'custom', message: 'Route must be a non-empty relative path.' });
    return;
  }

  for (const segment of route.split('/')) {
    if (segment.length === 0 || segment === '.' || segment === '..' || /\s/.test(segment)) {
      context.addIssue({ code: 'custom', message: 'Route contains an invalid path segment.' });
      return;
    }
  }
});

export const openapiEnvironmentSchema = z.object({
  OPENAPI_ENABLED: z.enum(['true', 'false']).default('false'),
  OPENAPI_DOCS_ROUTE: z.string().optional(),
  OPENAPI_DOCUMENT_ROUTE: z.string().optional(),
});

export const openapiConfigSchema = z
  .object({
    enabled: z.boolean(),
    docsRoute: relativeRouteSchema,
    documentRoute: relativeRouteSchema,
  })
  .refine((config) => config.docsRoute !== config.documentRoute, {
    message: 'Documentation and document routes must differ.',
  });

export type OpenApiConfig = Readonly<z.output<typeof openapiConfigSchema>>;
export type OpenApiEnvironment = z.input<typeof openapiEnvironmentSchema>;

export function buildOpenApiConfig(environment: OpenApiEnvironment = process.env): OpenApiConfig {
  const parsedEnvironment = openapiEnvironmentSchema.parse(environment);

  return openapiConfigSchema.parse({
    enabled: parsedEnvironment.OPENAPI_ENABLED === 'true',
    docsRoute:
      parsedEnvironment.OPENAPI_DOCS_ROUTE === undefined
        ? 'docs'
        : parsedEnvironment.OPENAPI_DOCS_ROUTE.trim(),
    documentRoute:
      parsedEnvironment.OPENAPI_DOCUMENT_ROUTE === undefined
        ? 'openapi.json'
        : parsedEnvironment.OPENAPI_DOCUMENT_ROUTE.trim(),
  });
}

const openapiConfig = registerAs<OpenApiConfig>('openapi', buildOpenApiConfig);

export default openapiConfig;
