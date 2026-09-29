import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Prisma } from '../../../database/generated/client.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { DatabaseTransaction } from '../../../database/transaction/database-transaction.js';
import { UserEmailConflictError } from '../users.errors.js';
import type { CredentialsRepository } from './credentials.repository.js';

@Injectable()
export class PrismaCredentialsRepository implements CredentialsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async register(
    email: string,
    displayName: string,
    passwordHash: string,
    transaction: DatabaseTransaction,
  ): Promise<string> {
    try {
      const user = await transaction.client.user.create({
        data: { email, displayName, passwordHash, role: 'user' },
        select: { id: true },
      });
      return user.id;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new UserEmailConflictError(email, { cause: error });
      }
      throw error;
    }
  }

  async findCurrent(id: string): Promise<{ id: string; role: 'user' } | null> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    return user === null ? null : { id: user.id, role: z.literal('user').parse(user.role) };
  }

  async lockAndFindHash(id: string, transaction: DatabaseTransaction): Promise<string | null> {
    const rows = await transaction.client.$queryRaw<{ id: string }[]>`
      SELECT id FROM users WHERE id = ${id}::uuid FOR UPDATE
    `;
    if (rows.length !== 1) return null;
    const user = await transaction.client.user.findUnique({ where: { id }, select: { passwordHash: true } });
    return user?.passwordHash ?? null;
  }

  async updateHash(id: string, passwordHash: string, transaction: DatabaseTransaction): Promise<void> {
    await transaction.client.user.update({ where: { id }, data: { passwordHash } });
  }

  async findIdByEmail(email: string, transaction: DatabaseTransaction): Promise<string | null> {
    const user = await transaction.client.user.findUnique({ where: { email }, select: { id: true } });
    return user?.id ?? null;
  }
}
