import { Injectable, Optional } from '@nestjs/common';
import { writeSync as writeToStderr } from 'node:fs';

export type ShutdownSignal = 'SIGTERM' | 'SIGINT';

export type ShutdownFailureMetadata = Readonly<{
  signal: ShutdownSignal;
  timeoutMs: number;
}>;

/** Writes terminal shutdown events without relying on asynchronous infrastructure. */
@Injectable()
export class EmergencyShutdownSink {
  constructor(@Optional() private readonly writeSync: (fd: number, data: string) => unknown = writeToStderr) {}

  writeTimedOut(metadata: ShutdownFailureMetadata): void {
    this.write('lifecycle.shutdown.timed_out', metadata);
  }

  writeFailed(metadata: ShutdownFailureMetadata): void {
    this.write('shutdown.failed', metadata);
  }

  private write(event: string, metadata: ShutdownFailureMetadata): void {
    try {
      this.writeSync(2, `${event} signal=${metadata.signal} timeoutMs=${metadata.timeoutMs}\n`);
    } catch {
      // A failed emergency write must not prevent the forced process exit.
    }
  }
}
