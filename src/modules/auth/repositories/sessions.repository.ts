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
}
