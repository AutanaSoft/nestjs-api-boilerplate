import { All, Controller, NotFoundException } from '@nestjs/common';
import { API_VERSION } from '../../config/api.config.js';

@Controller({ version: API_VERSION })
export class NotFoundController {
  @All('{*path}')
  notFound(): never {
    throw new NotFoundException();
  }
}
