import * as argon2 from 'argon2';
import { describe, expect, it, vi } from 'vitest';
import type { CredentialsRepository } from '../repositories/credentials.repository.js';
import { CredentialsService } from './credentials.service.js';

vi.mock('argon2', async (importOriginal) => {
  const original = await importOriginal<typeof import('argon2')>();
  return { ...original, verify: vi.fn(original.verify) };
});

describe('CredentialsService', () => {
  it('normalizes email and display name while hashing the raw password with Argon2id', async () => {
    const register = vi.fn().mockResolvedValue('user-id');
    const repository = { register } as unknown as CredentialsRepository;
    const service = new CredentialsService(repository);
    const transaction = { client: {} } as never;
    const rawPassword = '  twelve characters  ';
    await expect(service.register(' ADA+tag@EXAMPLE.COM ', ' Ada Lovelace ', rawPassword, transaction)).resolves.toBe(
      'user-id',
    );
    expect(register).toHaveBeenCalledWith(
      'ada+tag@example.com',
      'Ada Lovelace',
      expect.stringMatching(/^\$argon2id\$/),
      transaction,
    );
    const hash = register.mock.calls[0][2] as string;
    expect(await argon2.verify(hash, rawPassword)).toBe(true);
    expect(await argon2.verify(hash, rawPassword.trim())).toBe(false);
  });

  it('performs Argon2id verification for absent accounts as well as existing ones', async () => {
    const findHashByEmail = vi.fn().mockResolvedValue(null);
    const repository = { findHashByEmail } as unknown as CredentialsRepository;
    const service = new CredentialsService(repository);
    vi.mocked(argon2.verify).mockClear();
    await expect(service.verify(' MISSING@EXAMPLE.COM ', 'short')).resolves.toBeNull();
    expect(findHashByEmail).toHaveBeenCalledWith('missing@example.com');
    expect(argon2.verify).toHaveBeenCalledOnce();
    expect(argon2.verify).toHaveBeenCalledWith(expect.stringMatching(/^\$argon2id\$/), 'short');
  });

  it('checks raw existing passwords without imposing the enrollment minimum and excludes hashes from results', async () => {
    const passwordHash = await argon2.hash('short', { type: argon2.argon2id });
    const findHashByEmail = vi.fn().mockResolvedValue({ id: 'user-id', passwordHash });
    const repository = { findHashByEmail } as unknown as CredentialsRepository;
    const service = new CredentialsService(repository);
    await expect(service.verify(' ADA@EXAMPLE.COM ', 'short')).resolves.toBe('user-id');
    await expect(service.verify(' ADA@EXAMPLE.COM ', 'wrong')).resolves.toBeNull();
    expect(findHashByEmail).toHaveBeenCalledWith('ada@example.com');
  });
});
