import { Module } from '@nestjs/common';
import { APP_LOGGER, REQUEST_DURATION_CLOCK } from './constants.js';
import { RequestContextService } from './context/request-context.service.js';
import { StructuredLoggerService } from './logging/logger.service.js';
import { RequestCorrelationMiddleware } from './middleware/correlation.middleware.js';
import { HttpRequestLoggingMiddleware } from './middleware/request-logging.middleware.js';

@Module({
  providers: [
    RequestContextService,
    RequestCorrelationMiddleware,
    HttpRequestLoggingMiddleware,
    StructuredLoggerService,
    {
      provide: APP_LOGGER,
      useExisting: StructuredLoggerService,
    },
    {
      provide: REQUEST_DURATION_CLOCK,
      useValue: performance.now.bind(performance),
    },
  ],
  exports: [
    APP_LOGGER,
    RequestContextService,
    RequestCorrelationMiddleware,
    HttpRequestLoggingMiddleware,
    StructuredLoggerService,
  ],
})
export class ObservabilityModule {}
