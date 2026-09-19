import { describe, expect, it, vi } from 'vitest';
import type { DatabaseConfig } from '../../config/database.config.js';
import { assertSeedNodeEnvironment, parseSeedEnvironment, runSeed, type SeedClient } from './seed.js';
import { runFeatureSeeds } from './seeds/index.js';

const developmentEnvironment = {
  DATABASE_URL: 'postgresql://seed:seed@127.0.0.1:5432/seed',
  NODE_ENV: 'development',
};

describe('parseSeedEnvironment', () => {
  it('requires an explicit development environment argument', () => {
    expect(parseSeedEnvironment(['--environment', 'development'])).toBe('development');
  });

  it.each([
    { args: [] },
    { args: ['--environment'] },
    { args: ['--environment', 'production'] },
    { args: ['--environment', 'test'] },
    { args: ['--environment=development'] },
  ])('rejects an invalid seed argument list: $args', ({ args }) => {
    expect(() => parseSeedEnvironment(args)).toThrow('--environment development argument');
  });
});

describe('assertSeedNodeEnvironment', () => {
  it.each(['production', 'test'])('rejects NODE_ENV=%s', (nodeEnvironment) => {
    expect(() => assertSeedNodeEnvironment(nodeEnvironment)).toThrow('not allowed in production or test environments');
  });

  it('allows development and an unset NODE_ENV', () => {
    expect(() => assertSeedNodeEnvironment('development')).not.toThrow();
    expect(() => assertSeedNodeEnvironment(undefined)).not.toThrow();
  });
});

describe('runSeed', () => {
  it.each(['production', 'test'])('does not create a client for NODE_ENV=%s', async (nodeEnvironment) => {
    const createClient = vi.fn((_database: DatabaseConfig): SeedClient => {
      throw new Error('client creation should not be reached');
    });

    await expect(
      runSeed(
        ['--environment', 'development'],
        { ...developmentEnvironment, NODE_ENV: nodeEnvironment },
        { createClient },
      ),
    ).rejects.toThrow('not allowed in production or test environments');
    expect(createClient).not.toHaveBeenCalled();
  });

  it('disconnects the client after the ordered seeds complete', async () => {
    const client = {
      $disconnect: vi.fn<() => Promise<void>>().mockResolvedValue(),
    } as unknown as SeedClient;
    const createClient = vi.fn((_database: DatabaseConfig) => client);
    const runSeeds = vi.fn<() => Promise<void>>().mockResolvedValue();

    await runSeed(['--environment', 'development'], developmentEnvironment, {
      createClient,
      runFeatureSeeds: runSeeds,
    });

    expect(createClient).toHaveBeenCalledOnce();
    expect(runSeeds).toHaveBeenCalledOnce();
    expect(client.$disconnect).toHaveBeenCalledOnce();
  });

  it('disconnects the client when a seed fails', async () => {
    const client = {
      $disconnect: vi.fn<() => Promise<void>>().mockResolvedValue(),
    } as unknown as SeedClient;
    const failure = new Error('seed failed');

    await expect(
      runSeed(['--environment', 'development'], developmentEnvironment, {
        createClient: () => client,
        runFeatureSeeds: vi.fn<() => Promise<void>>().mockRejectedValue(failure),
      }),
    ).rejects.toBe(failure);

    expect(client.$disconnect).toHaveBeenCalledOnce();
  });

  it('runs the initial feature seed as a no-op', async () => {
    await expect(runFeatureSeeds({} as SeedClient)).resolves.toBeUndefined();
  });
});
