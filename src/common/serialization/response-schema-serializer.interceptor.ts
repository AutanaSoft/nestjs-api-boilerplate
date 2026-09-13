import { Injectable, StandardSchemaSerializerInterceptor } from '@nestjs/common';
import type { StandardSchemaSerializerInterceptorOptions } from '@nestjs/common';
import { ResponseContractViolation } from './response-contract-violation.js';

type StandardSchema = NonNullable<StandardSchemaSerializerInterceptorOptions['schema']>;
type StandardSchemaValidateOptions = StandardSchemaSerializerInterceptorOptions['validateOptions'];
type SerializedResponse = Awaited<
  ReturnType<StandardSchemaSerializerInterceptor['transformToPlain']>
>;

/** Applies declared response schemas and classifies only serialization-boundary failures. */
@Injectable()
export class ResponseSchemaSerializerInterceptor extends StandardSchemaSerializerInterceptor {
  async transformToPlain(
    plainOrClass: unknown,
    schema: StandardSchema,
    validateOptions?: StandardSchemaValidateOptions,
  ): Promise<SerializedResponse> {
    try {
      return await super.transformToPlain(plainOrClass, schema, validateOptions);
    } catch (error: unknown) {
      throw new ResponseContractViolation({ cause: error });
    }
  }
}
