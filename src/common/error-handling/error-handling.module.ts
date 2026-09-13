import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ObservabilityModule } from '../observability/observability.module.js';
import { HttpExceptionFilter } from './http-exception.filter.js';

@Module({
  imports: [ObservabilityModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class ErrorHandlingModule {}
