export type ApplicationErrorCode = 'RESOURCE_NOT_FOUND' | 'CONFLICT';

export abstract class ApplicationError extends Error {
  abstract readonly code: ApplicationErrorCode;

  protected constructor(options?: ErrorOptions) {
    super(undefined, options);
    this.name = new.target.name;
  }
}
