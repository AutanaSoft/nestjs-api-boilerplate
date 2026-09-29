import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import authConfig from '../../config/auth.config.js';
import { DatabaseTransactionRunner } from '../../database/transaction/database-transaction.js';
import type { DatabaseTransaction } from '../../database/transaction/database-transaction.js';
import { CredentialsService } from '../users/services/credentials.service.js';
import type { SignUpRequest } from './contracts/sign-up.schema.js';
import type { SignInRequest } from './contracts/sign-in.schema.js';
import type { RefreshRequest } from './contracts/refresh.schema.js';
import type { ChangePasswordRequest } from './contracts/change-password.schema.js';
import {
  InvalidCredentialsError,
  InvalidCurrentPasswordError,
  InvalidRefreshTokenError,
  PasswordReuseNotAllowedError,
} from './auth.errors.js';
import { SESSIONS_REPOSITORY } from './repositories/sessions.repository.js';
import type { SessionsRepository } from './repositories/sessions.repository.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly transactions: DatabaseTransactionRunner,
    private readonly jwt: JwtService,
    @Inject(SESSIONS_REPOSITORY) private readonly sessions: SessionsRepository,
    @Inject(authConfig.KEY) private readonly config: ConfigType<typeof authConfig>,
  ) {}

  async signUp(request: SignUpRequest) {
    return this.transactions.run(async (transaction) => {
      const userId = await this.credentials.register(request.email, request.displayName, request.password, transaction);
      return this.issueTokens(userId, transaction);
    });
  }

  async signIn(request: SignInRequest) {
    return this.transactions.runReadCommitted(async (transaction) => {
      const userId = await this.credentials.verify(request.email, request.password, transaction);
      if (userId === null) throw new InvalidCredentialsError();
      return this.issueTokens(userId, transaction);
    });
  }

  async refresh(request: RefreshRequest) {
    const digest = createHash('sha256').update(request.refreshToken).digest('hex');
    const candidate = await this.sessions.findByDigest(digest);
    if (candidate === null) throw new InvalidRefreshTokenError();

    const nextToken = randomBytes(32).toString('base64url');
    const nextDigest = createHash('sha256').update(nextToken).digest('hex');
    const result = await this.transactions.runReadCommitted(async (transaction) => {
      const current = await this.sessions.lockAndFindDigest(candidate.id, digest, transaction);
      const at = new Date();
      if (current === null) return null;
      if (current.retiredAt !== null) {
        if (current.digestExpiresAt.getTime() + 7 * 24 * 60 * 60 * 1000 > at.getTime()) {
          await this.sessions.revokeInTransaction(current.id, at, transaction);
        }
        // Return, never throw: replay revocation must commit before the public 401.
        return null;
      }
      if (current.revokedAt !== null || current.expiresAt <= at || current.digestExpiresAt <= at) return null;
      const expiresAt = new Date((Math.floor(at.getTime() / 1000) + this.config.accessTtlSeconds) * 1000);
      const refreshExpiresAt = new Date(at.getTime() + this.config.refreshTtlSeconds * 1000);
      if (!(await this.sessions.rotateDigest(current.id, digest, nextDigest, refreshExpiresAt, at, transaction))) {
        return null;
      }
      const accessToken = await this.jwt.signAsync({
        sub: current.userId,
        sid: current.id,
        exp: Math.floor(expiresAt.getTime() / 1000),
      });
      return {
        accessToken,
        expiresAt: expiresAt.toISOString(),
        refreshToken: nextToken,
        refreshExpiresAt: refreshExpiresAt.toISOString(),
      };
    });
    if (result === null) throw new InvalidRefreshTokenError();
    return result;
  }

  async changePassword(userId: string, request: ChangePasswordRequest): Promise<void> {
    await this.transactions.runReadCommitted(async (transaction) => {
      const result = await this.credentials.changePassword(
        userId,
        request.currentPassword,
        request.newPassword,
        transaction,
      );
      if (result === 'invalid-current') throw new InvalidCurrentPasswordError();
      if (result === 'reuse') throw new PasswordReuseNotAllowedError();
      // Session updates wait for any in-flight rotation row locks; the commit is the revocation boundary.
      await this.sessions.revokeAllForUser(userId, new Date(), transaction);
    });
  }

  /** Revokes only the authenticated session, never all of the user's sessions. */
  async signOut(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId, new Date());
  }

  private async issueTokens(userId: string, transaction: DatabaseTransaction) {
    const now = Date.now();
    const refreshToken = randomBytes(32).toString('base64url');
    // SHA-256 is collision-resistant for uniformly random 256-bit opaque tokens; no low-entropy secret is hashed here.
    const digest = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date((Math.floor(now / 1000) + this.config.accessTtlSeconds) * 1000);
    const refreshExpiresAt = new Date(now + this.config.refreshTtlSeconds * 1000);
    const session = await this.sessions.create(userId, digest, refreshExpiresAt, transaction);
    const accessToken = await this.jwt.signAsync({
      sub: userId,
      sid: session.id,
      exp: Math.floor(expiresAt.getTime() / 1000),
    });
    return {
      accessToken,
      expiresAt: expiresAt.toISOString(),
      refreshToken,
      refreshExpiresAt: refreshExpiresAt.toISOString(),
    };
  }
}
