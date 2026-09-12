import { Controller, Get } from '@nestjs/common';

@Controller('__test/rate-limit')
export class E2ERateLimitController {
  @Get()
  get(): void {}
}
