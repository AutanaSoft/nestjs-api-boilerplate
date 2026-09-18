import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import type { ApiConfig } from '../../config/api.config.js';
import { createUserRequestSchema } from './contracts/create-user-request.schema.js';
import { UsersController } from './users.controller.js';
import type { UsersService } from './users.service.js';

const user = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
  createdAt: new Date('2026-09-19T12:34:56.789Z'),
  updatedAt: new Date('2026-09-19T12:34:56.789Z'),
};

const body = { email: user.email, displayName: user.displayName };

function createController(globalPrefix: string) {
  const service = { create: vi.fn().mockResolvedValue(user) } as unknown as UsersService;
  const controller = new UsersController(service, { globalPrefix } satisfies ApiConfig);
  const response = { location: vi.fn() };

  return { controller, response };
}

describe('UsersController', () => {
  it('attaches the canonical request schema to the create body parameter', () => {
    const routeArguments: Record<string, { index: number; schema?: unknown }> =
      Reflect.getMetadata(ROUTE_ARGS_METADATA, UsersController, 'create') ?? {};

    expect(Object.values(routeArguments)).toContainEqual(
      expect.objectContaining({
        index: 0,
        schema: createUserRequestSchema,
      }),
    );
  });

  it.each([
    ['api', '/api/v1/users/123e4567-e89b-42d3-a456-426614174000'],
    ['platform/api', '/platform/api/v1/users/123e4567-e89b-42d3-a456-426614174000'],
    ['', '/v1/users/123e4567-e89b-42d3-a456-426614174000'],
  ])('sets Location from the configured %j global prefix', async (globalPrefix, location) => {
    const { controller, response } = createController(globalPrefix);

    await controller.create(body, response as never);

    expect(response.location).toHaveBeenCalledWith(location);
  });
});
