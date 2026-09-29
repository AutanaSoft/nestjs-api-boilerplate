import { z } from 'zod';
import { displayNameSchema, normalizedEmailSchema } from '../../users/contracts/user.schema.js';

export const signUpRequestSchema = z.strictObject({
  email: normalizedEmailSchema,
  displayName: displayNameSchema,
  password: z.string().min(12),
});
export type SignUpRequest = z.output<typeof signUpRequestSchema>;

export const tokensResponseSchema = z.strictObject({
  accessToken: z.string().min(1),
  expiresAt: z.iso.datetime(),
  refreshToken: z.string().min(1),
  refreshExpiresAt: z.iso.datetime(),
});
