import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/client.js';
import { PrismaService } from '../prisma.service.js';

/** Opaque shared transaction handle passed through feature APIs; only repositories inspect it. */
export interface DatabaseTransaction {
  readonly client: Prisma.TransactionClient;
}

@Injectable()
export class DatabaseTransactionRunner {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(work: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((client) => work({ client }));
  }

  /** Rotation needs a new READ COMMITTED statement snapshot after waiting on a session row lock. */
  runReadCommitted<T>(work: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((client) => work({ client }), {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 10_000,
      timeout: 20_000,
    });
  }
}
