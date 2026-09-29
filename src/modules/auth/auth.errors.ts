import { ApplicationError } from '../../common/error-handling/application-error.js';

export class InvalidCurrentPasswordError extends ApplicationError {
  readonly code = 'INVALID_CURRENT_PASSWORD' as const;

  constructor() {
    super();
  }
}

export class PasswordReuseNotAllowedError extends ApplicationError {
  readonly code = 'PASSWORD_REUSE_NOT_ALLOWED' as const;

  constructor() {
    super();
  }
}

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
