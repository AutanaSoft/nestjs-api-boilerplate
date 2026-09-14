import type { ApiResponseSchemaHost } from '@nestjs/swagger';
import { z } from 'zod';

export type OpenApiSchemaDirection = 'input' | 'output';

export function toOpenApiSchema(
  schema: z.core.$ZodType,
  io: OpenApiSchemaDirection,
): ApiResponseSchemaHost['schema'] {
  return z.toJSONSchema(schema, { target: 'openapi-3.0', io }) as ApiResponseSchemaHost['schema'];
}
