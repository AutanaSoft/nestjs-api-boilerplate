import { z } from 'zod';
import { userSchema } from './user.schema.js';

export const updateUserRequestSchema = userSchema
  .pick({ email: true, displayName: true })
  .partial()
  .strict()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    'Update requests must include at least one field.',
  );

export type UpdateUserRequest = z.output<typeof updateUserRequestSchema>;
