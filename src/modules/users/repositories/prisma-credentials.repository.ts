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

  findHashByEmail(email: string): Promise<{ id: string; passwordHash: string } | null> {
    return this.prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
  }
}
