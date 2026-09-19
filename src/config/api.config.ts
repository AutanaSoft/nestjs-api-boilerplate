import { registerAs } from '@nestjs/config';
import { z } from 'zod';

export const API_VERSION = '1' as const;

export const apiEnvironmentSchema = z.object({
  API_GLOBAL_PREFIX: z.string().optional(),
});

function isNormalizedRelativePath(value: string): boolean {
  return (
    value.length > 0 &&
    !value.startsWith('/') &&
    !value.endsWith('/') &&
    !value.includes('//') &&
    !value.includes('?') &&
    !value.includes('#') &&
    !/\s/.test(value) &&
    value.split('/').every((segment) => segment !== '.' && segment !== '..')
  );
}

export const apiConfigSchema = z.object({
  globalPrefix: z
    .string()
    .refine(
      (value) => value === '' || isNormalizedRelativePath(value),
      'API_GLOBAL_PREFIX must be an empty string or a normalized relative path',
    ),
});

export type ApiConfig = Readonly<z.output<typeof apiConfigSchema>>;
export type ApiEnvironment = z.input<typeof apiEnvironmentSchema>;

export function buildApiConfig(environment: ApiEnvironment = process.env): ApiConfig {
  const parsedEnvironment = apiEnvironmentSchema.parse(environment);
  const globalPrefix = parsedEnvironment.API_GLOBAL_PREFIX === undefined ? 'api' : parsedEnvironment.API_GLOBAL_PREFIX;

  return apiConfigSchema.parse({ globalPrefix });
}

const apiConfig = registerAs<ApiConfig>('api', buildApiConfig);

export default apiConfig;
