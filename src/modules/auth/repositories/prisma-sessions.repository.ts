import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import type { DatabaseTransaction } from '../../../database/transaction/database-transaction.js';
import type { SessionRecord, SessionsRepository } from './sessions.repository.js';

@Injectable()
export class PrismaSessionsRepository implements SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    digest: string,
    expiresAt: Date,
    transaction?: DatabaseTransaction,
  ): Promise<SessionRecord> {
    return (transaction?.client ?? this.prisma).session.create({
      data: { userId, expiresAt, digests: { create: { digest, expiresAt } } },
    });
  }

  async findByDigest(
    digest: string,
  ): Promise<(SessionRecord & { retiredAt: Date | null; digestExpiresAt: Date }) | null> {
    const record = await this.prisma.refreshDigest.findUnique({ where: { digest }, include: { session: true } });
    return record === null
      ? null
      : { ...record.session, retiredAt: record.retiredAt, digestExpiresAt: record.expiresAt };
  }

  async findActive(id: string, now: Date): Promise<SessionRecord | null> {
    return this.prisma.session.findFirst({ where: { id, revokedAt: null, expiresAt: { gt: now } } });
  }

  async retireDigest(digest: string, retiredAt: Date): Promise<boolean> {
    const result = await this.prisma.refreshDigest.updateMany({
      where: { digest, retiredAt: null },
      data: { retiredAt },
    });
    return result.count === 1;
  }

  async revoke(id: string, revokedAt: Date): Promise<boolean> {
    const result = await this.prisma.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt } });
    return result.count === 1;
  }

  async lockAndFindDigest(sessionId: string, digest: string, transaction: DatabaseTransaction) {
    const rows = await transaction.client.$queryRaw<{ id: string }[]>`
      SELECT id FROM sessions WHERE id = ${sessionId}::uuid FOR UPDATE
    `;
    if (rows.length !== 1) return null;
    const record = await transaction.client.refreshDigest.findUnique({
      where: { digest },
      include: { session: true },
    });
    return record === null || record.sessionId !== sessionId
      ? null
      : { ...record.session, retiredAt: record.retiredAt, digestExpiresAt: record.expiresAt };
  }

  async rotateDigest(
    sessionId: string,
    oldDigest: string,
    nextDigest: string,
    expiresAt: Date,
    now: Date,
    transaction: DatabaseTransaction,
  ): Promise<boolean> {
    const retired = await transaction.client.refreshDigest.updateMany({
      where: { digest: oldDigest, sessionId, retiredAt: null, expiresAt: { gt: now } },
      data: { retiredAt: now },
    });
    if (retired.count !== 1) return false;
    await transaction.client.refreshDigest.create({ data: { digest: nextDigest, sessionId, expiresAt } });
    await transaction.client.session.update({ where: { id: sessionId }, data: { expiresAt } });
    return true;
  }

  async revokeInTransaction(id: string, now: Date, transaction: DatabaseTransaction): Promise<void> {
    await transaction.client.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now } });
  }

  async revokeAllForUser(userId: string, now: Date, transaction: DatabaseTransaction): Promise<void> {
    await transaction.client.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
  }

  async purgeRetired(before: Date): Promise<number> {
    // A bounded batch across every session, not only the session addressed by this request.
    return this.prisma.$executeRaw`
      DELETE FROM refresh_digests WHERE digest IN (
        SELECT digest FROM refresh_digests
        WHERE retired_at IS NOT NULL AND expires_at <= ${before}
        ORDER BY expires_at LIMIT 256 FOR UPDATE SKIP LOCKED
      )
    `;
  }
}
