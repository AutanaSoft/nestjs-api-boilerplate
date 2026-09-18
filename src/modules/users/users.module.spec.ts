import { SELF_DECLARED_DEPS_METADATA } from '@nestjs/common/constants';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { USERS_REPOSITORY } from './repositories/users.repository.js';
import { PrismaUsersRepository } from './repositories/prisma-users.repository.js';
import { UsersModule } from './users.module.js';
import { UsersService } from './services/users.service.js';

describe('UsersModule', () => {
  it('binds the feature repository token to the Prisma adapter', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, UsersModule) as unknown[];

    expect(providers).toContainEqual({
      provide: USERS_REPOSITORY,
      useClass: PrismaUsersRepository,
    });
  });

  it('injects the repository port into UsersService', () => {
    const dependencies = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, UsersService) as Array<{
      index: number;
      param: unknown;
    }>;

    expect(dependencies).toContainEqual({ index: 0, param: USERS_REPOSITORY });
  });
});
