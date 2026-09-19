import { PrismaPg } from '@prisma/adapter-pg';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDatabaseConfig } from '../../config/database.config.js';
import type { DatabaseConfig } from '../../config/database.config.js';
import { PrismaClient } from '../generated/client.js';
import { runFeatureSeeds } from './seeds/index.js';

export const DEVELOPMENT_SEED_ENVIRONMENT = 'development';

export type SeedClient = PrismaClient;

export type SeedDependencies = Readonly<{
  createClient?: (database: DatabaseConfig) => SeedClient;
  runFeatureSeeds?: (client: SeedClient) => Promise<void>;
}>;

export function parseSeedEnvironment(args: readonly string[]): typeof DEVELOPMENT_SEED_ENVIRONMENT {
  if (args.length !== 2 || args[0] !== '--environment' || args[1] !== DEVELOPMENT_SEED_ENVIRONMENT) {
    throw new Error('Seed requires the explicit --environment development argument');
  }

  return DEVELOPMENT_SEED_ENVIRONMENT;
}

export function assertSeedNodeEnvironment(nodeEnvironment: string | undefined): void {
  if (nodeEnvironment === 'production' || nodeEnvironment === 'test') {
    throw new Error('Database seeds are not allowed in production or test environments');
  }
}

export function createSeedClient(database: DatabaseConfig): SeedClient {
  const adapter = new PrismaPg(database.url);

  return new PrismaClient({ adapter });
}

export async function runSeed(
  args: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
  dependencies: SeedDependencies = {},
): Promise<void> {
  parseSeedEnvironment(args);
  assertSeedNodeEnvironment(environment.NODE_ENV);

  const database = buildDatabaseConfig(environment);
  const client = (dependencies.createClient ?? createSeedClient)(database);

  try {
    await (dependencies.runFeatureSeeds ?? runFeatureSeeds)(client);
  } finally {
    await client.$disconnect();
  }
}

export async function main(
  args: readonly string[] = process.argv.slice(2),
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  await runSeed(args, environment);
}

const isMainModule = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMainModule) {
  void main().catch(() => {
    process.stderr.write('Database seed failed.\n');
    process.exitCode = 1;
  });
}
