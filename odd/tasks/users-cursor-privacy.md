# Users cursor privacy

## Objective

Remove normalized email from Users pagination cursors without adding signing or secret-based integrity, accepting that
cursor compatibility will remain bound only to sorting and direction.

## Tasks

### [x] USERS-CURSOR-1 — Remove email binding from pagination cursors

**Status:** Complete.

**Outcome:** Encoded Users cursors no longer contain normalized email. They remain versioned, base64url encoded,
length-limited, position-aware, and compatible only with their original sort and direction. Reusing a cursor with
another email filter is accepted by design.

**Allowed edit surfaces:**

- `src/modules/users/**`
- `test/modules/users/**`
- `docs/api/pagination.md`
- `docs/prd/users/management/users-management-pdr.md`
- `odd/tasks/users-module.md`
- `odd/tasks/users-cursor-privacy.md`

**Constraints:**

- Do not add HMAC, signing, encryption, secrets, or server-side cursor storage.
- Preserve ordering positions, cursor version, format validation, and sort/direction compatibility.
- Remove raw email from newly emitted cursors and update affected tests/documentation.
- Preserve GET and QUERY behavior other than cross-filter cursor compatibility.
- Reject previously emitted v1 cursors that still contain `email`; no compatibility transition is required because there
  are no production clients.
- Do not create a commit without an explicit developer request.

**Checks:** Focused cursor/service/E2E tests, `pnpm lint`, `pnpm test`, `pnpm build`, full `pnpm test:e2e`,
`pnpm lint:md`, stable `pnpm lint-staged`, and `git diff --check`.

**Evidence:** Focused TDD and independent verification confirmed that emitted cursors contain no email, legacy
email-bearing v1 cursors are rejected, sort/direction compatibility remains, and cross-filter GET/QUERY reuse applies
the current request filter. Verification passed `pnpm lint`, `pnpm test` (42 files, 341 tests), `pnpm build` (no
TypeScript issues), `pnpm test:e2e` (59 tests against local PostgreSQL 16), Prettier, Markdownlint, and
`git diff --check`. Two `pnpm lint-staged` passes were content-stable, and the actual pre-commit hook produced the same
tree. Work-unit commit `27a560c` (`refactor(users): remove email from pagination cursors`) completed the task after
explicit developer authorization.
