import { randomBytes } from 'node:crypto';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.string().optional(),
  AUTH_JWT_SECRET: z.string().min(32).optional(),
  AUTH_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().max(86_400).default(900),
  AUTH_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().max(31_536_000).default(604_800),
});

const schema = z.object({
  jwtSecret: z.string().min(32),
  accessTtlSeconds: z.number().int().positive(),
  refreshTtlSeconds: z.number().int().positive(),
});

export type AuthConfig = Readonly<z.output<typeof schema>>;

export function buildAuthConfig(environment: z.input<typeof environmentSchema> = process.env): AuthConfig {
  const parsed = environmentSchema.parse(environment);
  if (parsed.NODE_ENV === 'production' && parsed.AUTH_JWT_SECRET === undefined) {
    throw new Error('AUTH_JWT_SECRET is required in production.');
  }
  return schema.parse({
    jwtSecret: parsed.AUTH_JWT_SECRET ?? randomBytes(32).toString('hex'),
    accessTtlSeconds: parsed.AUTH_ACCESS_TTL_SECONDS,
    refreshTtlSeconds: parsed.AUTH_REFRESH_TTL_SECONDS,
  });
}

export default registerAs<AuthConfig>('auth', buildAuthConfig);
