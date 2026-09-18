import { describe, expect, it, vi } from 'vitest';
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
  it('creates users through the feature repository port', async () => {
    const repository = { create: vi.fn().mockResolvedValue(user) } satisfies UsersRepository;
    const service = new UsersService(repository);

    await expect(
      service.create({ email: user.email, displayName: user.displayName }),
    ).resolves.toEqual(user);
    expect(repository.create).toHaveBeenCalledWith({
      email: user.email,
      displayName: user.displayName,
    });
  });
});
