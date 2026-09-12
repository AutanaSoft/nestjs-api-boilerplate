import { registerAs } from '@nestjs/config';
import { z } from 'zod';

export const appEnvironmentSchema = z.object({
  NODE_ENV: z.string().trim().min(1).default('development'),
  APP_NAME: z.string().trim().min(1).optional(),
  APP_DESCRIPTION: z.string().trim().min(1).optional(),
  APP_VERSION: z.string().trim().min(1).optional(),
});

export const appConfigSchema = z.object({
  nodeEnv: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
});

export type AppConfig = Readonly<z.output<typeof appConfigSchema>>;
export type AppEnvironment = z.input<typeof appEnvironmentSchema>;

export function appConfigFactory(environment: AppEnvironment = process.env): AppConfig {
  const parsedEnvironment = appEnvironmentSchema.parse(environment);

  return appConfigSchema.parse({
    nodeEnv: parsedEnvironment.NODE_ENV,
    name: parsedEnvironment.APP_NAME === undefined ? 'NestJS 12 API' : parsedEnvironment.APP_NAME,
    description:
      parsedEnvironment.APP_DESCRIPTION === undefined
        ? 'A secure NestJS 12 API boilerplate for TypeScript applications.'
        : parsedEnvironment.APP_DESCRIPTION,
    version: parsedEnvironment.APP_VERSION === undefined ? '0.0.1' : parsedEnvironment.APP_VERSION,
  });
}

const appConfig = registerAs<AppConfig>('app', appConfigFactory);

export default appConfig;
