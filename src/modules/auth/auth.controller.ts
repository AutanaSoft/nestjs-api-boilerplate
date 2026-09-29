import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  SerializeOptions,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { CurrentPrincipal, type AuthenticatedPrincipal } from '../../common/auth/authenticated-principal.js';
import { Public } from '../../common/auth/public.js';
import { errorResponseSchema } from '../../common/error-handling/error-response.js';
import { toOpenApiSchema } from '../../common/openapi/openapi-schema.js';
import { API_VERSION } from '../../config/api.config.js';
import { AuthService } from './auth.service.js';
import { signUpRequestSchema, tokensResponseSchema } from './contracts/sign-up.schema.js';
import type { SignUpRequest } from './contracts/sign-up.schema.js';
import { signInRequestSchema } from './contracts/sign-in.schema.js';
import type { SignInRequest } from './contracts/sign-in.schema.js';
import { refreshRequestSchema } from './contracts/refresh.schema.js';
import type { RefreshRequest } from './contracts/refresh.schema.js';

@Controller({ path: 'auth', version: API_VERSION })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
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

  @Public()
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

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'refreshSession' })
  @ApiBody({ schema: toOpenApiSchema(refreshRequestSchema, 'input') })
  @ApiOkResponse({ schema: toOpenApiSchema(tokensResponseSchema, 'output') })
  @ApiBadRequestResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiUnauthorizedResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @SerializeOptions({ schema: tokensResponseSchema })
  refresh(@Body({ schema: refreshRequestSchema }) body: RefreshRequest) {
    return this.auth.refresh(body);
  }

  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'signOut' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiUnauthorizedResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  async signOut(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: { headers: { 'content-length'?: string; 'transfer-encoding'?: string } },
  ): Promise<void> {
    if (
      request.headers['transfer-encoding'] !== undefined ||
      (request.headers['content-length'] !== undefined && request.headers['content-length'] !== '0')
    ) {
      throw new BadRequestException();
    }
    await this.auth.signOut(principal.sessionId);
  }
}
