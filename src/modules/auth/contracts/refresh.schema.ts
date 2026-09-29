import { z } from 'zod';

export const refreshRequestSchema = z.strictObject({ refreshToken: z.string().min(1) });
export type RefreshRequest = z.output<typeof refreshRequestSchema>;
