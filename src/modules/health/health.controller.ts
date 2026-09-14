import { Controller, Get, SerializeOptions } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { errorResponseSchema } from '../../common/error-handling/error-response.js';
import { toOpenApiSchema } from '../../common/openapi/openapi-schema.js';
import { API_VERSION } from '../../config/api.config.js';
import { healthResponseSchema } from './contracts/health-response.schema.js';

@SkipThrottle()
@Controller({ path: 'health', version: API_VERSION })
export class HealthController {
  constructor(private readonly healthCheckService: HealthCheckService) {}

  @Get('live')
  @ApiOperation({ operationId: 'healthLive' })
  @ApiResponse({ status: 200, schema: toOpenApiSchema(healthResponseSchema, 'output') })
  @ApiResponse({ status: 500, schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiResponse({ status: 503, schema: toOpenApiSchema(healthResponseSchema, 'output') })
  @HealthCheck()
  @SerializeOptions({ schema: healthResponseSchema })
  live() {
    return this.healthCheckService.check([]);
  }

  @Get('ready')
  @ApiOperation({ operationId: 'healthReady' })
  @ApiResponse({ status: 200, schema: toOpenApiSchema(healthResponseSchema, 'output') })
  @ApiResponse({ status: 500, schema: toOpenApiSchema(errorResponseSchema, 'output') })
  @ApiResponse({ status: 503, schema: toOpenApiSchema(healthResponseSchema, 'output') })
  @HealthCheck()
  @SerializeOptions({ schema: healthResponseSchema })
  ready() {
    return this.healthCheckService.check([]);
  }
}
