import { HttpException, HttpStatus } from '@nestjs/common';
import { ApplicationError } from './application-error.js';
import type { ApplicationErrorCode } from './application-error.js';
import type { ErrorResponse } from './error-response.js';
import { ResponseContractViolation } from '../serialization/response-contract-violation.js';

export type HttpErrorDescriptor = Readonly<{
  statusCode: number;
  code: string;
  message: string;
}>;

export const applicationErrorHttpDescriptors = Object.freeze({
  RESOURCE_NOT_FOUND: Object.freeze({
    statusCode: 404,
    code: 'RESOURCE_NOT_FOUND',
    message: 'The requested resource was not found.',
  }),
  CONFLICT: Object.freeze({
    statusCode: 409,
    code: 'CONFLICT',
    message: 'The request conflicts with the current resource state.',
  }),
}) satisfies Readonly<Record<ApplicationErrorCode, HttpErrorDescriptor>>;

const unknownErrorHttpDescriptor: HttpErrorDescriptor = Object.freeze({
  statusCode: 500,
  code: 'INTERNAL_SERVER_ERROR',
  message: 'An unexpected error occurred.',
});

const httpExceptionHttpDescriptors: Readonly<Record<number, HttpErrorDescriptor>> = Object.freeze({
  [HttpStatus.BAD_REQUEST]: Object.freeze({
    statusCode: 400,
    code: 'BAD_REQUEST',
    message: 'The request is invalid.',
  }),
  [HttpStatus.UNAUTHORIZED]: Object.freeze({
    statusCode: 401,
    code: 'UNAUTHORIZED',
    message: 'Authentication is required.',
  }),
  [HttpStatus.FORBIDDEN]: Object.freeze({
    statusCode: 403,
    code: 'FORBIDDEN',
    message: 'You are not allowed to perform this action.',
  }),
  [HttpStatus.NOT_FOUND]: Object.freeze({
    statusCode: 404,
    code: 'ROUTE_NOT_FOUND',
    message: 'The requested route was not found.',
  }),
  [HttpStatus.CONFLICT]: Object.freeze({
    statusCode: 409,
    code: 'CONFLICT',
    message: 'The request conflicts with the current resource state.',
  }),
  [HttpStatus.TOO_MANY_REQUESTS]: Object.freeze({
    statusCode: 429,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests.',
  }),
});

function hasOwnProperty<ObjectType extends object>(
  object: ObjectType,
  property: PropertyKey,
): property is keyof ObjectType {
  return Object.hasOwn(object, property);
}

function getApplicationErrorHttpDescriptor(error: ApplicationError): HttpErrorDescriptor {
  const code: PropertyKey = error.code;

  return hasOwnProperty(applicationErrorHttpDescriptors, code)
    ? applicationErrorHttpDescriptors[code]
    : unknownErrorHttpDescriptor;
}

function getHttpExceptionHttpDescriptor(error: HttpException): HttpErrorDescriptor {
  try {
    const statusCode: unknown = error.getStatus();

    return typeof statusCode === 'number' && hasOwnProperty(httpExceptionHttpDescriptors, statusCode)
      ? httpExceptionHttpDescriptors[statusCode]
      : unknownErrorHttpDescriptor;
  } catch {
    return unknownErrorHttpDescriptor;
  }
}

export function mapErrorToResponse(error: unknown, requestId: string): ErrorResponse<never> {
  const descriptor =
    error instanceof ResponseContractViolation
      ? unknownErrorHttpDescriptor
      : error instanceof ApplicationError
        ? getApplicationErrorHttpDescriptor(error)
        : error instanceof HttpException
          ? getHttpExceptionHttpDescriptor(error)
          : unknownErrorHttpDescriptor;

  return {
    statusCode: descriptor.statusCode,
    code: descriptor.code,
    message: descriptor.message,
    requestId,
  };
}
