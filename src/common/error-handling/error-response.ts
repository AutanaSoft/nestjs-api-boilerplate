import { z } from 'zod';

export const errorResponseSchema = z.object({
  statusCode: z.number().int(),
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
});

export type ErrorResponse<TDetails = never> = Readonly<z.output<typeof errorResponseSchema> & { details?: TDetails }>;
