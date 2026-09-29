import { Inject, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { DatabaseTransaction } from '../../../database/transaction/database-transaction.js';
import { createUserRequestSchema } from '../contracts/create-user-request.schema.js';
import { CREDENTIALS_REPOSITORY } from '../repositories/credentials.repository.js';
import type { CredentialsRepository } from '../repositories/credentials.repository.js';

// A fixed Argon2id hash used only to equalize the verification work for absent accounts.
const dummyPasswordHash =
  '$argon2id$v=19$m=65536,t=3,p=4$IxQuTyY6ZlXc9BP7Cd34Tw$KPNWXkCvTXLnV18yJCJK2NX5Rhy98iStOgGUWKFKxzQ';

@Injectable()
export class CredentialsService {
  constructor(@Inject(CREDENTIALS_REPOSITORY) private readonly repository: CredentialsRepository) {}

  /** Enrolls only normalized ordinary users; the caller owns transaction commit and session creation. */
  async register(
    email: string,
    displayName: string,
    password: string,
    transaction: DatabaseTransaction,
  ): Promise<string> {
    const normalized = createUserRequestSchema.parse({ email, displayName });
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    return this.repository.register(normalized.email, normalized.displayName, passwordHash, transaction);
  }

  /** Returns only current safe identity state, never a credential or profile record. */
  findCurrent(id: string): Promise<{ id: string; role: 'user' } | null> {
    return this.repository.findCurrent(id);
  }

  /** Verify the locked current hash before changing it; caller revokes sessions in the same transaction. */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    transaction: DatabaseTransaction,
  ): Promise<'changed' | 'invalid-current' | 'reuse'> {
    const hash = await this.repository.lockAndFindHash(userId, transaction);
    if (hash === null || !(await argon2.verify(hash, currentPassword))) return 'invalid-current';
    if (await argon2.verify(hash, newPassword)) return 'reuse';
    const nextHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.repository.updateHash(userId, nextHash, transaction);
    return 'changed';
  }

  /** Holds the user row through verification and session issuance in the caller's transaction. */
  async verify(email: string, password: string, transaction: DatabaseTransaction): Promise<string | null> {
    const normalized = createUserRequestSchema.shape.email.parse(email);
    const id = await this.repository.findIdByEmail(normalized, transaction);
    const hash = id === null ? null : await this.repository.lockAndFindHash(id, transaction);
    const valid = await argon2.verify(hash ?? dummyPasswordHash, password);
    return hash !== null && valid ? id : null;
  }
}
