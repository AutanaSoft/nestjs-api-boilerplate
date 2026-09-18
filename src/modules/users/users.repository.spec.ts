import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../database/generated/client.js';
import type { PrismaService } from '../../database/prisma.service.js';
import { ZodError } from 'zod';
import { UserEmailConflictError } from './users.errors.js';
import { PrismaUsersRepository } from './users.repository.js';

const user = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
  createdAt: new Date('2026-09-19T12:34:56.789Z'),
  updatedAt: new Date('2026-09-19T12:34:56.789Z'),
};

const createRequest = { email: user.email, displayName: user.displayName };

function createRepository(create: ReturnType<typeof vi.fn>): PrismaUsersRepository {
  return new PrismaUsersRepository({ user: { create } } as unknown as PrismaService);
}

describe('PrismaUsersRepository', () => {
  it('creates a user through Prisma with only the public projection', async () => {
    const create = vi.fn().mockResolvedValue(user);
    const repository = createRepository(create);

    await expect(repository.create(createRequest)).resolves.toEqual(user);
    expect(create).toHaveBeenCalledWith({
      data: createRequest,
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('validates selected Prisma records at the repository boundary', async () => {
    const create = vi.fn().mockResolvedValue({ ...user, createdAt: '2026-09-19T12:34:56.789Z' });
    const repository = createRepository(create);

    await expect(repository.create(createRequest)).rejects.toBeInstanceOf(ZodError);
  });

  it.each([{ meta: { modelName: 'User', target: ['email'] } }, {}])(
    'translates Prisma P2002 errors without depending on target metadata',
    async (options) => {
      const conflict = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.10.0',
        ...options,
      });
      const repository = createRepository(vi.fn().mockRejectedValue(conflict));

      await expect(repository.create(createRequest)).rejects.toMatchObject({
        name: UserEmailConflictError.name,
        email: createRequest.email,
        code: 'CONFLICT',
        cause: conflict,
      });
    },
  );
});
