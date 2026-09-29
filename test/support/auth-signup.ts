import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service.js';

/** Creates a real HTTP user/session fixture; only storage tests use the minimal DB lookup for the ID. */
export async function signUpFixture(app: INestApplication, displayName = 'Test User') {
  const email = `${randomUUID()}@example.test`;
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/sign-up')
    .send({ email, displayName, password: 'test fixture password' })
    .expect(201);
  const user = await app.get(PrismaService).user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  return { id: user.id, email, accessToken: response.body.accessToken as string };
}
