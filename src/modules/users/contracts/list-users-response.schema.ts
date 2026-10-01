import { z } from 'zod';
import { viewerUserResponseSchema } from './user-response.schema.js';

export const listUsersResponseSchema = z.object({
  data: z.array(viewerUserResponseSchema),
  pageInfo: z.object({
    nextCursor: z.string().nullable(),
    previousCursor: z.string().nullable(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),
});

/** Repository/service value before the controller serializes timestamps for the public response. */
export type ListUsersResponseInput = z.input<typeof listUsersResponseSchema>;

/** Public HTTP representation after response serialization. */
export type ListUsersResponse = z.output<typeof listUsersResponseSchema>;
