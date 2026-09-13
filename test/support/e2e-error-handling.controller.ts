import { Controller, Get } from '@nestjs/common';
import { ApplicationError } from '../../src/common/error-handling/application-error.js';
import { API_VERSION } from '../../src/config/api.config.js';

type SensitiveResourceContext = Readonly<{
  token: string;
  context: string;
}>;

class E2EResourceNotFoundError extends ApplicationError {
  readonly code = 'RESOURCE_NOT_FOUND' as const;

  constructor(readonly context: SensitiveResourceContext) {
    super({ cause: new Error('sensitive-cause') });
  }
}

@Controller({ path: '__test/errors', version: API_VERSION })
export class E2EErrorHandlingController {
  @Get('application-error')
  applicationError(): never {
    throw new E2EResourceNotFoundError({
      token: 'sensitive-token',
      context: 'sensitive-context',
    });
  }

  @Get('unknown-error')
  unknownError(): never {
    throw new Error('sensitive-token', { cause: new Error('sensitive-cause') });
  }
}
