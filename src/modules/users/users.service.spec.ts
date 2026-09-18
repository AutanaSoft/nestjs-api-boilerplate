import { describe, expect, it, vi } from 'vitest';
import { UserNotFoundError } from './users.errors.js';
import type { UsersRepository } from './users.repository.port.js';
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
    const repository: UsersRepository = { findById, create: vi.fn() };
    const service = new UsersService(repository);

    await expect(service.findById(user.id)).resolves.toEqual(user);
    expect(findById).toHaveBeenCalledWith(user.id);
  });

  it('maps a missing repository user to the application resource-not-found error', async () => {
    const repository: UsersRepository = {
      findById: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    };
    const service = new UsersService(repository);

    await expect(service.findById(user.id)).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('creates users through the feature repository port', async () => {
    const create = vi.fn().mockResolvedValue(user);
    const repository: UsersRepository = { findById: vi.fn(), create };
    const service = new UsersService(repository);

    await expect(
      service.create({ email: user.email, displayName: user.displayName }),
    ).resolves.toEqual(user);
    expect(create).toHaveBeenCalledWith({
      email: user.email,
      displayName: user.displayName,
    });
  });
});
