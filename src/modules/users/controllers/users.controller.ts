import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  QueryMethod,
  SerializeOptions,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiForbiddenResponse,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentPrincipal, type AuthenticatedPrincipal } from '../../../common/auth/authenticated-principal.js';
import { errorResponseSchema } from '../../../common/error-handling/error-response.js';
import { toOpenApiSchema } from '../../../common/openapi/openapi-schema.js';
import { API_VERSION } from '../../../config/api.config.js';
import { listUsersRequestSchema } from '../contracts/list-users-request.schema.js';
import type { ListUsersRequest } from '../contracts/list-users-request.schema.js';
import { listUsersResponseSchema } from '../contracts/list-users-response.schema.js';
import { queryUsersRequestSchema, queryUsersUrlQuerySchema } from '../contracts/query-users-request.schema.js';
import type { QueryUsersRequest } from '../contracts/query-users-request.schema.js';
import { updateUserRequestSchema } from '../contracts/update-user-request.schema.js';
import type { UpdateUserRequest } from '../contracts/update-user-request.schema.js';
import { userResponseSchema, viewerUserResponseSchema } from '../contracts/user-response.schema.js';
import { userSchema } from '../contracts/user.schema.js';
import { UsersService } from '../services/users.service.js';

@Controller({ path: 'users', version: API_VERSION })
@ApiBearerAuth('bearer')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
  @ApiUnauthorizedResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  list(
    @Query({ schema: listUsersRequestSchema }) query: ListUsersRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.usersService.list(query, principal.userId);
  }

  @QueryMethod()
  @ApiOperation({ operationId: 'queryUsers' })
  @ApiBody({ schema: toOpenApiSchema(queryUsersRequestSchema, 'input') })
  @ApiOkResponse({ schema: toOpenApiSchema(listUsersResponseSchema, 'output') })
  @ApiBadRequestResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiTooManyRequestsResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiInternalServerErrorResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @SerializeOptions({ schema: listUsersResponseSchema })
  @ApiUnauthorizedResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  query(
    @Body({ schema: queryUsersRequestSchema }) body: QueryUsersRequest,
    @Query({ schema: queryUsersUrlQuerySchema }) _query: Record<never, never>,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.usersService.list(body, principal.userId);
  }

  @Get('me')
  @ApiOperation({ operationId: 'getCurrentUser' })
  @ApiOkResponse({ schema: toOpenApiSchema(userResponseSchema, 'output') })
  @ApiUnauthorizedResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiInternalServerErrorResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @SerializeOptions({ schema: userResponseSchema })
  findCurrent(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.usersService.findById(principal.userId, principal.userId);
  }

  @Get(':userId')
  @ApiOperation({ operationId: 'getUser' })
  @ApiParam({ name: 'userId', schema: toOpenApiSchema(userSchema.shape.id, 'input') })
  @ApiOkResponse({ schema: toOpenApiSchema(viewerUserResponseSchema, 'output') })
  @ApiBadRequestResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiNotFoundResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiTooManyRequestsResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiInternalServerErrorResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiUnauthorizedResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @SerializeOptions({ schema: viewerUserResponseSchema })
  findById(
    @Param('userId', { schema: userSchema.shape.id }) userId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.usersService.findById(userId, principal.userId);
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
  @ApiUnauthorizedResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiForbiddenResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  async delete(
    @Param('userId', { schema: userSchema.shape.id }) userId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<void> {
    await this.usersService.delete(userId, principal.userId);
  }

  @Patch('me')
  @ApiOperation({ operationId: 'updateCurrentUser' })
  @ApiBody({ schema: toOpenApiSchema(updateUserRequestSchema, 'input') })
  @ApiOkResponse({ schema: toOpenApiSchema(userResponseSchema, 'output') })
  @ApiBadRequestResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiUnauthorizedResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiInternalServerErrorResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @SerializeOptions({ schema: userResponseSchema })
  updateCurrent(
    @Body({ schema: updateUserRequestSchema }) body: UpdateUserRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.usersService.update(principal.userId, principal.userId, body);
  }

  @Patch(':userId')
  @ApiOperation({ operationId: 'updateUser' })
  @ApiParam({ name: 'userId', schema: toOpenApiSchema(userSchema.shape.id, 'input') })
  @ApiBody({ schema: toOpenApiSchema(updateUserRequestSchema, 'input') })
  @ApiOkResponse({ schema: toOpenApiSchema(userResponseSchema, 'output') })
  @ApiBadRequestResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiNotFoundResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiForbiddenResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiUnauthorizedResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiTooManyRequestsResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiInternalServerErrorResponse({ schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @SerializeOptions({ schema: userResponseSchema })
  update(
    @Param('userId', { schema: userSchema.shape.id }) userId: string,
    @Body({ schema: updateUserRequestSchema }) body: UpdateUserRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.usersService.update(userId, principal.userId, body);
  }
}
