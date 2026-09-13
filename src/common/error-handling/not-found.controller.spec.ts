import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { NotFoundController } from './not-found.controller.js';

describe('NotFoundController', () => {
  it('throws a Nest NotFoundException for an unmatched versioned route', () => {
    const controller = new NotFoundController();

    expect(() => controller.notFound()).toThrow(NotFoundException);
  });
});
