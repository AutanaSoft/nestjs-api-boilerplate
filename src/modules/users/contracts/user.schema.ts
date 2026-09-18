import { z } from 'zod';

/** The normalized application value for a user, independent of persistence and HTTP serialization. */
export const normalizedEmailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const displayNameSchema = z
  .string()
  .trim()
  .refine(
    (value) => [...value].length >= 2 && [...value].length <= 30,
    'Display name must contain 2 to 30 Unicode code points.',
  )
  .regex(/^[\p{L}]+(?: [\p{L}]+)*$/u, 'Display name must contain only letters and single spaces.');

export const userSchema = z.strictObject({
  id: z.uuidv4(),
  email: normalizedEmailSchema,
  displayName: displayNameSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.output<typeof userSchema>;
