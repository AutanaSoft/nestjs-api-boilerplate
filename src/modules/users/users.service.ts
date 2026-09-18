import { Inject, Injectable } from '@nestjs/common';
import type { CreateUserRequest } from './contracts/create-user-request.schema.js';
import type { User } from './contracts/user.schema.js';
import { USERS_REPOSITORY } from './users.repository.port.js';
import type { UsersRepository } from './users.repository.port.js';

@Injectable()
export class UsersService {
  constructor(@Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository) {}

  create(data: CreateUserRequest): Promise<User> {
    return this.usersRepository.create(data);
  }
}
