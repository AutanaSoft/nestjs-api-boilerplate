import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import type { ApiConfig } from '../../../config/api.config.js';
import { createUserRequestSchema } from '../contracts/create-user-request.schema.js';
import {
  queryUsersRequestSchema,
  queryUsersUrlQuerySchema,
} from '../contracts/query-users-request.schema.js';
import { updateUserRequestSchema } from '../contracts/update-user-request.schema.js';
import { userSchema } from '../contracts/user.schema.js';
import { UsersController } from './users.controller.js';
import type { UsersService } from '../services/users.service.js';

const user = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
  createdAt: new Date('2026-09-19T12:34:56.789Z'),
  updatedAt: new Date('2026-09-19T12:34:56.789Z'),
};

const body = { email: user.email, displayName: user.displayName };

function createController(globalPrefix: string) {
  const service = {
    create: vi.fn().mockResolvedValue(user),
    findById: vi.fn().mockResolvedValue(user),
    list: vi.fn().mockResolvedValue({ data: [user], pageInfo: {} }),
    update: vi.fn().mockResolvedValue(user),
    delete: vi.fn().mockResolvedValue(true),
  } as unknown as UsersService;
  const controller = new UsersController(service, { globalPrefix } satisfies ApiConfig);
  const response = { location: vi.fn() };

  return { controller, response, service };
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

  it('attaches strict body-only schemas to the structured query parameters', () => {
    const routeArguments: Record<string, { index: number; schema?: unknown }> =
      Reflect.getMetadata(ROUTE_ARGS_METADATA, UsersController, 'query') ?? {};

    expect(Object.values(routeArguments)).toContainEqual(
      expect.objectContaining({ index: 0, schema: queryUsersRequestSchema }),
    );
    expect(Object.values(routeArguments)).toContainEqual(
      expect.objectContaining({ index: 1, schema: queryUsersUrlQuerySchema }),
    );
  });

  it('queries users through the existing list service operation', async () => {
    const { controller, service } = createController('api');
    const structuredQuery = queryUsersRequestSchema.parse({ criteria: { email: user.email } });

    await expect(controller.query(structuredQuery, {})).resolves.toEqual({
      data: [user],
      pageInfo: {},
    });
    expect(service.list).toHaveBeenCalledWith(structuredQuery);
  });

  it('attaches the canonical UUIDv4 schema to the userId path parameter', () => {
    const routeArguments: Record<string, { index: number; data?: string; schema?: unknown }> =
      Reflect.getMetadata(ROUTE_ARGS_METADATA, UsersController, 'findById') ?? {};

    expect(Object.values(routeArguments)).toContainEqual(
      expect.objectContaining({
        index: 0,
        data: 'userId',
        schema: userSchema.shape.id,
      }),
    );
  });

  it('attaches the canonical UUIDv4 schema to the delete route parameter', () => {
    const routeArguments: Record<string, { index: number; data?: string; schema?: unknown }> =
      Reflect.getMetadata(ROUTE_ARGS_METADATA, UsersController, 'delete') ?? {};

    expect(Object.values(routeArguments)).toContainEqual(
      expect.objectContaining({
        index: 0,
        data: 'userId',
        schema: userSchema.shape.id,
      }),
    );
  });

  it('attaches canonical schemas to the update route parameters', () => {
    const routeArguments: Record<string, { index: number; data?: string; schema?: unknown }> =
      Reflect.getMetadata(ROUTE_ARGS_METADATA, UsersController, 'update') ?? {};

    expect(Object.values(routeArguments)).toContainEqual(
      expect.objectContaining({ index: 0, data: 'userId', schema: userSchema.shape.id }),
    );
    expect(Object.values(routeArguments)).toContainEqual(
      expect.objectContaining({ index: 1, schema: updateUserRequestSchema }),
    );
  });

  it('updates a user through the service', async () => {
    const { controller, service } = createController('api');
    const update = { displayName: 'Ada Byron' };

    await expect(controller.update(user.id, update)).resolves.toEqual(user);
    expect(service.update).toHaveBeenCalledWith(user.id, update);
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

  it('retrieves a user through the service', async () => {
    const { controller, service } = createController('api');

    await expect(controller.findById(user.id)).resolves.toEqual(user);
    expect(service.findById).toHaveBeenCalledWith(user.id);
  });

  it('deletes a user through the service', async () => {
    const { controller, service } = createController('api');

    await expect(controller.delete(user.id)).resolves.toBeUndefined();
    expect(service.delete).toHaveBeenCalledWith(user.id);
  });
});
