import type { INestApplication } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { setupApplication } from './app.setup.js';
import { buildHttpConfig } from './config/http.config.js';

describe('setupApplication', () => {
  it('applies trust proxy before Helmet and the configured CORS allowlist', () => {
    const set = vi.fn();
    const use = vi.fn();
    const enableCors = vi.fn();
    const app = {
      getHttpAdapter: () => ({ getInstance: () => ({ set }) }),
      use,
      enableCors,
    } as unknown as INestApplication;
    const config = buildHttpConfig({
      CORS_ORIGINS: 'https://api.example.com',
      TRUST_PROXY_HOPS: '1',
    });

    setupApplication(app, config);

    expect(set).toHaveBeenCalledWith('trust proxy', 1);
    expect(use).toHaveBeenCalledOnce();
    expect(enableCors).toHaveBeenCalledWith({
      origin: ['https://api.example.com'],
      credentials: false,
    });
  });

  it('does not set Express trust proxy when it is disabled', () => {
    const set = vi.fn();
    const app = {
      getHttpAdapter: () => ({ getInstance: () => ({ set }) }),
      use: vi.fn(),
      enableCors: vi.fn(),
    } as unknown as INestApplication;

    setupApplication(app, buildHttpConfig({}));

    expect(set).not.toHaveBeenCalled();
  });
});
