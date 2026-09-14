import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { API_VERSION } from '../../src/config/api.config.js';

export const e2eRequestValidationSchema = z
  .object({
    value: z.string().transform((value) => `NORMALIZED: ${value}`),
  })
  .strict();

export type E2ERequestValidationInput = z.input<typeof e2eRequestValidationSchema>;
export type E2ERequestValidationOutput = z.output<typeof e2eRequestValidationSchema>;

@Controller({ path: '__test/validation', version: API_VERSION })
export class E2ERequestValidationController {
  @Post()
  validate(@Body({ schema: e2eRequestValidationSchema }) body: E2ERequestValidationOutput) {
    return body;
  }
}
