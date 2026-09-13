import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health-response.schema.js';

describe('healthResponseSchema', () => {
  it('accepts the current successful Terminus response', () => {
    const response = {
      status: 'ok',
      info: {},
      error: {},
      details: {},
    };

    expect(healthResponseSchema.parse(response)).toEqual(response);
  });

  it.each(['error', 'ok', 'degraded', 'shutting_down'])(
    'accepts the %s Terminus top-level status',
    (status) => {
      expect(healthResponseSchema.parse({ status, details: {} })).toEqual({ status, details: {} });
    },
  );

  it('allows omitted info and error while requiring details', () => {
    expect(
      healthResponseSchema.parse({
        status: 'degraded',
        details: {
          database: {
            status: 'degraded',
            latencyMs: 150,
          },
          cache: {
            status: 'up',
          },
        },
      }),
    ).toEqual({
      status: 'degraded',
      details: {
        database: {
          status: 'degraded',
          latencyMs: 150,
        },
        cache: {
          status: 'up',
        },
      },
    });
  });

  it('strips undeclared top-level properties while preserving indicator-specific fields', () => {
    expect(
      healthResponseSchema.parse({
        status: 'error',
        info: {},
        error: {
          database: {
            status: 'down',
            reason: 'connection refused',
          },
        },
        details: {
          database: {
            status: 'down',
            reason: 'connection refused',
          },
        },
        internalOnly: 'must not be public',
      }),
    ).toEqual({
      status: 'error',
      info: {},
      error: {
        database: {
          status: 'down',
          reason: 'connection refused',
        },
      },
      details: {
        database: {
          status: 'down',
          reason: 'connection refused',
        },
      },
    });
  });

  it.each([
    {
      status: 'ok',
      info: {},
      error: {},
    },
    {
      status: 'unavailable',
      details: {},
    },
    {
      status: 'ok',
      details: {
        database: {
          status: 'unknown',
        },
      },
    },
    {
      status: 'ok',
      details: {
        database: {
          latencyMs: 150,
        },
      },
    },
  ])('rejects an invalid Terminus health response', (response) => {
    expect(healthResponseSchema.safeParse(response).success).toBe(false);
  });
});
