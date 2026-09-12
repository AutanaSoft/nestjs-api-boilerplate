import { registerAs } from '@nestjs/config';
import { z } from 'zod';

export const httpEnvironmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(255).default(0),
});

export const httpConfigSchema = z.object({
  port: z.number().int().min(1).max(65_535),
  trustProxyHops: z.number().int().min(0).max(255),
});

export type HttpConfig = Readonly<z.output<typeof httpConfigSchema>>;
export type HttpEnvironment = z.input<typeof httpEnvironmentSchema>;

export function buildHttpConfig(environment: HttpEnvironment = process.env): HttpConfig {
  const parsedEnvironment = httpEnvironmentSchema.parse(environment);

  return httpConfigSchema.parse({
    port: parsedEnvironment.PORT,
    trustProxyHops: parsedEnvironment.TRUST_PROXY_HOPS,
  });
}

const httpConfig = registerAs<HttpConfig>('http', buildHttpConfig);

export default httpConfig;
