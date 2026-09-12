import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { API_VERSION } from '../../config/api.config.js';

@SkipThrottle()
@Controller({ path: 'health', version: API_VERSION })
export class HealthController {
  constructor(private readonly healthCheckService: HealthCheckService) {}

  @Get('live')
  @HealthCheck()
  live() {
    return this.healthCheckService.check([]);
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.healthCheckService.check([]);
  }
}
