# OB-13 Reproducible pnpm

## Objective

Make pnpm acquisition reproducible by declaring the current stable pnpm release as the repository's single canonical
package-manager version.

## Problem and rationale

The README names pnpm 11.25.0 and says Corepack uses a declaration from `package.json`, but that declaration does not
exist. CI enables Corepack and invokes pnpm without a repository-owned executable version. This leaves local and CI
installs dependent on ambient tool state.

The npm registry `pnpm/latest` endpoint identifies **pnpm 12.4.2** as the current stable release. The user selected
`packageManager` plus Corepack as the single source of truth, without duplicating the version in CI.

## Scope

- Add `"packageManager": "pnpm@12.4.2"` to `package.json`.
- Align README prerequisites and Corepack instructions with the canonical declaration.
- Ensure CI installs pnpm through `pnpm/action-setup@v4` while relying on `packageManager` rather than a second version
  pin.
- Verify a frozen install with pnpm 12.4.2 and confirm the lockfile does not drift.
- Mark OB-13 complete in both operational baselines with factual evidence.

## Constraints and non-goals

- The user authorized replacing the `pnpm-workspace.yaml` placeholder with explicit `@scarf/scarf: true` build
  authorization after pnpm 12 rejected the ambiguous value.
- Accept only pnpm 12.4.2 package-manager metadata in `pnpm-lock.yaml`; application dependency versions must not drift.
- Use `pnpm/action-setup@v4` in CI without a version input; do not duplicate the pnpm version.
- Do not commit or push without a separate explicit request.

## Tasks

- [x] **OB13-1 — Canonical package-manager declaration**
  - Added pnpm 12.4.2 as `packageManager` and aligned README instructions for Node 26.
  - CI uses `pnpm/action-setup@v4` without a version input, preserving `packageManager` as the single source.
- [x] **OB13-2 — Reproducibility verification**
  - Corepack 0.36.0 resolves pnpm 12.4.2.
  - Normal and frozen installs pass; the frozen rerun produces no lockfile or workspace drift.
  - Format, lint, Markdown, unit, process, E2E, and build checks pass.
- [x] **OB13-3 — Baseline closure and review**
  - Both baselines mark OB-13 complete with observed evidence.
  - Two lint-staged runs were stable, independent verification found no issues, and native review
    `review-391e19d0800074ea` was approved and acknowledged.

## Acceptance criteria

- `package.json` declares exactly `pnpm@12.4.2` as the canonical package manager.
- README uses Corepack locally and CI uses `pnpm/action-setup`; both consume `packageManager` as the only repository
  pnpm version source.
- `pnpm --version` resolves to 12.4.2 in the repository context.
- `pnpm install --frozen-lockfile` succeeds without changing `pnpm-lock.yaml`.
- Existing quality checks pass.
- Both baselines mark OB-13 complete with current evidence.
- `pnpm-workspace.yaml` contains the user-approved boolean authorization for `@scarf/scarf`.

## Verification evidence

- Installed Corepack 0.36.0 globally with explicit user authorization.
- `corepack pnpm --version` reports 12.4.2.
- Normal and frozen installs pass; frozen-run hashes are stable.
- pnpm 12 added only package-manager executable metadata/platform packages to the lockfile; application dependency
  versions did not drift.
- Authorized `@scarf/scarf` builds explicitly in `pnpm-workspace.yaml` after user approval.
- Prettier, lint, Markdown lint (302 files, 0 issues), unit tests (208), process tests (3), E2E tests (33), build, and
  diff check pass.
- Two lint-staged runs and the final frozen install produced no content or mode changes.
- Independent verification reported no candidate findings.
- Native high-risk review `review-391e19d0800074ea` was approved and acknowledged. Its non-blocking advisories concerned
  the pnpm-generated second lockfile document, readiness checklist wording, and the explicit Scarf install-script
  permission.

## Progress and next step

OB13-1 through OB13-3 are complete. The exact seven-file OB-13 candidate is staged, verified, and review-approved. No
commit or push was performed; untracked `odd/` continuity files remain outside the candidate.
