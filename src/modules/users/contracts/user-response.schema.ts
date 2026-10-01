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

export const otherUserResponseSchema = userResponseSchema.omit({ email: true });
export const viewerUserResponseSchema = z.union([userResponseSchema, otherUserResponseSchema]);

export type UserResponseInput = z.input<typeof userResponseSchema>;
export type UserResponse = z.output<typeof userResponseSchema>;
export type OtherUserResponseInput = z.input<typeof otherUserResponseSchema>;
export type OtherUserResponse = z.output<typeof otherUserResponseSchema>;
