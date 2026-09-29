import { z } from 'zod';
import { normalizedEmailSchema } from '../../users/contracts/user.schema.js';

export const signInRequestSchema = z.strictObject({
  email: normalizedEmailSchema,
  password: z.string().min(1),
});
export type SignInRequest = z.output<typeof signInRequestSchema>;
