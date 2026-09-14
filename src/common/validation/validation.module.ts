import { BadRequestException, Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';

@Module({
  providers: [
    {
      provide: APP_PIPE,
      useFactory: () =>
        new StandardSchemaValidationPipe({
          transform: true,
          exceptionFactory: () => new BadRequestException(),
        }),
    },
  ],
})
export class ValidationModule {}
