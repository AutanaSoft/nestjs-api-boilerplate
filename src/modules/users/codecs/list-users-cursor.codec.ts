import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import type { ListUsersRequest } from '../contracts/list-users-request.schema.js';

export type ListUsersCursorContext = Pick<ListUsersRequest, 'sort' | 'direction'>;
export type ListUsersCursorPosition =
  Readonly<{ id: string; createdAt: Date }> | Readonly<{ id: string; displayName: string }>;

const cursorSchema = z.strictObject({
  v: z.literal(1),
  sort: z.enum(['createdAt', 'displayName']),
  direction: z.enum(['asc', 'desc']),
  position: z.strictObject({
    id: z.uuidv4(),
    createdAt: z.iso.datetime().optional(),
    displayName: z.string().optional(),
  }),
});

export function encodeListUsersCursor(
  context: ListUsersCursorContext,
  position: ListUsersCursorPosition,
): string {
  const value = {
    v: 1,
    sort: context.sort,
    direction: context.direction,
    position:
      'createdAt' in position
        ? { id: position.id, createdAt: position.createdAt.toISOString() }
        : { id: position.id, displayName: position.displayName },
  };

  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeListUsersCursor(
  cursor: string,
  context: ListUsersCursorContext,
): ListUsersCursorPosition {
  if (cursor.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(cursor)) {
    throw new BadRequestException();
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestException();
  }

  const parsed = cursorSchema.safeParse(decoded);
  if (
    !parsed.success ||
    parsed.data.sort !== context.sort ||
    parsed.data.direction !== context.direction
  ) {
    throw new BadRequestException();
  }

  const position = parsed.data.position;
  if (
    context.sort === 'createdAt' &&
    position.createdAt !== undefined &&
    position.displayName === undefined
  ) {
    return { id: position.id, createdAt: new Date(position.createdAt) };
  }
  if (
    context.sort === 'displayName' &&
    position.displayName !== undefined &&
    position.createdAt === undefined
  ) {
    return { id: position.id, displayName: position.displayName };
  }

  throw new BadRequestException();
}
