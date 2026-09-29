import { ApplicationError } from '../../common/error-handling/application-error.js';

export class InvalidRefreshTokenError extends ApplicationError {
  readonly code = 'INVALID_REFRESH_TOKEN' as const;

  constructor() {
    super();
  }
}

export class InvalidCredentialsError extends ApplicationError {
  readonly code = 'INVALID_CREDENTIALS' as const;

  constructor() {
    super();
  }
}
