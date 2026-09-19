import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { Pool } from 'pg';

const loopbackHosts = new Set(['127.0.0.1', '::1', 'localhost']);

export type E2EDatabase = Readonly<{
  url: string;
  dispose: () => Promise<void>;
}>;

export function parseE2EDatabaseAdminUrl(value: string | undefined): URL {
  if (value === undefined) {
    throw new Error('E2E_DATABASE_ADMIN_URL is required for real database E2E tests');
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('E2E_DATABASE_ADMIN_URL must be a valid PostgreSQL URL');
  }

  if (
    (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') ||
    !loopbackHosts.has(url.hostname) ||
    url.pathname !== '/postgres' ||
    url.search !== ''
  ) {
    throw new Error('E2E_DATABASE_ADMIN_URL must target the loopback PostgreSQL maintenance database');
  }

  return url;
}

export async function createE2EDatabase(): Promise<E2EDatabase> {
  const adminUrl = parseE2EDatabaseAdminUrl(process.env.E2E_DATABASE_ADMIN_URL);
  const databaseName = `e2e_${randomUUID().replaceAll('-', '')}`;
  const adminPool = new Pool({ connectionString: adminUrl.toString() });

  try {
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await adminPool.end();
  }

  const databaseUrl = new URL(adminUrl);
  databaseUrl.pathname = `/${databaseName}`;

  return {
    url: databaseUrl.toString(),
    dispose: async () => {
      const cleanupPool = new Pool({ connectionString: adminUrl.toString() });

      try {
        await cleanupPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
      } finally {
        await cleanupPool.end();
      }
    },
  };
}

export async function applyE2EDatabaseMigrations(databaseUrl: string): Promise<void> {
  const prismaCli = resolve(process.cwd(), 'node_modules/prisma/build/index.js');
  const exitCode = await new Promise<number | null>((resolveExit, reject) => {
    const child = spawn(process.execPath, [prismaCli, 'migrate', 'deploy', '--config', 'prisma.config.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'ignore',
    });

    child.once('error', reject);
    child.once('exit', resolveExit);
  });

  if (exitCode !== 0) {
    throw new Error('Prisma migration deployment failed for the isolated E2E database');
  }
}
