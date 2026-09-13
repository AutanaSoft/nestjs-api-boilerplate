import { Controller, Get, SerializeOptions } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { API_VERSION } from '../../config/api.config.js';
import { healthResponseSchema } from './contracts/health-response.schema.js';

@SkipThrottle()
@Controller({ path: 'health', version: API_VERSION })
export class HealthController {
  constructor(private readonly healthCheckService: HealthCheckService) {}

  @Get('live')
  @HealthCheck()
  @SerializeOptions({ schema: healthResponseSchema })
  live() {
    return this.healthCheckService.check([]);
  }

  @Get('ready')
  @HealthCheck()
  @SerializeOptions({ schema: healthResponseSchema })
  ready() {
    return this.healthCheckService.check([]);
  }
}
