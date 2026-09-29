import type { PrismaService } from '../../src/database/prisma.service.js';

/** Hold the target session row in the disposable database; identify waiters by blocker PID, not SQL text alone. */
export async function holdRefreshRaceGate(prisma: PrismaService, sessionId: string) {
  let release!: () => void;
  let locked!: (pid: number) => void;
  const holding = prisma.$transaction(
    async (tx) => {
      const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      await tx.$queryRaw`SELECT id FROM sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
      locked(pid);
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    { timeout: 20_000 },
  );
  const holderPid = await new Promise<number>((resolve) => {
    locked = resolve;
  });
  let released = false;
  return {
    async waitForContenders() {
      const deadline = Date.now() + 8_000;
      while (Date.now() < deadline) {
        const rows = await prisma.$queryRaw<{ count: bigint }[]>`
          WITH RECURSIVE blocked(pid, blockers) AS (
            SELECT pid, pg_blocking_pids(pid) FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
              AND query LIKE '%SELECT id FROM sessions WHERE id =%FOR UPDATE%'
          ), chain(waiter, blocker) AS (
            SELECT pid, unnest(blockers) FROM blocked
            UNION
            SELECT chain.waiter, unnest(pg_blocking_pids(chain.blocker)) FROM chain
            WHERE chain.blocker <> ${holderPid}::integer
          )
          SELECT count(DISTINCT waiter)::bigint AS count FROM chain WHERE blocker = ${holderPid}::integer
        `;
        if (rows[0] && rows[0].count >= 2n) return;
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
      throw new Error('Both PostgreSQL refresh contenders were not observed waiting on the target row lock');
    },
    async release() {
      if (!released) {
        released = true;
        release();
      }
      await holding;
    },
  };
}
