export type ErrorResponse<TDetails = never> = Readonly<{
  statusCode: number;
  code: string;
  message: string;
  requestId: string;
  details?: TDetails;
}>;
