import { describe, expect, it, vi } from 'vitest';
import { EmergencyShutdownSink } from './emergency-shutdown-sink.js';
import { ShutdownCoordinatorService } from './shutdown-coordinator.service.js';

function createCoordinator() {
  const logger = {
    logShutdownStarted: vi.fn(),
    logShutdownCompleted: vi.fn(),
  };
  const emergencySink = {
    writeTimedOut: vi.fn(),
    writeFailed: vi.fn(),
  } as unknown as EmergencyShutdownSink;
  const runtime = {
    pid: 123,
    on: vi.fn(),
    off: vi.fn(),
    kill: vi.fn(),
    exit: vi.fn(),
  };
  const coordinator = new ShutdownCoordinatorService(
    { timeoutMs: 100 },
    logger,
    emergencySink,
    runtime,
    () => 20,
  );

  return { coordinator, emergencySink, logger, runtime };
}

describe('ShutdownCoordinatorService', () => {
  it.each(['SIGTERM', 'SIGINT'] as const)(
    'closes once and re-emits the winning %s signal',
    async (signal) => {
      const { coordinator, logger, runtime } = createCoordinator();
      const app = { close: vi.fn().mockResolvedValue(undefined) };

      coordinator.install(app);
      const listener = runtime.on.mock.calls.find(
        ([registeredSignal]) => registeredSignal === signal,
      )?.[1];
      listener();
      await Promise.resolve();

      expect(app.close).toHaveBeenCalledExactlyOnceWith(signal);
      expect(logger.logShutdownStarted).toHaveBeenCalledExactlyOnceWith({
        signal,
        timeoutMs: 100,
      });
      expect(logger.logShutdownCompleted).toHaveBeenCalledExactlyOnceWith({
        signal,
        durationMs: 0,
      });
      expect(runtime.off).toHaveBeenCalledTimes(2);
      expect(runtime.kill).toHaveBeenCalledExactlyOnceWith(123, signal);
    },
  );

  it('keeps the first signal, forces timeout once, and ignores late close completion', async () => {
    vi.useFakeTimers();
    const { coordinator, emergencySink, logger, runtime } = createCoordinator();
    let resolveClose: () => void;
    const app = {
      close: vi.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveClose = resolve;
          }),
      ),
    };

    coordinator.install(app);
    const termListener = runtime.on.mock.calls.find(([signal]) => signal === 'SIGTERM')?.[1];
    const intListener = runtime.on.mock.calls.find(([signal]) => signal === 'SIGINT')?.[1];
    termListener();
    intListener();
    await vi.advanceTimersByTimeAsync(100);
    resolveClose!();
    await Promise.resolve();

    expect(app.close).toHaveBeenCalledExactlyOnceWith('SIGTERM');
    expect(emergencySink.writeTimedOut).toHaveBeenCalledExactlyOnceWith({
      signal: 'SIGTERM',
      timeoutMs: 100,
    });
    expect(runtime.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(runtime.off).toHaveBeenCalledTimes(2);
    expect(logger.logShutdownCompleted).not.toHaveBeenCalled();
    expect(runtime.kill).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('handles close rejection through the terminal failure latch', async () => {
    vi.useFakeTimers();
    const { coordinator, emergencySink, logger, runtime } = createCoordinator();
    const app = { close: vi.fn().mockRejectedValue(new Error('secret')) };

    coordinator.install(app);
    runtime.on.mock.calls.find(([signal]) => signal === 'SIGINT')?.[1]();
    await Promise.resolve();

    expect(emergencySink.writeFailed).toHaveBeenCalledExactlyOnceWith({
      signal: 'SIGINT',
      timeoutMs: 100,
    });
    expect(runtime.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(runtime.off).toHaveBeenCalledTimes(2);
    expect(logger.logShutdownCompleted).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(emergencySink.writeTimedOut).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
