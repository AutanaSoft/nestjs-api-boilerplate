import type { CreateUserRequest } from '../contracts/create-user-request.schema.js';
import type { UpdateUserRequest } from '../contracts/update-user-request.schema.js';
import type { ListUsersRequest } from '../contracts/list-users-request.schema.js';
import type { User } from '../contracts/user.schema.js';
import type { ListUsersCursorPosition } from '../codecs/list-users-cursor.codec.js';

export type ListUsersRepositoryQuery = Readonly<{
  request: ListUsersRequest;
  cursor?: ListUsersCursorPosition;
  cursorDirection?: 'after' | 'before';
}>;

export type ListUsersRepositoryResult = Readonly<{
  data: User[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}>;

/** Injectable feature boundary for creating application User values. */
export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export interface UsersRepository {
  findById(id: string): Promise<User | null>;
  list(query: ListUsersRepositoryQuery): Promise<ListUsersRepositoryResult>;
  create(data: CreateUserRequest): Promise<User>;
  update(id: string, data: UpdateUserRequest): Promise<User | null>;
  delete(id: string): Promise<boolean | null>;
}
