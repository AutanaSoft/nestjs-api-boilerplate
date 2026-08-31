import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';

export const httpEnvironmentSchema = z.object({
  NODE_ENV: z.string().trim().min(1).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  CORS_ORIGINS: z.string().optional(),
  THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(255).default(0),
});

export const httpConfigSchema = z.object({
  nodeEnv: z.string().min(1),
  port: z.number().int().min(1).max(65_535),
  corsOrigins: z.array(z.string().min(1)).min(1),
  corsCredentials: z.literal(false),
  throttle: z.object({
    ttlMs: z.number().int().positive(),
    limit: z.number().int().positive(),
  }),
  trustProxyHops: z.number().int().min(0).max(255),
});

export type HttpConfig = Readonly<z.output<typeof httpConfigSchema>>;
export type HttpEnvironment = z.input<typeof httpEnvironmentSchema>;

function parseCorsOrigins(value: string): string[] {
  const origins = value.split(',').map((origin) => origin.trim());

  if (origins.some((origin) => origin.length === 0)) {
    throw new Error('CORS_ORIGINS must not contain empty origins');
  }

  const normalizedOrigins = origins.map((origin) => {
    let url: URL;

    try {
      url = new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGINS contains an invalid origin: ${origin}`);
    }

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username.length > 0 ||
      url.password.length > 0 ||
      url.pathname !== '/' ||
      url.search.length > 0 ||
      url.hash.length > 0
    ) {
      throw new Error(`CORS_ORIGINS contains an invalid origin: ${origin}`);
    }

    return url.origin;
  });

  if (new Set(normalizedOrigins).size !== normalizedOrigins.length) {
    throw new Error('CORS_ORIGINS must not contain duplicate origins');
  }

  return normalizedOrigins;
}

export function buildHttpConfig(environment: HttpEnvironment = process.env): HttpConfig {
  const parsedEnvironment = httpEnvironmentSchema.parse(environment);
  const corsOriginsValue = parsedEnvironment.CORS_ORIGINS;

  if (parsedEnvironment.NODE_ENV === 'production' && corsOriginsValue === undefined) {
    throw new Error('CORS_ORIGINS is required in production');
  }

  const corsOrigins = parseCorsOrigins(corsOriginsValue === undefined ? DEFAULT_CORS_ORIGIN : corsOriginsValue);

  return httpConfigSchema.parse({
    nodeEnv: parsedEnvironment.NODE_ENV,
    port: parsedEnvironment.PORT,
    corsOrigins,
    corsCredentials: false,
    throttle: {
      ttlMs: parsedEnvironment.THROTTLE_TTL_SECONDS * 1_000,
      limit: parsedEnvironment.THROTTLE_LIMIT,
    },
    trustProxyHops: parsedEnvironment.TRUST_PROXY_HOPS,
  });
}

const httpConfig = registerAs<HttpConfig>('http', buildHttpConfig);

export default httpConfig;
