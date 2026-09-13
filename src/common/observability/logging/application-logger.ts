export type HttpRequestCompletedMetadata = Readonly<{
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
}>;

export type UnexpectedHttpErrorMetadata = Readonly<{
  requestId: string;
  requestIdFallback: boolean;
  method: string;
  route: string;
  errorType: string;
}>;

/** Minimal application-owned contract for correlated HTTP events. */
export interface ApplicationLogger {
  logHttpRequestCompleted(metadata: HttpRequestCompletedMetadata): void;
  logUnexpectedHttpError(metadata: UnexpectedHttpErrorMetadata): void;
}
