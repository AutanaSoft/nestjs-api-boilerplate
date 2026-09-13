import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { ResponseSchemaSerializerInterceptor } from './response-schema-serializer.interceptor.js';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      inject: [Reflector],
      useFactory: (reflector: Reflector) => new ResponseSchemaSerializerInterceptor(reflector),
    },
  ],
})
export class SerializationModule {}
