import { ApplicationError } from '../../common/error-handling/application-error.js';

export class UserEmailConflictError extends ApplicationError {
  readonly code = 'CONFLICT' as const;

  constructor(
    readonly email: string,
    options?: ErrorOptions,
  ) {
    super(options);
  }
}
