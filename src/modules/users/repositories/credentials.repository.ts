import type { DatabaseTransaction } from '../../../database/transaction/database-transaction.js';

/** Internal Users-owned credential persistence API. Never expose hashes in its returned values. */
export interface CredentialsRepository {
  register(email: string, displayName: string, passwordHash: string, transaction: DatabaseTransaction): Promise<string>;
  findIdByEmail(email: string, transaction: DatabaseTransaction): Promise<string | null>;
  findCurrent(id: string): Promise<{ id: string; role: 'user' } | null>;
  /** Lock the user row before reading its current hash, serializing competing password changes. */
  lockAndFindHash(id: string, transaction: DatabaseTransaction): Promise<string | null>;
  updateHash(id: string, passwordHash: string, transaction: DatabaseTransaction): Promise<void>;
}

export const CREDENTIALS_REPOSITORY = Symbol('CREDENTIALS_REPOSITORY');
