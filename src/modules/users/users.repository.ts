import { Injectable } from '@nestjs/common';
import { Prisma } from '../../database/generated/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { CreateUserRequest } from './contracts/create-user-request.schema.js';
import type { UpdateUserRequest } from './contracts/update-user-request.schema.js';
import { userSchema } from './contracts/user.schema.js';
import type { User } from './contracts/user.schema.js';
import { UserEmailConflictError } from './users.errors.js';
import type { UsersRepository } from './users.repository.port.js';

const userSelect = {
  id: true,
  email: true,
  displayName: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type PrismaUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

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

  async create(data: CreateUserRequest): Promise<User> {
    try {
      const user: PrismaUser = await this.prisma.user.create({
        data,
        select: userSelect,
      });

      return userSchema.parse(user);
    } catch (error: unknown) {
      if (isUniqueEmailViolation(error)) {
        throw new UserEmailConflictError(data.email, { cause: error });
      }

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
      if (isRecordNotFound(error)) {
        return null;
      }

      if (isUniqueEmailViolation(error)) {
        throw new UserEmailConflictError(data.email ?? '', { cause: error });
      }

      throw error;
    }
  }

  async delete(id: string): Promise<boolean | null> {
    try {
      await this.prisma.user.delete({ where: { id } });
      return true;
    } catch (error: unknown) {
      if (isRecordNotFound(error)) {
        return null;
      }

      throw error;
    }
  }
}

function isUniqueEmailViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}
