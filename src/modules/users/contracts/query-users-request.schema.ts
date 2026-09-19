import { z } from 'zod';
import { listUsersRequestObjectSchema } from './list-users-request.schema.js';
import { normalizedEmailSchema } from './user.schema.js';

const queryUsersOptionsSchema = listUsersRequestObjectSchema
  .omit({ email: true, limit: true })
  .extend({
    criteria: z.strictObject({ email: normalizedEmailSchema }),
    limit: z.number().int().min(1).max(250).default(25),
  })
  .refine((value) => !(value.after !== undefined && value.before !== undefined), {
    message: 'after and before are mutually exclusive.',
  });

export const queryUsersRequestSchema = queryUsersOptionsSchema.transform(({ criteria, ...options }) => ({
  ...options,
  email: criteria.email,
}));

export const queryUsersUrlQuerySchema = z.strictObject({});

export type QueryUsersRequest = z.output<typeof queryUsersRequestSchema>;
