import { Body, Controller, Inject, Post, Res, SerializeOptions } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOperation,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { errorResponseSchema } from '../../common/error-handling/error-response.js';
import { toOpenApiSchema } from '../../common/openapi/openapi-schema.js';
import apiConfig, { API_VERSION } from '../../config/api.config.js';
import { createUserRequestSchema } from './contracts/create-user-request.schema.js';
import type { CreateUserRequest } from './contracts/create-user-request.schema.js';
import { userResponseSchema } from './contracts/user-response.schema.js';
import { UsersService } from './users.service.js';

@Controller({ path: 'users', version: API_VERSION })
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(apiConfig.KEY) private readonly api: ConfigType<typeof apiConfig>,
  ) {}

  @Post()
  @ApiOperation({ operationId: 'createUser' })
  @ApiBody({ schema: toOpenApiSchema(createUserRequestSchema, 'input') })
  @ApiCreatedResponse({ schema: toOpenApiSchema(userResponseSchema, 'output') })
  @ApiBadRequestResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiConflictResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiTooManyRequestsResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiInternalServerErrorResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @SerializeOptions({ schema: userResponseSchema })
  async create(
    @Body({ schema: createUserRequestSchema }) body: CreateUserRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await this.usersService.create(body);
    response.location(
      `${this.api.globalPrefix === '' ? '' : `/${this.api.globalPrefix}`}/v${API_VERSION}/users/${user.id}`,
    );
    return user;
  }
}
