# NestJS E2E Practices

This skill guides agents to build and review real HTTP E2E suites for NestJS applications.
`SKILL.md` handles activation and task-time routing; the reference cards own normative guidance.

## Structure

- `SKILL.md` - Activation, workflow, How to Use navigation, verification, and output contract.
- `references/` - Detailed decision cards loaded on demand.
- `evals/` - Behavioral evaluation prompts and objective expectations.

## Reference Cards

- `references/e2e-orchestrate-execution-and-lifecycle.md` - Jest discovery, shared and isolated
  lifecycle ownership, explicit business-flow order, typed contexts, and teardown.
- `references/e2e-run-real-application-and-infrastructure.md` - Production-like bootstrap, real
  HTTP, isolated database, migrations, providers, and authentication.
- `references/e2e-build-data-and-assert-contracts.md` - HTTP-first fixtures, bounded justified
  seeds, canonical payloads, validation cases, and observable public contracts.
- `references/e2e-isolate-external-service-boundaries.md` - Controlled doubles only at justified
  out-of-process adapters.

## Maintenance

1. Keep `SKILL.md` concise and route decisions to cards.
2. Keep related variants together only when they share context, impact, and application criteria.
3. Split a card when a rule activates, fails, and can be evaluated independently.
4. Use official HTTPS sources and verify version-sensitive runner or framework behavior.
5. Update this inventory and the `How to Use` navigation when cards change.
6. Run the focused validator and `pnpm validate` before delivery.
