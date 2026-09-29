import { ApplicationError } from '../../common/error-handling/application-error.js';

export class InvalidCredentialsError extends ApplicationError {
  readonly code = 'INVALID_CREDENTIALS' as const;

  constructor() {
    super();
  }
}
