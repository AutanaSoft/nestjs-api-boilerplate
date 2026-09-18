import { Injectable } from '@nestjs/common';
import { Prisma } from '../../database/generated/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { CreateUserRequest } from './contracts/create-user-request.schema.js';
import type { UpdateUserRequest } from './contracts/update-user-request.schema.js';
import { userSchema } from './contracts/user.schema.js';
import type { User } from './contracts/user.schema.js';
import { UserEmailConflictError } from './users.errors.js';
import type {
  ListUsersRepositoryQuery,
  ListUsersRepositoryResult,
  UsersRepository,
} from './users.repository.port.js';

const userSelect = {
  id: true,
  email: true,
  displayName: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type PrismaUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;
type Direction = 'asc' | 'desc';

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const user: PrismaUser | null = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    return user === null ? null : userSchema.parse(user);
  }

  async list(query: ListUsersRepositoryQuery): Promise<ListUsersRepositoryResult> {
    const { request, cursor, cursorDirection } = query;
    const direction = cursorDirection === 'before' ? invert(request.direction) : request.direction;
    const boundary = cursor === undefined ? undefined : seekWhere(request.sort, direction, cursor);
    const users = await this.prisma.user.findMany({
      where: combineWhere(request.email, boundary),
      orderBy: orderBy(request.sort, direction),
      take: request.limit + 1,
      select: userSelect,
    });
    const page = users.slice(0, request.limit).map((user) => userSchema.parse(user));
    const data = cursorDirection === 'before' ? page.reverse() : page;

    if (data.length === 0) {
      return { data, hasNextPage: false, hasPreviousPage: false };
    }

    const [previous, next] = await Promise.all([
      this.prisma.user.findFirst({
        where: combineWhere(
          request.email,
          seekWhere(request.sort, invert(request.direction), data[0]),
        ),
        orderBy: orderBy(request.sort, invert(request.direction)),
        select: { id: true },
      }),
      this.prisma.user.findFirst({
        where: combineWhere(
          request.email,
          seekWhere(request.sort, request.direction, data.at(-1)!),
        ),
        orderBy: orderBy(request.sort, request.direction),
        select: { id: true },
      }),
    ]);

    return { data, hasNextPage: next !== null, hasPreviousPage: previous !== null };
  }

  async create(data: CreateUserRequest): Promise<User> {
    try {
      const user: PrismaUser = await this.prisma.user.create({ data, select: userSelect });
      return userSchema.parse(user);
    } catch (error: unknown) {
      if (isUniqueEmailViolation(error))
        throw new UserEmailConflictError(data.email, { cause: error });
      throw error;
    }
  }

  async update(id: string, data: UpdateUserRequest): Promise<User | null> {
    try {
      const user: PrismaUser = await this.prisma.user.update({
        where: { id },
        data,
        select: userSelect,
      });
      return userSchema.parse(user);
    } catch (error: unknown) {
      if (isRecordNotFound(error)) return null;
      if (isUniqueEmailViolation(error))
        throw new UserEmailConflictError(data.email ?? '', { cause: error });
      throw error;
    }
  }

  async delete(id: string): Promise<boolean | null> {
    try {
      await this.prisma.user.delete({ where: { id } });
      return true;
    } catch (error: unknown) {
      if (isRecordNotFound(error)) return null;
      throw error;
    }
  }
}

function combineWhere(
  email: string | undefined,
  boundary: Prisma.UserWhereInput | undefined,
): Prisma.UserWhereInput {
  const filters: Prisma.UserWhereInput[] = [];
  if (email !== undefined) filters.push({ email });
  if (boundary !== undefined) filters.push(boundary);
  return filters.length === 0 ? {} : { AND: filters };
}

function orderBy(
  sort: 'createdAt' | 'displayName',
  direction: Direction,
): Prisma.UserOrderByWithRelationInput[] {
  return [{ [sort]: direction }, { id: direction }];
}

function seekWhere(
  sort: 'createdAt' | 'displayName',
  direction: Direction,
  user: Pick<User, 'id'> & Partial<Pick<User, 'createdAt' | 'displayName'>>,
): Prisma.UserWhereInput {
  const value = sort === 'createdAt' ? user.createdAt! : user.displayName!;
  const comparison = direction === 'asc' ? 'gt' : 'lt';
  return {
    OR: [{ [sort]: { [comparison]: value } }, { [sort]: value, id: { [comparison]: user.id } }],
  };
}

function invert(direction: Direction): Direction {
  return direction === 'asc' ? 'desc' : 'asc';
}

function isUniqueEmailViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}
