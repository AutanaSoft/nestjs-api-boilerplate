export type HttpRequestCompletedMetadata = Readonly<{
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
}>;

/** Minimal application-owned contract for correlated HTTP events. */
export interface ApplicationLogger {
  logHttpRequestCompleted(metadata: HttpRequestCompletedMetadata): void;
}
