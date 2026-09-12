import { registerAs } from '@nestjs/config';
import { z } from 'zod';

export const rateLimitEnvironmentSchema = z.object({
  THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
});

export const rateLimitConfigSchema = z.object({
  global: z.object({
    ttlMs: z.number().int().positive(),
    limit: z.number().int().positive(),
  }),
});

export type RateLimitConfig = Readonly<{
  global: Readonly<z.output<typeof rateLimitConfigSchema>['global']>;
}>;
export type RateLimitEnvironment = z.input<typeof rateLimitEnvironmentSchema>;

export function buildRateLimitConfig(
  environment: RateLimitEnvironment = process.env,
): RateLimitConfig {
  const parsedEnvironment = rateLimitEnvironmentSchema.parse(environment);

  return rateLimitConfigSchema.parse({
    global: {
      ttlMs: parsedEnvironment.THROTTLE_TTL_SECONDS * 1_000,
      limit: parsedEnvironment.THROTTLE_LIMIT,
    },
  });
}

const rateLimitConfig = registerAs<RateLimitConfig>('rateLimit', buildRateLimitConfig);

export default rateLimitConfig;
