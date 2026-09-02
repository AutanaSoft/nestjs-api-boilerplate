# NestJS API Boilerplate

A public NestJS 12 template for building secure TypeScript APIs. It includes validated HTTP configuration, security
headers, CORS controls, and rate limiting so a new API starts with a practical baseline.

## Quick start

1. Use this repository as a template, then clone your new repository.
2. Install dependencies with pnpm.
3. Copy `.env.example` to `.env`, review its values, and start the API.

```bash
pnpm install
cp .env.example .env
pnpm start:dev
```

The API listens on `http://localhost:3000` by default. `GET /` returns `Hello World!`.

## Prerequisites

- Node.js 26 (the version used by CI)
- pnpm 11.25.0

Corepack can activate the package-manager version declared in `package.json`:

```bash
corepack enable
pnpm install
```

## Documentation

Use the focused references for architecture, API conventions, configuration, testing, and project policies.

| Topic                                  | Reference                                                   |
| -------------------------------------- | ----------------------------------------------------------- |
| Architecture overview                  | [Architecture overview](docs/architecture/overview.md)      |
| Project structure and module ownership | [Project structure](docs/architecture/project-structure.md) |
| Application configuration architecture | [Configuration](docs/architecture/configuration.md)         |
| Database and persistence architecture  | [Data access](docs/architecture/data-access.md)             |
| Authentication architecture            | [Authentication](docs/architecture/authentication.md)       |
| Authorization architecture             | [Authorization](docs/architecture/authorization.md)         |
| Request validation                     | [Validation](docs/architecture/validation.md)               |
| Response serialization                 | [Serialization](docs/architecture/serialization.md)         |
| Error handling                         | [Error handling](docs/architecture/error-handling.md)       |
| Observability                          | [Observability](docs/architecture/observability.md)         |
| REST API conventions                   | [API conventions](docs/api/conventions.md)                  |
| HTTP contracts                         | [HTTP contracts](docs/api/http-contracts.md)                |
| Cursor pagination                      | [Pagination](docs/api/pagination.md)                        |
| API versioning                         | [Versioning](docs/api/versioning.md)                        |
| OpenAPI                                | [OpenAPI](docs/api/openapi.md)                              |
| HTTP security configuration            | [HTTP security](docs/configuration/http-security.md)        |
| Testing conventions                    | [Testing](docs/testing/testing.md)                          |
| End-to-end testing                     | [E2E testing](docs/testing/e2e-testing.md)                  |
| Contribution workflow                  | [Contributing guide](CONTRIBUTING.md)                       |
| Vulnerability reporting                | [Security policy](SECURITY.md)                              |
| Community standards                    | [Code of conduct](CODE_OF_CONDUCT.md)                       |

## Available scripts

| Command           | Purpose                                 |
| ----------------- | --------------------------------------- |
| `pnpm start:dev`  | Start the API in watch mode.            |
| `pnpm start`      | Start the API.                          |
| `pnpm build`      | Build the production output in `dist/`. |
| `pnpm start:prod` | Run the compiled application.           |
| `pnpm lint`       | Lint source and test files.             |
| `pnpm lint:md`    | Lint Markdown files.                    |
| `pnpm test`       | Run unit tests.                         |
| `pnpm test:e2e`   | Run end-to-end tests.                   |
| `pnpm test:cov`   | Run unit tests with coverage.           |

## Quality checks

Before opening a pull request, run the focused checks for your changes. The complete local check sequence is:

```bash
pnpm lint
pnpm lint:md
pnpm test
pnpm test:e2e
pnpm build
```

GitHub Actions runs formatting verification, linting, tests, and the build on pushes and pull requests.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and
[SECURITY.md](SECURITY.md) for private vulnerability reporting.

## License

Copyright © 2026 AutanaSoft. Licensed under the [MIT License](LICENSE).
