import type { PrismaClient } from '../../generated/client.js';
import { seedUsers } from './users.seed.js';

type FeatureSeed = (client: PrismaClient) => Promise<void>;

export const featureSeeds: readonly FeatureSeed[] = [seedUsers];

export async function runFeatureSeeds(client: PrismaClient): Promise<void> {
  for (const seed of featureSeeds) {
    await seed(client);
  }
}
