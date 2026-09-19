import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const postgresUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;

  return protocol === 'postgresql:' || protocol === 'postgres:';
}, 'DATABASE_URL must use the PostgreSQL protocol');

export const databaseEnvironmentSchema = z.object({
  DATABASE_URL: postgresUrlSchema,
});

export const databaseConfigSchema = z.object({
  url: postgresUrlSchema,
});

export type DatabaseConfig = Readonly<z.output<typeof databaseConfigSchema>>;
export type DatabaseEnvironment = z.input<typeof databaseEnvironmentSchema>;

export function buildDatabaseConfig(environment: Partial<DatabaseEnvironment> = process.env): DatabaseConfig {
  const parsedEnvironment = databaseEnvironmentSchema.parse(environment);

  return databaseConfigSchema.parse({ url: parsedEnvironment.DATABASE_URL });
}

const databaseConfig = registerAs<DatabaseConfig>('database', buildDatabaseConfig);

export default databaseConfig;
