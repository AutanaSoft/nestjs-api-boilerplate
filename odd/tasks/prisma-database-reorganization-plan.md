# Prisma database reorganization plan

## Objective

Preserve the agreed implementation proposal for colocating Prisma schema assets under `src/database/`, splitting models
into independent files, and adding an explicit, safe development seed workflow.

## Scope

### [x] PRISMA-PLAN-1 — Document the implementation plan

**Status:** Complete.

**Outcome:** A reviewable implementation plan exists under `docs/plans/database/` with the target layout, ownership
boundaries, phased changes, seed design, risks, acceptance criteria, and verification commands.

**Allowed edit surfaces:**

- `docs/plans/database/prisma-reorganization.md`
- `odd/tasks/prisma-database-reorganization-plan.md`

**Constraints:**

- Keep `prisma.config.ts` at the repository root.
- Move only schema assets, independent model files, migrations, and seed sources under `src/database/prisma/` in the
  future implementation.
- Keep Prisma model fields camelCase while mapping the physical table, columns, constraints, and indexes to explicit
  PostgreSQL snake_case identifiers, including `users`, `display_name`, `created_at`, and `updated_at`.
- Consolidate the three disposable pre-release migrations into one initial migration while preserving the User table,
  indexes, handwritten function, trigger, trigger condition, and runtime behavior.
- Recreate only disposable development databases, with explicit destructive confirmation immediately before execution;
  generate the baseline with `migrate dev --name initial --create-only`, append the handwritten trigger SQL, then apply
  it. Treat all later migrations as immutable.
- Repopulate development data through explicit seeds and keep them separate from E2E fixtures.
- Do not implement the reorganization as part of this documentation task.

**Checks:** Prettier, markdownlint, and `git diff --check` for the changed Markdown files.

**Planned commit:** `docs(database): plan Prisma reorganization`

**Evidence:** Created `docs/plans/database/prisma-reorganization.md` with camelCase Prisma APIs, explicit snake_case
table/column/constraint/index mappings, a single reviewed initial migration, preservation of handwritten PostgreSQL
behavior, controlled development database recreation, immutable later history, and seed-based repopulation. Independent
static review confirmed the Prisma 7 mapping syntax and `--create-only` workflow. Prettier, markdownlint, and whitespace
checks passed. Work-unit commit `8de1058` (`docs(database): plan Prisma reorganization`) completed the task on
`refactor/prisma-database-layout`.
