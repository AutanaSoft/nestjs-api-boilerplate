import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'src/database/prisma',
  migrations: {
    path: 'src/database/prisma/migrations',
    seed: 'tsx src/database/prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
