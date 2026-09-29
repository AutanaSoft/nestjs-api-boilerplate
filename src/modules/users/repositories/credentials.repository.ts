import type { DatabaseTransaction } from '../../../database/transaction/database-transaction.js';

/** Internal Users-owned credential persistence API. Never expose hashes in its returned values. */
export interface CredentialsRepository {
  register(email: string, displayName: string, passwordHash: string, transaction: DatabaseTransaction): Promise<string>;
  findHashByEmail(email: string): Promise<{ id: string; passwordHash: string } | null>;
  findCurrent(id: string): Promise<{ id: string; role: 'user' } | null>;
}

export const CREDENTIALS_REPOSITORY = Symbol('CREDENTIALS_REPOSITORY');
