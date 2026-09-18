import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../database/generated/client.js';
import type { PrismaService } from '../../../database/prisma.service.js';
import { ZodError } from 'zod';
import { UserEmailConflictError } from '../users.errors.js';
import { PrismaUsersRepository } from './prisma-users.repository.js';

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
  update = vi.fn(),
  deleteUser = vi.fn(),
  findMany = vi.fn(),
  findFirst = vi.fn(),
): PrismaUsersRepository {
  return new PrismaUsersRepository({
    user: { create, findUnique, update, delete: deleteUser, findMany, findFirst },
  } as unknown as PrismaService);
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

  it.each([
    ['createdAt', 'asc'],
    ['createdAt', 'desc'],
    ['displayName', 'asc'],
    ['displayName', 'desc'],
  ] as const)(
    'uses %s %s ordering, an ID tie-breaker, and limit plus one for list queries',
    async (sort, direction) => {
      const findMany = vi.fn().mockResolvedValue([user]);
      const findFirst = vi.fn().mockResolvedValue(null);
      const repository = createRepository(vi.fn(), vi.fn(), vi.fn(), vi.fn(), findMany, findFirst);

      await expect(repository.list({ request: { sort, direction, limit: 2 } })).resolves.toEqual({
        data: [user],
        hasNextPage: false,
        hasPreviousPage: false,
      });
      expect(findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ [sort]: direction }, { id: direction }],
        take: 3,
        select: {
          id: true,
          email: true,
          displayName: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    },
  );

  it('uses lexicographic forward predicates and probes adjacent pages through findFirst', async () => {
    const findMany = vi.fn().mockResolvedValue([user]);
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = createRepository(vi.fn(), vi.fn(), vi.fn(), vi.fn(), findMany, findFirst);
    const request = {
      email: user.email,
      sort: 'createdAt' as const,
      direction: 'asc' as const,
      limit: 1,
    };

    await repository.list({
      request,
      cursor: { id: user.id, createdAt: user.createdAt },
      cursorDirection: 'after',
    });

    const forward = {
      OR: [
        { createdAt: { gt: user.createdAt } },
        { createdAt: user.createdAt, id: { gt: user.id } },
      ],
    };
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ email: user.email }, forward] },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 2,
      }),
    );
    expect(findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          AND: [
            { email: user.email },
            {
              OR: [
                { createdAt: { lt: user.createdAt } },
                { createdAt: user.createdAt, id: { lt: user.id } },
              ],
            },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('reverses before pages while retaining public order and uses backward lexicographic predicates', async () => {
    const later = { ...user, id: '123e4567-e89b-42d3-a456-426614174001' };
    const findMany = vi.fn().mockResolvedValue([later, user]);
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = createRepository(vi.fn(), vi.fn(), vi.fn(), vi.fn(), findMany, findFirst);
    const request = { sort: 'displayName' as const, direction: 'asc' as const, limit: 1 };

    await expect(
      repository.list({
        request,
        cursor: { id: later.id, displayName: later.displayName },
        cursorDirection: 'before',
      }),
    ).resolves.toMatchObject({ data: [later] });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              OR: [
                { displayName: { lt: later.displayName } },
                { displayName: later.displayName, id: { lt: later.id } },
              ],
            },
          ],
        },
        orderBy: [{ displayName: 'desc' }, { id: 'desc' }],
        take: 2,
      }),
    );
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

  it('updates a user through Prisma with only the public projection', async () => {
    const update = vi.fn().mockResolvedValue(user);
    const repository = createRepository(vi.fn(), vi.fn(), update);
    const data = { displayName: 'Ada Byron' };

    await expect(repository.update(user.id, data)).resolves.toEqual(user);
    expect(update).toHaveBeenCalledWith({
      where: { id: user.id },
      data,
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('returns null when Prisma cannot update a missing user', async () => {
    const missing = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '7.10.0',
    });
    const repository = createRepository(vi.fn(), vi.fn(), vi.fn().mockRejectedValue(missing));

    await expect(repository.update(user.id, { email: user.email })).resolves.toBeNull();
  });

  it('deletes a user through Prisma', async () => {
    const deleteUser = vi.fn().mockResolvedValue(user);
    const repository = createRepository(vi.fn(), vi.fn(), vi.fn(), deleteUser);

    await expect(repository.delete(user.id)).resolves.toBe(true);
    expect(deleteUser).toHaveBeenCalledWith({ where: { id: user.id } });
  });

  it('returns null when Prisma cannot delete a missing user', async () => {
    const missing = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '7.10.0',
    });
    const repository = createRepository(
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn().mockRejectedValue(missing),
    );

    await expect(repository.delete(user.id)).resolves.toBeNull();
  });

  it('translates a P2002 update error to an email conflict', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.10.0',
    });
    const repository = createRepository(vi.fn(), vi.fn(), vi.fn().mockRejectedValue(conflict));

    await expect(repository.update(user.id, { email: user.email })).rejects.toMatchObject({
      name: UserEmailConflictError.name,
      email: user.email,
      code: 'CONFLICT',
      cause: conflict,
    });
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
