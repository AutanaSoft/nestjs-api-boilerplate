import { describe, expect, it } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { buildAuthConfig } from '../../config/auth.config.js';

describe('auth configuration and token defaults', () => {
  it('uses 15-minute access and 7-day refresh defaults with an ephemeral non-production key', () => {
    const config = buildAuthConfig({ NODE_ENV: 'test' });
    expect(config.accessTtlSeconds).toBe(900);
    expect(config.refreshTtlSeconds).toBe(604_800);
    expect(config.jwtSecret.length).toBeGreaterThanOrEqual(32);
    expect(buildAuthConfig({ NODE_ENV: 'test' }).jwtSecret).not.toBe(config.jwtSecret);
  });

  it('accepts configured lifetimes and rejects invalid or absent production signing keys', () => {
    const secret = 'a'.repeat(32);
    expect(
      buildAuthConfig({
        NODE_ENV: 'production',
        AUTH_JWT_SECRET: secret,
        AUTH_ACCESS_TTL_SECONDS: '60',
        AUTH_REFRESH_TTL_SECONDS: '3600',
      }),
    ).toMatchObject({
      jwtSecret: secret,
      accessTtlSeconds: 60,
      refreshTtlSeconds: 3600,
    });
    expect(() => buildAuthConfig({ NODE_ENV: 'production' })).toThrow();
    expect(() => buildAuthConfig({ NODE_ENV: 'production', AUTH_JWT_SECRET: 'short' })).toThrow();
    expect(() => buildAuthConfig({ NODE_ENV: 'test', AUTH_ACCESS_TTL_SECONDS: '0' })).toThrow();
  });

  it('verifies the installed JWT signature and expiration API', async () => {
    const secret = 'a'.repeat(32);
    const jwt = new JwtService({ secret });
    const exp = Math.floor(Date.now() / 1000) + 900;
    const token = await jwt.signAsync({ sub: 'user', sid: 'session', exp });
    expect((await jwt.verifyAsync<{ sub: string; sid: string; exp: number }>(token)).exp).toBe(exp);
  });
});
