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
import { InvalidCredentialsError } from './auth.errors.js';
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
    const userId = await this.credentials.verify(request.email, request.password);
    if (userId === null) throw new InvalidCredentialsError();
    return this.transactions.run((transaction) => this.issueTokens(userId, transaction));
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
