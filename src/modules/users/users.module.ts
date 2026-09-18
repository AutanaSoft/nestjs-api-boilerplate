import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { UsersController } from './users.controller.js';
import { PrismaUsersRepository } from './users.repository.js';
import { USERS_REPOSITORY } from './users.repository.port.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [{ provide: USERS_REPOSITORY, useClass: PrismaUsersRepository }, UsersService],
})
export class UsersModule {}
