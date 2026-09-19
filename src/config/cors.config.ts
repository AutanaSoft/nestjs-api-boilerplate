import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';

export const corsEnvironmentSchema = z.object({
  NODE_ENV: z.string().trim().min(1).default('development'),
  CORS_ORIGINS: z.string().optional(),
  CORS_MAX_AGE_SECONDS: z.coerce.number().int().min(0).max(86_400).default(600),
});

export const corsConfigSchema = z.object({
  origins: z.array(z.string().min(1)).min(1),
  methods: z.array(z.string().min(1)),
  allowedHeaders: z.array(z.string().min(1)),
  exposedHeaders: z.array(z.string().min(1)),
  credentials: z.literal(false),
  maxAge: z.number().int().min(0).max(86_400),
  preflightContinue: z.literal(false),
  optionsSuccessStatus: z.literal(204),
});

export type CorsConfig = Readonly<{
  origins: readonly string[];
  methods: readonly string[];
  allowedHeaders: readonly string[];
  exposedHeaders: readonly string[];
  credentials: false;
  maxAge: number;
  preflightContinue: false;
  optionsSuccessStatus: 204;
}>;
export type CorsEnvironment = z.input<typeof corsEnvironmentSchema>;

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

export function buildCorsConfig(environment: CorsEnvironment = process.env): CorsConfig {
  const parsedEnvironment = corsEnvironmentSchema.parse(environment);
  const corsOriginsValue = parsedEnvironment.CORS_ORIGINS;

  if (parsedEnvironment.NODE_ENV === 'production' && corsOriginsValue === undefined) {
    throw new Error('CORS_ORIGINS is required in production');
  }

  return corsConfigSchema.parse({
    origins: parseCorsOrigins(corsOriginsValue === undefined ? DEFAULT_CORS_ORIGIN : corsOriginsValue),
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'QUERY'],
    allowedHeaders: ['Accept', 'Authorization', 'Content-Type', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    credentials: false,
    maxAge: parsedEnvironment.CORS_MAX_AGE_SECONDS,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });
}

const corsConfig = registerAs<CorsConfig>('cors', buildCorsConfig);

export default corsConfig;
