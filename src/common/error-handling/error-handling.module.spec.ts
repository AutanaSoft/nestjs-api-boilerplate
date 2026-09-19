import { Controller, Get, Module, type INestApplication } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { HttpExceptionFilter } from './http-exception.filter.js';
import { ErrorHandlingModule } from './error-handling.module.js';

@Controller('error-handling-module-spec')
class ThrowingController {
  @Get()
  throwUnknownError(): never {
    throw new Error('unexpected test error');
  }
}

@Module({
  imports: [ErrorHandlingModule],
  controllers: [ThrowingController],
})
class ErrorHandlingTestApplicationModule {}

describe('ErrorHandlingModule', () => {
  it('registers one DI-resolved global HttpExceptionFilter', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ErrorHandlingTestApplicationModule],
    }).compile();
    const app = moduleRef.createNestApplication();

    try {
      await app.init();

      const response = await request(app.getHttpServer())
        .get('/error-handling-module-spec')
        .expect(500)
        .expect('x-request-id', /^[0-9a-f-]{36}$/);

      expect(response.body).toEqual({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
        requestId: response.headers['x-request-id'],
      });
    } finally {
      await closeApplication(app);
    }
  });

  it('declares exactly one APP_FILTER provider using HttpExceptionFilter', () => {
    const providers: unknown[] = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ErrorHandlingModule) ?? [];
    const appFilterProviders = providers.filter(
      (provider): provider is { provide: unknown } =>
        typeof provider === 'object' && provider !== null && 'provide' in provider && provider.provide === APP_FILTER,
    );

    expect(appFilterProviders).toHaveLength(1);
    expect(appFilterProviders[0]).toMatchObject({ useClass: HttpExceptionFilter });
  });
});

describe('AppModule', () => {
  it('imports ErrorHandlingModule exactly once', () => {
    const imports: unknown[] = Reflect.getMetadata('imports', AppModule) ?? [];

    expect(imports.filter((module) => module === ErrorHandlingModule)).toHaveLength(1);
  });
});

async function closeApplication(app: INestApplication): Promise<void> {
  await app.close();
}
