import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import type { SessionRecord, SessionsRepository } from './sessions.repository.js';

@Injectable()
export class PrismaSessionsRepository implements SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, digest: string, expiresAt: Date): Promise<SessionRecord> {
    return this.prisma.session.create({
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
}
