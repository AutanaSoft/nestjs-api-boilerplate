import { All, Controller, NotFoundException } from '@nestjs/common';
import { API_VERSION } from '../../config/api.config.js';
import { Public } from '../auth/public.js';

@Public()
@Controller({ version: API_VERSION })
export class NotFoundController {
  @All('{*path}')
  notFound(): never {
    throw new NotFoundException();
  }
}
