import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Query,
  QueryMethod,
  Post,
  Res,
  SerializeOptions,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { errorResponseSchema } from '../../common/error-handling/error-response.js';
import { toOpenApiSchema } from '../../common/openapi/openapi-schema.js';
import apiConfig, { API_VERSION } from '../../config/api.config.js';
import { createUserRequestSchema } from './contracts/create-user-request.schema.js';
import { listUsersRequestSchema } from './contracts/list-users-request.schema.js';
import type { ListUsersRequest } from './contracts/list-users-request.schema.js';
import { listUsersResponseSchema } from './contracts/list-users-response.schema.js';
import {
  queryUsersRequestSchema,
  queryUsersUrlQuerySchema,
} from './contracts/query-users-request.schema.js';
import type { QueryUsersRequest } from './contracts/query-users-request.schema.js';
import type { CreateUserRequest } from './contracts/create-user-request.schema.js';
import { updateUserRequestSchema } from './contracts/update-user-request.schema.js';
import type { UpdateUserRequest } from './contracts/update-user-request.schema.js';
import { userResponseSchema } from './contracts/user-response.schema.js';
import { userSchema } from './contracts/user.schema.js';
import { UsersService } from './users.service.js';

@Controller({ path: 'users', version: API_VERSION })
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(apiConfig.KEY) private readonly api: ConfigType<typeof apiConfig>,
  ) {}

  @Get()
  @ApiOperation({ operationId: 'listUsers' })
  @ApiQuery({
    name: 'email',
    required: false,
    schema: toOpenApiSchema(listUsersRequestSchema.shape.email, 'input'),
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    schema: toOpenApiSchema(listUsersRequestSchema.shape.sort, 'input'),
  })
  @ApiQuery({
    name: 'direction',
    required: false,
    schema: toOpenApiSchema(listUsersRequestSchema.shape.direction, 'input'),
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 250, default: 25 },
  })
  @ApiQuery({ name: 'after', required: false, schema: { type: 'string', maxLength: 1024 } })
  @ApiQuery({ name: 'before', required: false, schema: { type: 'string', maxLength: 1024 } })
  @ApiOkResponse({ schema: toOpenApiSchema(listUsersResponseSchema, 'output') })
  @ApiBadRequestResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiTooManyRequestsResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiInternalServerErrorResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @SerializeOptions({ schema: listUsersResponseSchema })
  list(@Query({ schema: listUsersRequestSchema }) query: ListUsersRequest) {
    return this.usersService.list(query);
  }

  @QueryMethod()
  @ApiOperation({ operationId: 'queryUsers' })
  @ApiBody({ schema: toOpenApiSchema(queryUsersRequestSchema, 'input') })
  @ApiOkResponse({ schema: toOpenApiSchema(listUsersResponseSchema, 'output') })
  @ApiBadRequestResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiTooManyRequestsResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiInternalServerErrorResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @SerializeOptions({ schema: listUsersResponseSchema })
  query(
    @Body({ schema: queryUsersRequestSchema }) body: QueryUsersRequest,
    @Query({ schema: queryUsersUrlQuerySchema }) _query: Record<never, never>,
  ) {
    return this.usersService.list(body);
  }

  @Get(':userId')
  @ApiOperation({ operationId: 'getUser' })
  @ApiParam({ name: 'userId', schema: toOpenApiSchema(userSchema.shape.id, 'input') })
  @ApiOkResponse({ schema: toOpenApiSchema(userResponseSchema, 'output') })
  @ApiBadRequestResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiNotFoundResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiTooManyRequestsResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiInternalServerErrorResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @SerializeOptions({ schema: userResponseSchema })
  findById(@Param('userId', { schema: userSchema.shape.id }) userId: string) {
    return this.usersService.findById(userId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'deleteUser' })
  @ApiParam({ name: 'userId', schema: toOpenApiSchema(userSchema.shape.id, 'input') })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiNotFoundResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiTooManyRequestsResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiInternalServerErrorResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  async delete(@Param('userId', { schema: userSchema.shape.id }) userId: string): Promise<void> {
    await this.usersService.delete(userId);
  }

  @Patch(':userId')
  @ApiOperation({ operationId: 'updateUser' })
  @ApiParam({ name: 'userId', schema: toOpenApiSchema(userSchema.shape.id, 'input') })
  @ApiBody({ schema: toOpenApiSchema(updateUserRequestSchema, 'input') })
  @ApiOkResponse({ schema: toOpenApiSchema(userResponseSchema, 'output') })
  @ApiBadRequestResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiNotFoundResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiConflictResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiTooManyRequestsResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiInternalServerErrorResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @SerializeOptions({ schema: userResponseSchema })
  update(
    @Param('userId', { schema: userSchema.shape.id }) userId: string,
    @Body({ schema: updateUserRequestSchema }) body: UpdateUserRequest,
  ) {
    return this.usersService.update(userId, body);
  }

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
