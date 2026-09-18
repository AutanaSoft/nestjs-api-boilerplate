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

export type StartupCompletedMetadata = Readonly<{
  serverUrl: string;
  apiBasePath: string;
  openapiUrl?: string;
}>;

export type ShutdownStartedMetadata = Readonly<{
  signal: 'SIGTERM' | 'SIGINT';
  timeoutMs: number;
}>;

export type ShutdownCompletedMetadata = Readonly<{
  signal: 'SIGTERM' | 'SIGINT';
  durationMs: number;
}>;

/** Minimal application-owned contract for correlated HTTP and lifecycle events. */
export interface ApplicationLogger {
  logHttpRequestCompleted(metadata: HttpRequestCompletedMetadata): void;
  logStartupCompleted(metadata: StartupCompletedMetadata): void;
  logUnexpectedHttpError(metadata: UnexpectedHttpErrorMetadata): void;
  logShutdownStarted(metadata: ShutdownStartedMetadata): void;
  logShutdownCompleted(metadata: ShutdownCompletedMetadata): void;
}
