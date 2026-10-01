import { z } from 'zod';
import { userSchema } from './user.schema.js';

export const updateUserRequestSchema = userSchema.pick({ displayName: true }).strict();

export type UpdateUserRequest = z.output<typeof updateUserRequestSchema>;
