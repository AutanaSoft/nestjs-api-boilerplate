import { Body, Controller, HttpCode, Post, SerializeOptions } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiOperation,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { errorResponseSchema } from '../../common/error-handling/error-response.js';
import { toOpenApiSchema } from '../../common/openapi/openapi-schema.js';
import { API_VERSION } from '../../config/api.config.js';
import { AuthService } from './auth.service.js';
import { signUpRequestSchema, tokensResponseSchema } from './contracts/sign-up.schema.js';
import type { SignUpRequest } from './contracts/sign-up.schema.js';
import { signInRequestSchema } from './contracts/sign-in.schema.js';
import type { SignInRequest } from './contracts/sign-in.schema.js';

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

  @Post('sign-in')
  @HttpCode(200)
  @ApiOperation({ operationId: 'signIn' })
  @ApiBody({ schema: toOpenApiSchema(signInRequestSchema, 'input') })
  @ApiOkResponse({ schema: toOpenApiSchema(tokensResponseSchema, 'output') })
  @ApiBadRequestResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiUnauthorizedResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiTooManyRequestsResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiInternalServerErrorResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @SerializeOptions({ schema: tokensResponseSchema })
  signIn(@Body({ schema: signInRequestSchema }) body: SignInRequest) {
    return this.auth.signIn(body);
  }
}
