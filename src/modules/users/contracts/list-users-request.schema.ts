import { z } from 'zod';
import { normalizedEmailSchema } from './user.schema.js';

const limitSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(250));

export const listUsersRequestSchema = z
  .strictObject({
    email: normalizedEmailSchema.optional(),
    sort: z.enum(['createdAt', 'displayName']).default('createdAt'),
    direction: z.enum(['asc', 'desc']).default('desc'),
    limit: limitSchema.optional().transform((value) => value ?? 25),
    after: z.string().min(1).max(1024).optional(),
    before: z.string().min(1).max(1024).optional(),
  })
  .refine((value) => !(value.after !== undefined && value.before !== undefined), {
    message: 'after and before are mutually exclusive.',
  });

export type ListUsersRequest = z.output<typeof listUsersRequestSchema>;
