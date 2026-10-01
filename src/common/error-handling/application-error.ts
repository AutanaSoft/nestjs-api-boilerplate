export type ApplicationErrorCode =
  | 'RESOURCE_NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_REFRESH_TOKEN'
  | 'INVALID_CURRENT_PASSWORD'
  | 'PASSWORD_REUSE_NOT_ALLOWED'
  | 'RESOURCE_NOT_OWNED';

export abstract class ApplicationError extends Error {
  abstract readonly code: ApplicationErrorCode;

  protected constructor(options?: ErrorOptions) {
    super(undefined, options);
    this.name = new.target.name;
  }
}
