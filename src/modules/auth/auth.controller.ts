import { Body, Controller, Post, SerializeOptions } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOperation,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { errorResponseSchema } from '../../common/error-handling/error-response.js';
import { toOpenApiSchema } from '../../common/openapi/openapi-schema.js';
import { API_VERSION } from '../../config/api.config.js';
import { AuthService } from './auth.service.js';
import { signUpRequestSchema, tokensResponseSchema } from './contracts/sign-up.schema.js';
import type { SignUpRequest } from './contracts/sign-up.schema.js';

@Controller({ path: 'auth', version: API_VERSION })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('sign-up')
  @ApiOperation({ operationId: 'signUp' })
  @ApiBody({ schema: toOpenApiSchema(signUpRequestSchema, 'input') })
  @ApiCreatedResponse({ schema: toOpenApiSchema(tokensResponseSchema, 'output') })
  @ApiBadRequestResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiConflictResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiTooManyRequestsResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiInternalServerErrorResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @SerializeOptions({ schema: tokensResponseSchema })
  signUp(@Body({ schema: signUpRequestSchema }) body: SignUpRequest) {
    return this.auth.signUp(body);
  }
}
