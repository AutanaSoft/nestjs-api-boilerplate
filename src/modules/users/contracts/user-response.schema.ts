import { z } from 'zod';
import { userSchema } from './user.schema.js';

const timestampSchema = z
  .date()
  .transform((value) => value.toISOString())
  .pipe(z.iso.datetime());

export const userResponseSchema = z.object({
  ...userSchema.shape,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type UserResponseInput = z.input<typeof userResponseSchema>;
export type UserResponse = z.output<typeof userResponseSchema>;
