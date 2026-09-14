import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import apiConfig from './config/api.config.js';
import appConfig from './config/app.config.js';
import corsConfig from './config/cors.config.js';
import httpConfig from './config/http.config.js';
import rateLimitConfig from './config/rate-limit.config.js';
import { ErrorHandlingModule } from './common/error-handling/error-handling.module.js';
import { ObservabilityModule } from './common/observability/observability.module.js';
import { SerializationModule } from './common/serialization/serialization.module.js';
import { ValidationModule } from './common/validation/validation.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, apiConfig, httpConfig, corsConfig, rateLimitConfig],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [rateLimitConfig.KEY],
      useFactory: (config: ConfigType<typeof rateLimitConfig>) => [
        {
          ttl: config.global.ttlMs,
          limit: config.global.limit,
        },
      ],
    }),
    HealthModule,
    ObservabilityModule,
    ErrorHandlingModule,
    SerializationModule,
    ValidationModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
