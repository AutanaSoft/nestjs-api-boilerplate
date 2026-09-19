import { describe, expect, it, vi } from 'vitest';
import { UserNotFoundError } from '../users.errors.js';
import type { UsersRepository } from '../repositories/users.repository.js';
import { UsersService } from './users.service.js';

const user = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
  createdAt: new Date('2026-09-19T12:34:56.789Z'),
  updatedAt: new Date('2026-09-19T12:34:56.789Z'),
};

describe('UsersService', () => {
  it('retrieves users through the feature repository port', async () => {
    const findById = vi.fn().mockResolvedValue(user);
    const repository: UsersRepository = {
      findById,
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const service = new UsersService(repository);

    await expect(service.findById(user.id)).resolves.toEqual(user);
    expect(findById).toHaveBeenCalledWith(user.id);
  });

  it('maps a missing repository user to the application resource-not-found error', async () => {
    const repository: UsersRepository = {
      findById: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const service = new UsersService(repository);

    await expect(service.findById(user.id)).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('lists repository pages and emits cursors only for actual adjacent pages', async () => {
    const repository = {
      findById: vi.fn(),
      list: vi.fn().mockResolvedValue({
        data: [user],
        hasNextPage: true,
        hasPreviousPage: false,
      }),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as UsersRepository;
    const service = new UsersService(repository);

    const page = await service.list({ sort: 'createdAt', direction: 'desc', limit: 25 });

    expect(page.data).toEqual([user]);
    expect(page.pageInfo).toMatchObject({ hasNextPage: true, hasPreviousPage: false });
    expect(page.pageInfo.nextCursor).toEqual(expect.any(String));
    expect(page.pageInfo.previousCursor).toBeNull();
  });

  it('reuses cursors across email filters while applying the current request filter', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        data: [user],
        hasNextPage: true,
        hasPreviousPage: false,
      })
      .mockResolvedValueOnce({
        data: [],
        hasNextPage: false,
        hasPreviousPage: false,
      });
    const repository = {
      findById: vi.fn(),
      list,
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as UsersRepository;
    const service = new UsersService(repository);
    const firstRequest = {
      email: user.email,
      sort: 'createdAt' as const,
      direction: 'desc' as const,
      limit: 1,
    };
    const firstPage = await service.list(firstRequest);
    const secondRequest = {
      email: 'grace@example.com',
      sort: 'createdAt' as const,
      direction: 'desc' as const,
      limit: 1,
      after: firstPage.pageInfo.nextCursor!,
    };

    await expect(service.list(secondRequest)).resolves.toMatchObject({ data: [] });
    expect(list).toHaveBeenNthCalledWith(2, {
      request: secondRequest,
      cursor: { id: user.id, createdAt: user.createdAt },
      cursorDirection: 'after',
    });
  });

  it('creates users through the feature repository port', async () => {
    const create = vi.fn().mockResolvedValue(user);
    const repository: UsersRepository = {
      findById: vi.fn(),
      create,
      update: vi.fn(),
      delete: vi.fn(),
    };
    const service = new UsersService(repository);

    await expect(
      service.create({ email: user.email, displayName: user.displayName }),
    ).resolves.toEqual(user);
    expect(create).toHaveBeenCalledWith({
      email: user.email,
      displayName: user.displayName,
    });
  });

  it('updates users through the feature repository port', async () => {
    const update = vi.fn().mockResolvedValue(user);
    const repository: UsersRepository = {
      findById: vi.fn(),
      create: vi.fn(),
      update,
      delete: vi.fn(),
    };
    const service = new UsersService(repository);
    const data = { displayName: user.displayName };

    await expect(service.update(user.id, data)).resolves.toEqual(user);
    expect(update).toHaveBeenCalledWith(user.id, data);
  });

  it('maps a missing updated user to the application resource-not-found error', async () => {
    const repository: UsersRepository = {
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue(null),
      delete: vi.fn(),
    };
    const service = new UsersService(repository);

    await expect(service.update(user.id, { email: user.email })).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });

  it('deletes users through the feature repository port', async () => {
    const deleteUser = vi.fn().mockResolvedValue(true);
    const repository: UsersRepository = {
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: deleteUser,
    };
    const service = new UsersService(repository);

    await expect(service.delete(user.id)).resolves.toBeUndefined();
    expect(deleteUser).toHaveBeenCalledWith(user.id);
  });

  it('maps a missing deleted user to the application resource-not-found error', async () => {
    const repository: UsersRepository = {
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue(null),
    };
    const service = new UsersService(repository);

    await expect(service.delete(user.id)).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
