import { z } from 'zod';

const healthCheckStatusSchema = z.enum(['error', 'ok', 'degraded', 'shutting_down']);
const healthIndicatorStatusSchema = z.enum(['up', 'degraded', 'down']);

const healthIndicatorSchema = z.object({ status: healthIndicatorStatusSchema }).catchall(z.unknown());
const healthIndicatorResultSchema = z.record(z.string(), healthIndicatorSchema);

export const healthResponseSchema = z.object({
  status: healthCheckStatusSchema,
  info: healthIndicatorResultSchema.optional(),
  error: healthIndicatorResultSchema.optional(),
  details: healthIndicatorResultSchema,
});

export type HealthResponse = z.output<typeof healthResponseSchema>;
