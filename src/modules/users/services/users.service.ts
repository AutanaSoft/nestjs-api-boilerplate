import { Inject, Injectable } from '@nestjs/common';
import type { ListUsersRequest } from '../contracts/list-users-request.schema.js';
import type { ListUsersResponseInput } from '../contracts/list-users-response.schema.js';
import type { CreateUserRequest } from '../contracts/create-user-request.schema.js';
import type { UpdateUserRequest } from '../contracts/update-user-request.schema.js';
import type { User } from '../contracts/user.schema.js';
import { decodeListUsersCursor, encodeListUsersCursor } from '../list-users-cursor.codec.js';
import { UserNotFoundError } from '../users.errors.js';
import { USERS_REPOSITORY } from '../repositories/users.repository.js';
import type { UsersRepository } from '../repositories/users.repository.js';

@Injectable()
export class UsersService {
  constructor(@Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository) {}

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (user === null) throw new UserNotFoundError();
    return user;
  }

  async list(request: ListUsersRequest): Promise<ListUsersResponseInput> {
    const cursorDirection =
      request.after === undefined ? (request.before === undefined ? undefined : 'before') : 'after';
    const cursorValue = request.after ?? request.before;
    const context = { sort: request.sort, direction: request.direction };
    const cursor =
      cursorValue === undefined ? undefined : decodeListUsersCursor(cursorValue, context);
    const result = await this.usersRepository.list({ request, cursor, cursorDirection });

    if (result.data.length === 0) {
      return {
        data: [],
        pageInfo: {
          nextCursor: null,
          previousCursor: null,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    }

    return {
      data: result.data,
      pageInfo: {
        hasNextPage: result.hasNextPage,
        hasPreviousPage: result.hasPreviousPage,
        nextCursor: result.hasNextPage
          ? encodeListUsersCursor(context, positionFor(request.sort, result.data.at(-1)!))
          : null,
        previousCursor: result.hasPreviousPage
          ? encodeListUsersCursor(context, positionFor(request.sort, result.data[0]))
          : null,
      },
    };
  }

  create(data: CreateUserRequest): Promise<User> {
    return this.usersRepository.create(data);
  }

  async update(id: string, data: UpdateUserRequest): Promise<User> {
    const user = await this.usersRepository.update(id, data);
    if (user === null) throw new UserNotFoundError();
    return user;
  }

  async delete(id: string): Promise<void> {
    if ((await this.usersRepository.delete(id)) === null) throw new UserNotFoundError();
  }
}

function positionFor(sort: ListUsersRequest['sort'], user: User) {
  return sort === 'createdAt'
    ? { id: user.id, createdAt: user.createdAt }
    : { id: user.id, displayName: user.displayName };
}
