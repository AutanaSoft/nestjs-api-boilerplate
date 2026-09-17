import { registerAs } from '@nestjs/config';
import { z } from 'zod';

export const shutdownEnvironmentSchema = z.object({
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

export const shutdownConfigSchema = z.object({
  timeoutMs: z.number().int().positive(),
});

export type ShutdownConfig = Readonly<z.output<typeof shutdownConfigSchema>>;
export type ShutdownEnvironment = z.input<typeof shutdownEnvironmentSchema>;

export function buildShutdownConfig(
  environment: ShutdownEnvironment = process.env,
): ShutdownConfig {
  const parsedEnvironment = shutdownEnvironmentSchema.parse(environment);

  return shutdownConfigSchema.parse({ timeoutMs: parsedEnvironment.SHUTDOWN_TIMEOUT_MS });
}

const shutdownConfig = registerAs<ShutdownConfig>('shutdown', buildShutdownConfig);

export default shutdownConfig;
