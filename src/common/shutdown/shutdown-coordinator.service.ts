import { Inject, Injectable, Optional } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import shutdownConfig from '../../config/shutdown.config.js';
import { APP_LOGGER } from '../observability/constants.js';
import type { ApplicationLogger } from '../observability/logging/application-logger.js';
import { EmergencyShutdownSink, type ShutdownSignal } from './emergency-shutdown-sink.js';

export const SHUTDOWN_SIGNALS = ['SIGTERM', 'SIGINT'] as const;

type ShutdownApplication = Readonly<{
  close(signal?: string): Promise<void>;
}>;

type ShutdownRuntime = Readonly<{
  pid: number;
  on(signal: ShutdownSignal, listener: () => void): unknown;
  off(signal: ShutdownSignal, listener: () => void): unknown;
  kill(pid: number, signal: ShutdownSignal): unknown;
  exit(code: number): unknown;
}>;

type ShutdownState = 'running' | 'closing' | 'timed_out' | 'failed' | 'completed';

/** Coordinates one bounded runtime shutdown after the HTTP listener is accepting traffic. */
@Injectable()
export class ShutdownCoordinatorService {
  private state: ShutdownState = 'running';
  private app?: ShutdownApplication;
  private winningSignal?: ShutdownSignal;
  private watchdog?: ReturnType<typeof setTimeout>;
  private readonly listeners = new Map<ShutdownSignal, () => void>();

  constructor(
    @Inject(shutdownConfig.KEY) private readonly config: ConfigType<typeof shutdownConfig>,
    @Inject(APP_LOGGER) private readonly logger: ApplicationLogger,
    private readonly emergencySink: EmergencyShutdownSink,
    @Optional() private readonly runtime: ShutdownRuntime = process,
    @Optional() private readonly now: () => number = Date.now,
  ) {}

  install(app: ShutdownApplication): void {
    if (this.state !== 'running' || this.app !== undefined) {
      return;
    }

    this.app = app;
    for (const signal of SHUTDOWN_SIGNALS) {
      const listener = () => this.begin(signal);
      this.listeners.set(signal, listener);
      this.runtime.on(signal, listener);
    }
  }

  private begin(signal: ShutdownSignal): void {
    if (this.state !== 'running' || this.app === undefined) {
      return;
    }

    this.state = 'closing';
    this.winningSignal = signal;
    const startedAt = this.now();
    this.logger.logShutdownStarted({ signal, timeoutMs: this.config.timeoutMs });
    this.watchdog = setTimeout(() => this.fail('timed_out'), this.config.timeoutMs);

    void this.app.close(signal).then(
      () => this.complete(startedAt),
      () => this.fail('failed'),
    );
  }

  private complete(startedAt: number): void {
    if (this.state !== 'closing' || this.winningSignal === undefined) {
      return;
    }

    this.state = 'completed';
    this.clearWatchdog();
    this.removeListeners();
    this.logger.logShutdownCompleted({
      signal: this.winningSignal,
      durationMs: this.now() - startedAt,
    });
    this.runtime.kill(this.runtime.pid, this.winningSignal);
  }

  private fail(reason: 'timed_out' | 'failed'): void {
    if (this.state !== 'closing' || this.winningSignal === undefined) {
      return;
    }

    this.state = reason;
    this.clearWatchdog();
    this.removeListeners();
    const metadata = { signal: this.winningSignal, timeoutMs: this.config.timeoutMs };
    if (reason === 'timed_out') {
      this.emergencySink.writeTimedOut(metadata);
    } else {
      this.emergencySink.writeFailed(metadata);
    }
    this.runtime.exit(1);
  }

  private clearWatchdog(): void {
    if (this.watchdog !== undefined) {
      clearTimeout(this.watchdog);
      this.watchdog = undefined;
    }
  }

  private removeListeners(): void {
    for (const [signal, listener] of this.listeners) {
      this.runtime.off(signal, listener);
    }
    this.listeners.clear();
  }
}
