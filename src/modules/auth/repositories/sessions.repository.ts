import type { DatabaseTransaction } from '../../../database/transaction/database-transaction.js';

export const SESSIONS_REPOSITORY = Symbol('SESSIONS_REPOSITORY');

export type SessionRecord = Readonly<{
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}>;

/** Persists Auth-owned sessions and digest history; callers supply only non-reversible digests. */
export interface SessionsRepository {
  create(userId: string, digest: string, expiresAt: Date, transaction?: DatabaseTransaction): Promise<SessionRecord>;
  findByDigest(digest: string): Promise<(SessionRecord & { retiredAt: Date | null; digestExpiresAt: Date }) | null>;
  findActive(id: string, now: Date): Promise<SessionRecord | null>;
  retireDigest(digest: string, retiredAt: Date): Promise<boolean>;
  revoke(id: string, revokedAt: Date): Promise<boolean>;
  /** Lock the parent row before re-reading a digest; never infer currentness from the pre-lock lookup. */
  lockAndFindDigest(
    sessionId: string,
    digest: string,
    transaction: DatabaseTransaction,
  ): Promise<(SessionRecord & { retiredAt: Date | null; digestExpiresAt: Date }) | null>;
  rotateDigest(
    sessionId: string,
    oldDigest: string,
    nextDigest: string,
    expiresAt: Date,
    now: Date,
    transaction: DatabaseTransaction,
  ): Promise<boolean>;
  revokeInTransaction(id: string, now: Date, transaction: DatabaseTransaction): Promise<void>;
  /** Globally remove only retired digests past the full replay-detection window. */
  purgeRetired(before: Date): Promise<number>;
}
