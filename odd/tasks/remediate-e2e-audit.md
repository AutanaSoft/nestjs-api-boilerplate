# Remediate E2E audit

- [x] Consolidate scenario lifecycle behind the executor provided by the main E2E owner.
- [x] Pin every environment input that affects the baseline HTTP contract.
- [x] Cover malformed JSON through the real HTTP error boundary.
- [x] Cover replacement of non-canonical uppercase UUIDv4 request IDs.
- [x] Resolve the Vite path-alias migration warning with verified supported configuration.
- [x] Pin the unit-test runtime to `NODE_ENV=test` so importing `main.ts` cannot bootstrap the app.
- [x] Run complete formatting, linting, unit, E2E, process-lifecycle, and build verification.
