import { describe, expect, it, vi } from 'vitest';
import { UserNotFoundError, UserNotOwnedError } from '../users.errors.js';
import type { UsersRepository } from '../repositories/users.repository.js';
import { UsersService } from './users.service.js';

const user = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
  role: 'user' as const,
  createdAt: new Date('2026-09-19T12:34:56.789Z'),
  updatedAt: new Date('2026-09-19T12:34:56.789Z'),
};
const other = { ...user, id: '123e4567-e89b-42d3-a456-426614174001', email: 'grace@example.com' };
const viewerId = user.id;

function createRepository(overrides: Partial<UsersRepository> = {}): UsersRepository {
  return {
    findById: vi.fn().mockResolvedValue(user),
    list: vi.fn().mockResolvedValue({ data: [user, other], hasNextPage: false, hasPreviousPage: false }),
    update: vi.fn().mockResolvedValue(user),
    delete: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('UsersService', () => {
  it('retrieves a user through the feature repository port', async () => {
    const findById = vi.fn().mockResolvedValue(user);
    const service = new UsersService(createRepository({ findById }));

    await expect(service.findById(user.id, viewerId)).resolves.toEqual(user);
    expect(findById).toHaveBeenCalledWith(user.id);
  });

  it('redacts another user email in singular responses', async () => {
    const service = new UsersService(createRepository({ findById: vi.fn().mockResolvedValue(other) }));

    await expect(service.findById(other.id, viewerId)).resolves.toEqual({
      id: other.id,
      displayName: other.displayName,
      role: 'user',
      createdAt: other.createdAt,
      updatedAt: other.updatedAt,
    });
  });

  it('maps a missing repository user to the application resource-not-found error', async () => {
    const service = new UsersService(createRepository({ findById: vi.fn().mockResolvedValue(null) }));

    await expect(service.findById(user.id, viewerId)).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('projects list items by viewer without changing pagination metadata', async () => {
    const service = new UsersService(createRepository());
    const page = await service.list({ sort: 'createdAt', direction: 'desc', limit: 25 }, viewerId);

    expect(page.data).toEqual([
      user,
      {
        id: other.id,
        displayName: other.displayName,
        role: 'user',
        createdAt: other.createdAt,
        updatedAt: other.updatedAt,
      },
    ]);
    expect(page.pageInfo).toEqual({
      nextCursor: null,
      previousCursor: null,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('lists repository pages and emits cursors only for actual adjacent pages', async () => {
    const repository = createRepository({
      list: vi.fn().mockResolvedValue({ data: [user], hasNextPage: true, hasPreviousPage: false }),
    });
    const service = new UsersService(repository);
    const page = await service.list({ sort: 'createdAt', direction: 'desc', limit: 25 }, viewerId);

    expect(page.data).toEqual([user]);
    expect(page.pageInfo).toMatchObject({ hasNextPage: true, hasPreviousPage: false });
    expect(page.pageInfo.nextCursor).toEqual(expect.any(String));
    expect(page.pageInfo.previousCursor).toBeNull();
  });

  it('reuses cursors across email filters while applying the current request filter', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ data: [user], hasNextPage: true, hasPreviousPage: false })
      .mockResolvedValueOnce({ data: [], hasNextPage: false, hasPreviousPage: false });
    const service = new UsersService(createRepository({ list }));
    const firstRequest = { email: user.email, sort: 'createdAt' as const, direction: 'desc' as const, limit: 1 };
    const firstPage = await service.list(firstRequest, viewerId);
    const secondRequest = {
      email: 'grace@example.com',
      sort: 'createdAt' as const,
      direction: 'desc' as const,
      limit: 1,
      after: firstPage.pageInfo.nextCursor!,
    };

    await expect(service.list(secondRequest, viewerId)).resolves.toMatchObject({ data: [] });
    expect(list).toHaveBeenNthCalledWith(2, {
      request: secondRequest,
      cursor: { id: user.id, createdAt: user.createdAt },
      cursorDirection: 'after',
    });
  });

  it('updates only an existing owner through the feature repository port', async () => {
    const update = vi.fn().mockResolvedValue(user);
    const service = new UsersService(createRepository({ update }));
    const data = { displayName: user.displayName };

    await expect(service.update(user.id, viewerId, data)).resolves.toEqual(user);
    expect(update).toHaveBeenCalledWith(user.id, data);
  });

  it('rejects writes to an existing other user after loading the resource', async () => {
    const update = vi.fn();
    const service = new UsersService(
      createRepository({
        findById: vi.fn().mockResolvedValue(other),
        update,
      }),
    );

    await expect(service.update(other.id, viewerId, { displayName: 'Grace Hopper' })).rejects.toBeInstanceOf(
      UserNotOwnedError,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('returns not-found before applying owner authorization to missing writes', async () => {
    const service = new UsersService(createRepository({ findById: vi.fn().mockResolvedValue(null) }));

    await expect(service.update(other.id, viewerId, { displayName: 'Grace Hopper' })).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });

  it('deletes only an existing owner through the feature repository port', async () => {
    const deleteUser = vi.fn().mockResolvedValue(true);
    const service = new UsersService(createRepository({ delete: deleteUser }));

    await expect(service.delete(user.id, viewerId)).resolves.toBeUndefined();
    expect(deleteUser).toHaveBeenCalledWith(user.id);
  });

  it('rejects deletion of another owner without reaching the repository delete operation', async () => {
    const deleteUser = vi.fn();
    const service = new UsersService(
      createRepository({
        findById: vi.fn().mockResolvedValue(other),
        delete: deleteUser,
      }),
    );

    await expect(service.delete(other.id, viewerId)).rejects.toBeInstanceOf(UserNotOwnedError);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('maps missing repository deletion to the application resource-not-found error', async () => {
    const service = new UsersService(createRepository({ delete: vi.fn().mockResolvedValue(null) }));

    await expect(service.delete(user.id, viewerId)).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
