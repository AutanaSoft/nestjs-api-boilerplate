# Line length 120

## Objective

Adopt a project-wide 120-character formatting target through EditorConfig and markdownlint, then normalize supported
files without mixing functional changes.

## Delivery

- **Branch:** `chore/line-length-120`
- **Strategy:** `feature-branch-chain`, explicitly selected by the user after the formatter forecast
- **Forecast:** more than 100 files and well above 400 authored changed lines
- **TDD mode:** not applicable; formatting-only change
- **Verification runner:** Prettier, markdownlint, lint, tests, build, and diff checks
- **Route:** delegated direct; repository-wide formatting triggers the multi-file writer rule
- **Commit sequence:** configuration, Markdown formatting, TypeScript formatting

## Scope

### [x] FORMAT-120-1 — Configure the 120-character policy

**Status:** Complete.

**Outcome:** EditorConfig defines 120 characters, markdownlint enables MD013 at 120, and Prettier excludes generated
Prisma output.

**Allowed edit surfaces:**

- `.editorconfig`
- `.markdownlint-cli2.jsonc`
- `.prettierignore`
- `odd/tasks/line-length-120.md`

**Checks:** Configuration readback and `git diff --check`.

**Planned commit:** `chore(format): configure 120-character line length`

**Evidence:** The three configuration files contain the intended values. A read-only formatter map found more than 100
affected files, no generated Prisma files, and 252 MD013 findings across 14 Markdown files. The user selected a
feature-branch commit chain for reviewability. Work-unit commit `b10faac`
(`chore(format): configure 120-character line length`) completed the task.

### [x] FORMAT-120-2 — Normalize Markdown files

**Status:** Complete.

**Outcome:** Project-owned Markdown files are formatted at 120 characters and satisfy MD013 without changing prose
meaning.

**Allowed edit surfaces:**

- repository-owned `*.md` and `*.mdx` files reported by Prettier or markdownlint
- `odd/tasks/line-length-120.md`

**Constraints:** Preserve content and heading/link/code semantics; do not reformat `.agents/**`. Long tables retain
their table structure; scoped MD013 directives cover only rows that cannot be physically wrapped without changing table
semantics.

**Checks:** Stable second Markdown format pass, markdownlint, and `git diff --check`.

**Planned commit:** `style(docs): format Markdown at 120 characters`

**Evidence:** Markdown-only Prettier formatting was applied to project-owned Markdown/MDX files and local task records;
the second pass is content-stable, `pnpm lint:md` reports zero issues, and no non-Markdown tracked files changed.
Independent verification found 30 narrowly table-scoped MD013 directives, stable Markdown tokens/headings/code
fences/tables, and no link/reference issues. Work-unit commit `91f6c4d`
(`style(docs): format Markdown at 120 characters`) completed the task.

### [x] FORMAT-120-3 — Normalize TypeScript and remaining supported files

**Status:** Complete.

**Outcome:** Project-owned TypeScript and other supported non-Markdown files are formatted at 120 characters without
behavior changes.

**Allowed edit surfaces:**

- exact non-Markdown files reported by the formatter map
- `odd/tasks/line-length-120.md`

**Constraints:** Do not modify `src/database/generated/**`, dependencies, or runtime behavior.

**Checks:** Stable full format pass, Prettier check, lint, tests, build, and `git diff --check`.

**Planned commit:** `style(format): apply 120-character formatting`

**Evidence:** Prettier formatted 57 TypeScript files with a stable second full-format pass. Independent verification
confirmed identical ASTs, comments, strings/templates, regex literals, type syntax, and control flow across all files.
Prettier, markdownlint, lint, 354 unit tests, build, 59 E2E tests, and `git diff --check` passed; generated Prisma
output remained unchanged. Work-unit commit `9352798` (`style(format): apply 120-character formatting`) completed the
task.

## Acceptance criteria

- [x] EditorConfig exposes a 120-character maximum line length.
- [x] MD013 is enabled with a 120-character line length.
- [x] Formatting is content-stable on a second pass.
- [x] No generated Prisma output is manually reformatted.
- [x] Functional verification remains green.

## Next step

Implementation is complete. Preserve the three formatting commits as the review boundary and await the next delivery
instruction.
