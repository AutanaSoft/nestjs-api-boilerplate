import { StreamableFile } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ResponseContractViolation } from './response-contract-violation.js';
import { ResponseSchemaSerializerInterceptor } from './response-schema-serializer.interceptor.js';

type SerializeOptions = Readonly<{
  schema?: unknown;
}>;

const handler = () => undefined;
const controller = class {};

function createContext(): ExecutionContext {
  return {
    getClass: () => controller,
    getHandler: () => handler,
  } as unknown as ExecutionContext;
}

function createInterceptor(options?: SerializeOptions): ResponseSchemaSerializerInterceptor {
  return new ResponseSchemaSerializerInterceptor({
    getAllAndOverride: () => options,
  });
}

function callHandler(value: unknown): CallHandler {
  return {
    handle: () => of(value),
  };
}

describe('ResponseSchemaSerializerInterceptor', () => {
  it('uses a Zod schema transformation', async () => {
    const schema = z.object({
      id: z.string().transform((value) => value.toUpperCase()),
    });

    await expect(
      lastValueFrom(createInterceptor({ schema }).intercept(createContext(), callHandler({ id: 'abc' }))),
    ).resolves.toEqual({ id: 'ABC' });
  });

  it('projects only declared top-level properties', async () => {
    const schema = z.object({ id: z.string() });

    await expect(
      lastValueFrom(
        createInterceptor({ schema }).intercept(
          createContext(),
          callHandler({ id: 'public-id', internalValue: 'do-not-expose' }),
        ),
      ),
    ).resolves.toEqual({ id: 'public-id' });
  });

  it('returns a top-level object produced by a schema transformation', async () => {
    const schema = z
      .object({ firstName: z.string(), lastName: z.string() })
      .transform(({ firstName, lastName }) => ({ displayName: `${firstName} ${lastName}` }));

    await expect(
      lastValueFrom(
        createInterceptor({ schema }).intercept(
          createContext(),
          callHandler({ firstName: 'Ada', lastName: 'Lovelace' }),
        ),
      ),
    ).resolves.toEqual({ displayName: 'Ada Lovelace' });
  });

  it('translates Standard Schema issues without exposing issues or rejected values', async () => {
    const rejectedValue = { id: 42, secret: 'do-not-expose' };
    const schema = z.object({ id: z.string() });

    const error = await getError(
      lastValueFrom(createInterceptor({ schema }).intercept(createContext(), callHandler(rejectedValue))),
    );

    expect(error).toBeInstanceOf(ResponseContractViolation);
    expect(error.message).toBe('');
    expect(Object.keys(error)).toEqual([]);
    expect(JSON.stringify(error)).toBe('{}');
    expect(error).not.toHaveProperty('issues');
    expect(error).not.toHaveProperty('value');
    expect(error).not.toHaveProperty('rejectedValue');
    expect(JSON.stringify(error)).not.toContain('do-not-expose');
  });

  it('retains a non-enumerable cause without exposing its payload', async () => {
    const cause = Object.assign(new Error('synchronous schema secret'), {
      issues: [{ message: 'private issue' }],
      rejectedValue: { secret: 'do-not-expose' },
    });
    const schema = {
      '~standard': {
        validate: () => {
          throw cause;
        },
      },
    };

    const error = await getError(
      lastValueFrom(createInterceptor({ schema }).intercept(createContext(), callHandler({ id: 'value' }))),
    );

    expect(error).toBeInstanceOf(ResponseContractViolation);
    expect(error.message).toBe('');
    expect(error.cause).toBe(cause);
    expect(Object.keys(error)).toEqual([]);
    expect(Object.getOwnPropertyDescriptor(error, 'cause')?.enumerable).toBe(false);
    expect(JSON.stringify(error)).toBe('{}');
    expect(JSON.stringify(error)).not.toContain('synchronous schema secret');
    expect(JSON.stringify(error)).not.toContain('do-not-expose');
  });

  it('translates an asynchronous schema rejection without exposing its payload', async () => {
    const schema = {
      '~standard': {
        validate: async () => Promise.reject(new Error('asynchronous schema secret')),
      },
    };

    const error = await getError(
      lastValueFrom(createInterceptor({ schema }).intercept(createContext(), callHandler({ id: 'value' }))),
    );

    expect(error).toBeInstanceOf(ResponseContractViolation);
    expect(error.message).toBe('');
    expect(JSON.stringify(error)).not.toContain('asynchronous schema secret');
  });

  it('applies schema semantics to every object array item', async () => {
    const schema = z.object({ id: z.string().transform((value) => value.toUpperCase()) });

    await expect(
      lastValueFrom(
        createInterceptor({ schema }).intercept(
          createContext(),
          callHandler([
            { id: 'one', internal: true },
            { id: 'two', internal: false },
          ]),
        ),
      ),
    ).resolves.toEqual([{ id: 'ONE' }, { id: 'TWO' }]);
  });

  it('passes through an exact value when no schema is declared', async () => {
    const response = { internalValue: 'unchanged' };

    await expect(lastValueFrom(createInterceptor().intercept(createContext(), callHandler(response)))).resolves.toBe(
      response,
    );
  });

  it('passes through StreamableFile responses', async () => {
    const response = new StreamableFile(Buffer.from('file content'));
    const schema = z.object({ id: z.string() });

    await expect(
      lastValueFrom(createInterceptor({ schema }).intercept(createContext(), callHandler(response))),
    ).resolves.toBe(response);
  });

  it.each([null, undefined, 'value', 42, true])('preserves primitive and null response %j', async (response) => {
    const schema = z.object({ id: z.string() });

    await expect(
      lastValueFrom(createInterceptor({ schema }).intercept(createContext(), callHandler(response))),
    ).resolves.toBe(response);
  });

  it('preserves handler-originated observable errors', async () => {
    const handlerError = new Error('handler failed');
    const schema = z.object({ id: z.string() });

    const error = await getError(
      lastValueFrom(
        createInterceptor({ schema }).intercept(createContext(), {
          handle: () => throwError(() => handlerError),
        }),
      ),
    );

    expect(error).toBe(handlerError);
    expect(error).not.toBeInstanceOf(ResponseContractViolation);
  });
});

async function getError(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof Error) {
      return error;
    }

    throw new Error('Expected an Error.');
  }

  throw new Error('Expected the promise to reject.');
}
