import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { APP_PIPE } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppModule } from '../../app.module.js';
import { ValidationModule } from './validation.module.js';

const transformedSchema = z.object({
  value: z.string().transform((value) => value.toUpperCase()),
});

const bodyMetadata: ArgumentMetadata = {
  type: 'body',
  schema: transformedSchema,
};

describe('ValidationModule', () => {
  it('registers exactly one APP_PIPE that transforms schema-decorated input', async () => {
    const pipe = resolveValidationPipe();

    await expect(pipe.transform({ value: 'normalized' }, bodyMetadata)).resolves.toEqual({
      value: 'NORMALIZED',
    });
  });

  it('throws a controlled BadRequestException without schema issues for invalid input', async () => {
    const pipe = resolveValidationPipe();

    await expect(pipe.transform({ value: 42 }, bodyMetadata)).rejects.toSatisfy(
      (error: unknown) => {
        if (!(error instanceof BadRequestException) || error.getStatus() !== 400) {
          return false;
        }

        expect(error.getResponse()).toEqual({
          message: 'Bad Request',
          statusCode: 400,
        });
        return true;
      },
    );
  });

  it('bypasses input without schema metadata', async () => {
    const pipe = resolveValidationPipe();
    const value = { value: 42 };

    await expect(pipe.transform(value, { type: 'body' })).resolves.toBe(value);
  });
});

describe('AppModule', () => {
  it('imports ValidationModule exactly once', () => {
    const imports: unknown[] = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) ?? [];

    expect(imports.filter((module) => module === ValidationModule)).toHaveLength(1);
  });
});

function resolveValidationPipe(): {
  transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown>;
} {
  const providers: unknown[] =
    Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ValidationModule) ?? [];
  const appPipeProviders = providers.filter(
    (
      provider,
    ): provider is {
      provide: unknown;
      useFactory: () => {
        transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown>;
      };
    } =>
      typeof provider === 'object' &&
      provider !== null &&
      'provide' in provider &&
      'useFactory' in provider &&
      provider.provide === APP_PIPE,
  );

  expect(appPipeProviders).toHaveLength(1);

  return appPipeProviders[0].useFactory();
}
