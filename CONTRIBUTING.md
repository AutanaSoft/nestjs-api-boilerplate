# Contributing

Thank you for improving the NestJS API Boilerplate. Keep contributions focused, tested, and safe to review.

## Quick path

1. Create a branch from the default branch.
2. Install dependencies with `pnpm install`.
3. Make a focused change with tests and documentation when applicable.
4. Run the checks that cover your change, then open a pull request.

## Development workflow

```bash
pnpm install
cp .env.example .env
pnpm start:dev
```

Do not commit `.env` files, credentials, or private keys. Use `.env.example` only for non-sensitive configuration
examples.

## Checks

Run the relevant checks locally before submitting a pull request:

```bash
pnpm lint
pnpm lint:md
pnpm test
pnpm test:e2e
pnpm build
```

The pull request checks run formatting verification, linting, tests, and the production build.

## Pull requests

- Describe the problem and the resulting behavior.
- Keep each pull request limited to one reviewable change.
- Add or update tests for behavior changes.
- Update documentation and configuration examples when their user-facing contract changes.
- Use a Conventional Commit-style title with a non-empty scope, such as `fix(http): validate proxy hops`.

## Reporting issues

Use the GitHub issue forms for reproducible bugs and feature requests. Report security vulnerabilities privately as
explained in [SECURITY.md](SECURITY.md).
