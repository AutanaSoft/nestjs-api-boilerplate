import { z } from 'zod';
import { userSchema } from './user.schema.js';

export const createUserRequestSchema = userSchema.pick({ email: true, displayName: true });

export type CreateUserRequest = z.output<typeof createUserRequestSchema>;
