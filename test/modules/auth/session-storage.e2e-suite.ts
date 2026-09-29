import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { expect, it } from 'vitest';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { PrismaSessionsRepository } from '../../../src/modules/auth/repositories/prisma-sessions.repository.js';
import type { E2ESuiteRegistration } from '../../support/e2e-context.js';

export function registerSessionStorageE2ESuite({ runScenario }: E2ESuiteRegistration): void {
  it('persists digest history and cascades user deletion without affecting other sessions', async () => {
    await runScenario(async ({ app }) => {
      const prisma = app.get(PrismaService);
      const first = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({ email: `${randomUUID()}@example.test`, displayName: 'First User' })
        .expect(201);
      const second = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({ email: `${randomUUID()}@example.test`, displayName: 'Second User' })
        .expect(201);
      const expiresAt = new Date(Date.now() + 60_000);
      const repository = new PrismaSessionsRepository(prisma);
      const digest = randomUUID();
      const session = await repository.create(first.body.id, digest, expiresAt);
      const other = await prisma.session.create({ data: { userId: second.body.id, expiresAt } });
      const current = await repository.findByDigest(digest);
      expect(current?.id).toBe(session.id);
      expect(current?.retiredAt).toBeNull();
      expect(current?.digestExpiresAt).toEqual(expiresAt);
      expect(await repository.findActive(session.id, new Date())).not.toBeNull();
      const retiredAt = new Date();
      expect(await repository.retireDigest(digest, retiredAt)).toBe(true);
      expect(await repository.retireDigest(digest, new Date())).toBe(false);
      expect((await repository.findByDigest(digest))?.retiredAt).toEqual(retiredAt);
      expect(await repository.revoke(session.id, new Date())).toBe(true);
      expect(await repository.revoke(session.id, new Date())).toBe(false);
      expect(await repository.findActive(session.id, new Date())).toBeNull();
      expect(await repository.findActive(other.id, new Date())).not.toBeNull();
      await prisma.user.delete({ where: { id: first.body.id } });
      expect(await prisma.session.findUnique({ where: { id: session.id } })).toBeNull();
      expect(await prisma.refreshDigest.count({ where: { sessionId: session.id } })).toBe(0);
      expect(await prisma.session.findUnique({ where: { id: other.id } })).not.toBeNull();
    });
  });

  it('rolls back user deletion and its session cascade together', async () => {
    await runScenario(async ({ app }) => {
      const prisma = app.get(PrismaService);
      const user = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({ email: `${randomUUID()}@example.test`, displayName: 'Rollback User' })
        .expect(201);
      const session = await prisma.session.create({
        data: { userId: user.body.id, expiresAt: new Date(Date.now() + 60_000) },
      });
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.user.delete({ where: { id: user.body.id } });
          throw new Error('rollback marker');
        }),
      ).rejects.toThrow('rollback marker');
      expect(await prisma.user.findUnique({ where: { id: user.body.id } })).not.toBeNull();
      expect(await prisma.session.findUnique({ where: { id: session.id } })).not.toBeNull();
    });
  });
}
