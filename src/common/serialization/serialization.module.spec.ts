import { Controller, Get, Module, SerializeOptions, type INestApplication } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppModule } from '../../app.module.js';
import { ResponseSchemaSerializerInterceptor } from './response-schema-serializer.interceptor.js';
import { SerializationModule } from './serialization.module.js';

@Controller('serialization-module-spec')
class SerializationTestController {
  @Get('decorated')
  @SerializeOptions({
    schema: z.object({ value: z.string().transform((value) => value.toUpperCase()) }),
  })
  decorated() {
    return { value: 'serialized', internalValue: 'do-not-expose' };
  }

  @Get('undecorated')
  undecorated() {
    return { value: 'unchanged', internalValue: 'preserved' };
  }
}

@Module({
  imports: [SerializationModule],
  controllers: [SerializationTestController],
})
class SerializationTestApplicationModule {}

describe('SerializationModule', () => {
  it('registers one DI-resolved global ResponseSchemaSerializerInterceptor', () => {
    const providers: unknown[] =
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, SerializationModule) ?? [];
    const appInterceptorProviders = providers.filter(
      (
        provider,
      ): provider is {
        provide: unknown;
        useFactory: (reflector: Reflector) => unknown;
      } =>
        typeof provider === 'object' &&
        provider !== null &&
        'provide' in provider &&
        'useFactory' in provider &&
        provider.provide === APP_INTERCEPTOR,
    );

    expect(appInterceptorProviders).toHaveLength(1);
    expect(appInterceptorProviders[0]).toMatchObject({
      inject: [Reflector],
      useFactory: expect.any(Function),
    });
    expect(appInterceptorProviders[0].useFactory(new Reflector())).toBeInstanceOf(
      ResponseSchemaSerializerInterceptor,
    );
  });

  it('transforms decorated handlers and passes through undecorated handlers in a Nest application', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SerializationTestApplicationModule],
    }).compile();
    const app = moduleRef.createNestApplication();

    try {
      await app.init();

      await request(app.getHttpServer())
        .get('/serialization-module-spec/decorated')
        .expect(200)
        .expect({ value: 'SERIALIZED' });
      await request(app.getHttpServer())
        .get('/serialization-module-spec/undecorated')
        .expect(200)
        .expect({ value: 'unchanged', internalValue: 'preserved' });
    } finally {
      await closeApplication(app);
    }
  });
});

describe('AppModule', () => {
  it('imports SerializationModule exactly once', () => {
    const imports: unknown[] = Reflect.getMetadata('imports', AppModule) ?? [];

    expect(imports.filter((module) => module === SerializationModule)).toHaveLength(1);
  });
});

async function closeApplication(app: INestApplication): Promise<void> {
  await app.close();
}
