import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { UsersController } from './controllers/users.controller.js';
import { PrismaCredentialsRepository } from './repositories/prisma-credentials.repository.js';
import { CREDENTIALS_REPOSITORY } from './repositories/credentials.repository.js';
import { CredentialsService } from './services/credentials.service.js';
import { PrismaUsersRepository } from './repositories/prisma-users.repository.js';
import { USERS_REPOSITORY } from './repositories/users.repository.js';
import { UsersService } from './services/users.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [
    { provide: USERS_REPOSITORY, useClass: PrismaUsersRepository },
    { provide: CREDENTIALS_REPOSITORY, useClass: PrismaCredentialsRepository },
    UsersService,
    CredentialsService,
  ],
  exports: [CredentialsService],
})
export class UsersModule {}
