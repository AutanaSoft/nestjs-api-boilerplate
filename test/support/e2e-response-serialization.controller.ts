import { Controller, Get, SerializeOptions } from '@nestjs/common';
import { z } from 'zod';
import { API_VERSION } from '../../src/config/api.config.js';

const validResponseSchema = z.object({
  publicName: z.string().transform((value) => `PUBLIC: ${value}`),
});

const invalidResponseSchema = z.object({
  publicName: z.uuid(),
});

@Controller({ path: '__test/serialization', version: API_VERSION })
export class E2EResponseSerializationController {
  @Get('valid')
  @SerializeOptions({ schema: validResponseSchema })
  valid() {
    return {
      publicName: 'internal-name',
      internalSecret: 'response-secret',
    };
  }

  @Get('passthrough')
  passthrough() {
    return { internalName: 'passthrough-value' };
  }

  @Get('invalid')
  @SerializeOptions({ schema: invalidResponseSchema })
  invalid() {
    return {
      publicName: 'invalid-response-value',
      internalSecret: 'response-secret',
      cause: 'sensitive-cause',
      issues: 'issues',
      schema: 'schema',
      stack: 'stack',
    };
  }
}
