import { Controller, Get } from '@nestjs/common';
import { API_VERSION } from '../../src/config/api.config.js';
import { Public } from '../../src/common/auth/public.js';

@Public()
@Controller({ path: '__test/rate-limit', version: API_VERSION })
export class E2ERateLimitController {
  @Get()
  get(): void {}
}
