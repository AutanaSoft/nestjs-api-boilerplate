import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';
import authConfig from '../../config/auth.config.js';
import { DatabaseModule } from '../../database/database.module.js';
import { DatabaseTransactionRunner } from '../../database/transaction/database-transaction.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PrismaSessionsRepository } from './repositories/prisma-sessions.repository.js';
import { SESSIONS_REPOSITORY } from './repositories/sessions.repository.js';
import { APP_GUARD } from '@nestjs/core';
import { AccessTokenGuard } from './guards/access-token.guard.js';

@Module({
  imports: [
    UsersModule,
    DatabaseModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [authConfig.KEY],
      useFactory: (config: ConfigType<typeof authConfig>) => ({ secret: config.jwtSecret }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    DatabaseTransactionRunner,
    { provide: SESSIONS_REPOSITORY, useClass: PrismaSessionsRepository },
  ],
})
export class AuthModule {}
