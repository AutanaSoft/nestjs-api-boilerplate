import { Controller, Get } from '@nestjs/common';
import { API_VERSION } from '../../src/config/api.config.js';

@Controller({ path: '__test/rate-limit', version: API_VERSION })
export class E2ERateLimitController {
  @Get()
  get(): void {}
}
