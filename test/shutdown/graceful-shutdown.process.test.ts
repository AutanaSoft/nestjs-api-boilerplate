import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { request } from 'node:http';
import { createServer, Socket } from 'node:net';

const HARNESS_DEADLINE_MS = 10_000;
const MAX_DIAGNOSTIC_BYTES = 8_192;

type ExitResult = Readonly<{
  code: number | null;
  signal: NodeJS.Signals | null;
}>;

type ChildHandle = Readonly<{
  child: ChildProcess;
  diagnostics: () => string;
}>;

function withDeadline<T>(promise: Promise<T>, operation: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`${operation} exceeded its deadline`)), HARNESS_DEADLINE_MS);
    }),
  ]).finally(() => {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  });
}

function reserveLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const listener = createServer();
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      const address = listener.address();
      if (address === null || typeof address === 'string') {
        listener.close();
        reject(new Error('Could not reserve an IPv4 loopback port'));
        return;
      }
      listener.close((error) => (error === undefined ? resolve(address.port) : reject(error)));
    });
  });
}

function appendBounded(current: string, chunk: Buffer): string {
  return `${current}${chunk.toString()}`.slice(-MAX_DIAGNOSTIC_BYTES);
}

function spawnApplication(port: number, shutdownTimeoutMs?: number): ChildHandle {
  let stdout = '';
  let stderr = '';
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: process.cwd(),
    env: {
      NODE_ENV: 'development',
      PORT: String(port),
      ...(shutdownTimeoutMs === undefined ? {} : { SHUTDOWN_TIMEOUT_MS: String(shutdownTimeoutMs) }),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (chunk: Buffer) => {
    stdout = appendBounded(stdout, chunk);
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr = appendBounded(stderr, chunk);
  });

  return {
    child,
    diagnostics: () =>
      `child exitCode=${child.exitCode} signalCode=${child.signalCode}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
  };
}

async function waitForReadiness(port: number, diagnostics: () => string): Promise<void> {
  const deadline = Date.now() + HARNESS_DEADLINE_MS;

  await new Promise<void>((resolve, reject) => {
    const attempt = (): void => {
      const healthRequest = request(
        { host: '127.0.0.1', port, path: '/api/v1/health/live', method: 'GET' },
        (response) => {
          response.resume();
          if (response.statusCode === 200) {
            resolve();
            return;
          }
          reject(new Error(`Readiness returned HTTP ${response.statusCode}.\n${diagnostics()}`));
        },
      );

      healthRequest.once('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'ECONNREFUSED' && Date.now() < deadline) {
          setImmediate(attempt);
          return;
        }
        reject(new Error(`Readiness connection failed: ${error.message}.\n${diagnostics()}`));
      });
      healthRequest.end();
    };

    attempt();
  });
}

function waitForExit(child: ChildProcess, diagnostics: () => string): Promise<ExitResult> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }

  return withDeadline(
    once(child, 'exit').then(([code, signal]) => ({
      code: code as number | null,
      signal: signal as NodeJS.Signals | null,
    })),
    `Child process exit. ${diagnostics()}`,
  );
}

function connectPartialRequest(port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    socket.once('error', reject);
    socket.connect(port, '127.0.0.1', () => {
      socket.write(
        'POST /api/v1/health/live HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 10\r\n\r\nX',
        (error) => {
          if (error == null) {
            resolve(socket);
          } else {
            reject(error);
          }
        },
      );
    });
  });
}

function assertListenerClosed(port: number): Promise<void> {
  return withDeadline(
    new Promise<void>((resolve, reject) => {
      const socket = new Socket();
      socket.once('connect', () => {
        socket.destroy();
        reject(new Error('Listener accepted a new connection after the child exited'));
      });
      socket.once('error', (error: NodeJS.ErrnoException) => {
        socket.destroy();
        if (error.code === 'ECONNREFUSED') {
          resolve();
          return;
        }
        reject(error);
      });
      socket.connect(port, '127.0.0.1');
    }),
    'Listener closure check',
  );
}

async function terminateChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  child.kill('SIGKILL');
  await withDeadline(
    once(child, 'exit').then(() => undefined),
    'Child cleanup',
  );
}

const describePosix = process.platform === 'win32' ? describe.skip : describe;

describePosix('compiled graceful shutdown process', () => {
  it.each(['SIGTERM', 'SIGINT'] as const)(
    'preserves %s and stops accepting connections after graceful shutdown',
    async (signal) => {
      const port = await reserveLoopbackPort();
      let handle: ChildHandle | undefined;

      try {
        handle = spawnApplication(port);
        await once(handle.child, 'spawn');
        await waitForReadiness(port, handle.diagnostics);

        expect(handle.child.kill(signal)).toBe(true);
        const result = await waitForExit(handle.child, handle.diagnostics);

        expect(result).toEqual({ code: null, signal });
        expect(handle.diagnostics()).toContain(`lifecycle.shutdown.started`);
        expect(handle.diagnostics()).toMatch(
          new RegExp(`message: .*'lifecycle\\.shutdown\\.started'.*signal: .*'${signal}'`),
        );
        expect(handle.diagnostics()).toContain('lifecycle.shutdown.completed');
        await assertListenerClosed(port);
      } finally {
        if (handle !== undefined) {
          await terminateChild(handle.child);
        }
      }
    },
  );

  it('closes gracefully without timing out when an incomplete JSON request is connected', async () => {
    const port = await reserveLoopbackPort();
    let handle: ChildHandle | undefined;
    let socket: Socket | undefined;

    try {
      handle = spawnApplication(port, 100);
      await once(handle.child, 'spawn');
      await waitForReadiness(port, handle.diagnostics);
      socket = await connectPartialRequest(port);

      expect(handle.child.kill('SIGTERM')).toBe(true);
      const result = await waitForExit(handle.child, handle.diagnostics);

      expect(result).toEqual({ code: null, signal: 'SIGTERM' });
      expect(handle.diagnostics()).not.toContain('lifecycle.shutdown.timed_out');
      await assertListenerClosed(port);
    } finally {
      socket?.destroy();
      if (handle !== undefined) {
        await terminateChild(handle.child);
      }
    }
  });
});
