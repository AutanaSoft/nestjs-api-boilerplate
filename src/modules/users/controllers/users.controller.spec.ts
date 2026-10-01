import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import { queryUsersRequestSchema, queryUsersUrlQuerySchema } from '../contracts/query-users-request.schema.js';
import { updateUserRequestSchema } from '../contracts/update-user-request.schema.js';
import { userSchema } from '../contracts/user.schema.js';
import { UsersController } from './users.controller.js';
import type { UsersService } from '../services/users.service.js';

const principal = {
  userId: '123e4567-e89b-42d3-a456-426614174000',
  sessionId: '123e4567-e89b-42d3-a456-426614174001',
  role: 'user' as const,
};

const user = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
  role: 'user' as const,
  createdAt: new Date('2026-09-19T12:34:56.789Z'),
  updatedAt: new Date('2026-09-19T12:34:56.789Z'),
};

function createController(_globalPrefix: string) {
  const service = {
    findById: vi.fn().mockResolvedValue(user),
    list: vi.fn().mockResolvedValue({ data: [user], pageInfo: {} }),
    update: vi.fn().mockResolvedValue(user),
    delete: vi.fn().mockResolvedValue(true),
  } as unknown as UsersService;
  const controller = new UsersController(service);
  return { controller, service };
}

describe('UsersController', () => {
  it('does not expose public creation', () => {
    expect(Reflect.getMetadata(ROUTE_ARGS_METADATA, UsersController, 'create')).toBeUndefined();
    expect('create' in UsersController.prototype).toBe(false);
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

    await expect(controller.query(structuredQuery, {}, principal)).resolves.toEqual({
      data: [user],
      pageInfo: {},
    });
    expect(service.list).toHaveBeenCalledWith(structuredQuery, principal.userId);
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

    await expect(controller.update(user.id, update, principal)).resolves.toEqual(user);
    expect(service.update).toHaveBeenCalledWith(user.id, principal.userId, update);
  });

  it('retrieves a user through the service', async () => {
    const { controller, service } = createController('api');

    await expect(controller.findById(user.id, principal)).resolves.toEqual(user);
    expect(service.findById).toHaveBeenCalledWith(user.id, principal.userId);
  });

  it('deletes a user through the service', async () => {
    const { controller, service } = createController('api');

    await expect(controller.delete(user.id, principal)).resolves.toBeUndefined();
    expect(service.delete).toHaveBeenCalledWith(user.id, principal.userId);
  });
});
