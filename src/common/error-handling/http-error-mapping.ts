import { ApplicationError } from './application-error.js';
import type { ApplicationErrorCode } from './application-error.js';
import type { ErrorResponse } from './error-response.js';

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

export function mapErrorToResponse(error: unknown, requestId: string): ErrorResponse<never> {
  const descriptor =
    error instanceof ApplicationError
      ? applicationErrorHttpDescriptors[error.code]
      : unknownErrorHttpDescriptor;

  return {
    statusCode: descriptor.statusCode,
    code: descriptor.code,
    message: descriptor.message,
    requestId,
  };
}
