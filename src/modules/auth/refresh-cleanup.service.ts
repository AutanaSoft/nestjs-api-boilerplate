import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SESSIONS_REPOSITORY } from './repositories/sessions.repository.js';
import type { SessionsRepository } from './repositories/sessions.repository.js';

const REPLAY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;
const BATCH_SIZE = 256;

/**
 * Drains retired digests after their original expiry plus seven days, independently of HTTP traffic.
 * A healthy running instance starts cleanup at boot and every minute thereafter; actual deletion
 * also depends on batch drain time and database availability. During outages or while no instance
 * is running, retention can exceed seven days without a fixed upper bound; the next successful
 * startup/tick drains the backlog. This is not a wall-clock deletion deadline.
 */
@Injectable()
export class RefreshCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RefreshCleanupService.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private active: Promise<void> | undefined;
  private stopped = false;

  constructor(@Inject(SESSIONS_REPOSITORY) private readonly sessions: SessionsRepository) {}

  onModuleInit(): void {
    void this.runOnce();
    if (!this.stopped) {
      this.timer = setInterval(() => void this.runOnce(), CLEANUP_INTERVAL_MS);
      this.timer.unref();
    }
  }

  /** One run drains every currently eligible batch; concurrent ticks share the same run. */
  runOnce(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.active) return this.active;
    const work = this.drain()
      .catch(() => {
        // Do not log database errors: driver diagnostics may contain sensitive query parameters.
        this.logger.warn('Refresh history cleanup failed; the next tick will retry.');
      })
      .finally(() => {
        this.active = undefined;
      });
    this.active = work;
    return work;
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }

  private async drain(): Promise<void> {
    while (!this.stopped) {
      // Recompute on every batch so no history is removed before its own expiry plus seven days.
      const cutoff = new Date(Date.now() - REPLAY_WINDOW_MS);
      const removed = await this.sessions.purgeRetired(cutoff);
      if (removed < BATCH_SIZE) break;
    }
  }
}
