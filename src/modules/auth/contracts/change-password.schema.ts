import { z } from 'zod';

export const changePasswordRequestSchema = z.strictObject({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12),
});
export type ChangePasswordRequest = z.output<typeof changePasswordRequestSchema>;
