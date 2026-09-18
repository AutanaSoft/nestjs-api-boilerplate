import { ApplicationError } from '../../common/error-handling/application-error.js';

export class UserNotFoundError extends ApplicationError {
  readonly code = 'RESOURCE_NOT_FOUND' as const;

  constructor(options?: ErrorOptions) {
    super(options);
  }
}

export class UserEmailConflictError extends ApplicationError {
  readonly code = 'CONFLICT' as const;

  constructor(
    readonly email: string,
    options?: ErrorOptions,
  ) {
    super(options);
  }
}
