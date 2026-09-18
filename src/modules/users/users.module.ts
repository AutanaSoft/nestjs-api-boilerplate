import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { UsersController } from './controllers/users.controller.js';
import { PrismaUsersRepository } from './repositories/prisma-users.repository.js';
import { USERS_REPOSITORY } from './repositories/users.repository.js';
import { UsersService } from './services/users.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [{ provide: USERS_REPOSITORY, useClass: PrismaUsersRepository }, UsersService],
})
export class UsersModule {}
