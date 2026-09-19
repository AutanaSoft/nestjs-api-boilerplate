import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction } from 'express';
import { z } from 'zod';
import { REQUEST_ID_HEADER } from '../constants.js';
import { RequestContextService } from '../context/request-context.service.js';

const canonicalUuidV4Schema = z.uuid({ version: 'v4' }).lowercase();

type CorrelationRequest = {
  get(name: typeof REQUEST_ID_HEADER): string | undefined;
};

type CorrelationResponse = {
  setHeader(name: typeof REQUEST_ID_HEADER, value: string): void;
};

@Injectable()
export class RequestCorrelationMiddleware implements NestMiddleware<CorrelationRequest, CorrelationResponse> {
  constructor(private readonly requestContext: RequestContextService) {}

  use(request: CorrelationRequest, response: CorrelationResponse, next: NextFunction): void {
    const inboundRequestId = request.get(REQUEST_ID_HEADER);
    const parsedRequestId = canonicalUuidV4Schema.safeParse(inboundRequestId);
    const requestId = parsedRequestId.success ? parsedRequestId.data : randomUUID();

    response.setHeader(REQUEST_ID_HEADER, requestId);
    this.requestContext.run(requestId, next);
  }
}
