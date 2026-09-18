import type { CreateUserRequest } from './contracts/create-user-request.schema.js';
import type { User } from './contracts/user.schema.js';

/** Injectable feature boundary for creating application User values. */
export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export interface UsersRepository {
  findById(id: string): Promise<User | null>;
  create(data: CreateUserRequest): Promise<User>;
}
