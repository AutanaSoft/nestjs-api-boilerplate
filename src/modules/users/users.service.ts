import { Inject, Injectable } from '@nestjs/common';
import type { CreateUserRequest } from './contracts/create-user-request.schema.js';
import type { UpdateUserRequest } from './contracts/update-user-request.schema.js';
import type { User } from './contracts/user.schema.js';
import { UserNotFoundError } from './users.errors.js';
import { USERS_REPOSITORY } from './users.repository.port.js';
import type { UsersRepository } from './users.repository.port.js';

@Injectable()
export class UsersService {
  constructor(@Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository) {}

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);

    if (user === null) {
      throw new UserNotFoundError();
    }

    return user;
  }

  create(data: CreateUserRequest): Promise<User> {
    return this.usersRepository.create(data);
  }

  async update(id: string, data: UpdateUserRequest): Promise<User> {
    const user = await this.usersRepository.update(id, data);

    if (user === null) {
      throw new UserNotFoundError();
    }

    return user;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.usersRepository.delete(id);

    if (deleted === null) {
      throw new UserNotFoundError();
    }
  }
}
