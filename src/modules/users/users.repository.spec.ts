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

function createRepository(
  create: ReturnType<typeof vi.fn>,
  findUnique = vi.fn(),
): PrismaUsersRepository {
  return new PrismaUsersRepository({ user: { create, findUnique } } as unknown as PrismaService);
}

describe('PrismaUsersRepository', () => {
  it('retrieves a user through Prisma with only the public projection', async () => {
    const findUnique = vi.fn().mockResolvedValue(user);
    const repository = createRepository(vi.fn(), findUnique);

    await expect(repository.findById(user.id)).resolves.toEqual(user);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('returns null when Prisma does not find a user', async () => {
    const repository = createRepository(vi.fn(), vi.fn().mockResolvedValue(null));

    await expect(repository.findById(user.id)).resolves.toBeNull();
  });

  it('validates selected Prisma records when retrieving a user', async () => {
    const repository = createRepository(
      vi.fn(),
      vi.fn().mockResolvedValue({ ...user, createdAt: '2026-09-19T12:34:56.789Z' }),
    );

    await expect(repository.findById(user.id)).rejects.toBeInstanceOf(ZodError);
  });

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
