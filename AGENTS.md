# AGENTS

Mandatory rules for any person or AI agent working in this repository while preserving its conventions.

If a rule in this file conflicts with an installed skill, this file prevails.

Read this file completely before making the first modification. Each section defines its scope and limits.

## Repository Context

- Consult `README.md` when the task requires project overview, prerequisites, or setup instructions.
- Consult the relevant documentation under `docs/` when the task requires additional context about architecture,
  conventions, or technical decisions. Do not read unrelated documentation by default.

## Architecture and Conventions

- Treat the relevant documents under `docs/architecture/` as normative for architectural decisions within their scope.
- Apply only the installed skill rules relevant to the task and consistent with the documented project architecture.
- For feature organization, module sharing, service responsibility, and persistence boundaries, apply:
  - `nestjs-best-practices/rules/arch-feature-modules.md`
  - `nestjs-best-practices/rules/arch-module-sharing.md`
  - `nestjs-best-practices/rules/arch-single-responsibility.md`
  - `nestjs-best-practices/rules/arch-use-repository-pattern.md`
- Do not introduce a framework, library, ORM, or architectural pattern that conflicts with a documented project decision.
- If the existing implementation conflicts with documented architecture, report the divergence before modifying either side.

## Code Style

- Follow `.editorconfig` for baseline file conventions. For files supported by Prettier, follow `.prettierrc`, which
  takes precedence for overlapping formatting options.
- For Markdown and MDX files, run Prettier before `markdownlint-cli2`. Generated or edited Markdown must satisfy
  `.markdownlint-cli2.jsonc`.
- Do not manually format generated files unless the project explicitly includes them in its formatting workflow.
- Respect the linter and static analysis configured by the project; do not introduce warnings.
- Do not disable formatting, linting, or type rules without a localized, documented justification.

## Communication

- Respond concisely and directly, using a neutral technical tone. Include enough detail to understand decisions, risks,
  and outcomes.
- Ask one blocking question at a time and wait for the response before continuing. When a workflow provides a grouped or
  atomic decision set, present it completely without splitting it.
- Report blockers, necessary assumptions, and any verification that was not performed. Do not present unverified work as
  complete.

## Commits and Pushes

- Do not create or generate commits without an explicit user request.
- Do not push without an explicit user request.
- When preparing a commit, use the `commit-message` skill if it is available.

## Comments and Documentation

- Document exported APIs when their contract, responsibility, constraints, side effects, or expected usage are not evident
  from the type signature and name.
- Prefer JSDoc for exported classes, functions, types, interfaces, constants, or provider tokens when additional contract
  information is required.
- Do not add documentation that only repeats names, types, parameters, or implementation details already evident from the
  code.
- Internal helpers and straightforward private methods normally do not require documentation.
- Add inline comments only when they explain intent, architectural reasoning, non-obvious behavior, compatibility
  constraints, security requirements, or implementation limitations.
- Keep documentation close to the code or architectural boundary that owns the documented behavior.
- Update documentation when a change modifies a documented public contract or architectural decision.
- Do not keep commented-out code; Git history preserves prior versions.

## Planning and Verification

- Before a non-trivial change or when scope is ambiguous, present a plan with the scope, affected files, and steps, then
  wait for developer approval. An explicit request to implement a clearly scoped change counts as approval. Read-only
  operations and approved mechanical changes do not require an additional plan.
- Before starting an RDD review, prepare the intended commit files and run the project's configured `lint-staged`
  workflow, including all source-mutating formatters and linters normally executed by the pre-commit hook. Start the
  review only after rerunning that workflow produces no further changes. After the review starts, the actual pre-commit
  hook must be a no-op for file content and modes; any mutation invalidates the review and requires a new candidate.
- Do not invent APIs, conventions, or behaviors. Verify against official documentation, cite the URL and version, or ask
  the developer. Memory and "probably" are not evidence.
- Do not modify files outside the agreed scope without reporting the reason.
- If the user questions a technical claim, verify it before accepting or rejecting it.

## User Changes

- Treat any difference between generated code and the repository's current state as intentional.
- Do not revert, rewrite, or correct those changes without explicit confirmation.
- If you identify a potential issue, provide verifiable evidence - URL, line, or diff - and request confirmation before
  changing it.
- If the user explicitly requests reverting or adjusting a change, proceed within the stated scope.
