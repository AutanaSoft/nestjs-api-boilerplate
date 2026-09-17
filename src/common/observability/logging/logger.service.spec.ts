import type { ConsoleLogger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RequestContextService } from '../context/request-context.service.js';
import { StructuredLoggerService } from './logger.service.js';
import { EmergencyShutdownSink } from '../../shutdown/emergency-shutdown-sink.js';

const consoleLoggerMethods = ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'] as const;

type ConsoleLoggerMethods = Pick<ConsoleLogger, (typeof consoleLoggerMethods)[number]>;

describe('StructuredLoggerService', () => {
  it('emits a stable terminal event with allowlisted metadata and the current request ID', () => {
    const context = new RequestContextService();
    const consoleLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
      fatal: vi.fn(),
    } satisfies ConsoleLoggerMethods;
    const logger = new StructuredLoggerService(context, consoleLogger);
    const metadataWithSensitiveFields = {
      method: 'GET',
      route: '/health/:probe',
      statusCode: 200,
      durationMs: 4.25,
      query: 'token=secret',
      authorization: 'Bearer secret',
      body: { password: 'secret' },
    };

    context.run('123e4567-e89b-42d3-a456-426614174000', () => {
      logger.logHttpRequestCompleted(metadataWithSensitiveFields);
    });

    expect(consoleLogger.log).toHaveBeenCalledWith('http.request.completed', {
      requestId: '123e4567-e89b-42d3-a456-426614174000',
      method: 'GET',
      route: '/health/:probe',
      statusCode: 200,
      durationMs: 4.25,
    });
  });

  it('emits a stable internal failure event with allowlisted metadata in a request context', () => {
    const context = new RequestContextService();
    const consoleLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
      fatal: vi.fn(),
    } satisfies ConsoleLoggerMethods;
    const logger = new StructuredLoggerService(context, consoleLogger);
    const metadataWithSensitiveFields = {
      requestId: '123e4567-e89b-42d3-a456-426614174000',
      requestIdFallback: false,
      method: 'GET',
      route: '/health/:probe',
      errorType: 'UNKNOWN_ERROR',
      message: 'database password is secret',
      stack: 'sensitive stack trace',
      cause: new Error('sensitive cause'),
      body: { password: 'secret' },
      query: 'token=secret',
      headers: { authorization: 'Bearer secret' },
    };

    context.run('123e4567-e89b-42d3-a456-426614174000', () => {
      logger.logUnexpectedHttpError(metadataWithSensitiveFields);
    });

    expect(consoleLogger.error).toHaveBeenCalledWith('http.request.failed', {
      requestId: '123e4567-e89b-42d3-a456-426614174000',
      requestIdFallback: false,
      method: 'GET',
      route: '/health/:probe',
      errorType: 'UNKNOWN_ERROR',
    });
  });

  it('emits an explicit fallback request ID without a request context', () => {
    const context = new RequestContextService();
    const consoleLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
      fatal: vi.fn(),
    } satisfies ConsoleLoggerMethods;
    const logger = new StructuredLoggerService(context, consoleLogger);

    logger.logUnexpectedHttpError({
      requestId: '123e4567-e89b-42d3-a456-426614174001',
      requestIdFallback: true,
      method: 'POST',
      route: 'unmatched',
      errorType: 'RESPONSE_CONTRACT_VIOLATION',
    });

    expect(consoleLogger.error).toHaveBeenCalledWith('http.request.failed', {
      requestId: '123e4567-e89b-42d3-a456-426614174001',
      requestIdFallback: true,
      method: 'POST',
      route: 'unmatched',
      errorType: 'RESPONSE_CONTRACT_VIOLATION',
    });
  });

  it('emits allowlisted shutdown lifecycle metadata', () => {
    const context = new RequestContextService();
    const consoleLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
      fatal: vi.fn(),
    } satisfies ConsoleLoggerMethods;
    const logger = new StructuredLoggerService(context, consoleLogger);

    logger.logShutdownStarted({ signal: 'SIGTERM', timeoutMs: 10_000, token: 'secret' });
    logger.logShutdownCompleted({ signal: 'SIGTERM', durationMs: 42, stack: 'sensitive' });

    expect(consoleLogger.log).toHaveBeenNthCalledWith(1, 'lifecycle.shutdown.started', {
      signal: 'SIGTERM',
      timeoutMs: 10_000,
    });
    expect(consoleLogger.log).toHaveBeenNthCalledWith(2, 'lifecycle.shutdown.completed', {
      signal: 'SIGTERM',
      durationMs: 42,
    });
  });
});

describe('EmergencyShutdownSink', () => {
  it('writes fixed terminal shutdown events synchronously and absorbs write failures', () => {
    const writeSync = vi.fn();
    const sink = new EmergencyShutdownSink(writeSync);

    sink.writeTimedOut({ signal: 'SIGINT', timeoutMs: 250 });
    sink.writeFailed({ signal: 'SIGTERM', timeoutMs: 500, error: new Error('secret') });

    expect(writeSync).toHaveBeenNthCalledWith(
      1,
      2,
      'lifecycle.shutdown.timed_out signal=SIGINT timeoutMs=250\n',
    );
    expect(writeSync).toHaveBeenNthCalledWith(
      2,
      2,
      'shutdown.failed signal=SIGTERM timeoutMs=500\n',
    );

    const failingSink = new EmergencyShutdownSink(() => {
      throw new Error('unavailable');
    });
    expect(() => failingSink.writeTimedOut({ signal: 'SIGTERM', timeoutMs: 1 })).not.toThrow();
  });
});
