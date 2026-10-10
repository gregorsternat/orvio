# Working on Gradavia

This file is a map. Keep detailed rules and evidence in the linked documents.

## Read first

- [README](README.md): commands and current scope.
- [Architecture](ARCHITECTURE.md): boundaries and ownership.
- [Documentation index](docs/index.md): product, data, design, decisions.
- [Execution plans](docs/exec-plans/index.md): active work and known debt.
- [Quality status](docs/quality.md): what has actually been verified.
- [Repository workflow](docs/harness.md): guardrails, evidence and documentation upkeep.

## Implementation rules

- Code, comments, technical documentation, commits, and PRs are in English.
  Product copy is in French. Use scoped Conventional Commits.
- Deliver one complete, bounded feature. Do not add speculative tables, endpoints,
  authentication, or unrelated abstractions.
- Use the pinned pnpm and Cargo workspaces through `just`. Commit both lockfiles.
- Keep UI under `features/<feature>/ui`, pure feature logic under `domain`,
  and data access under `server`. Create layers when they have real content.
- Client components receive serializable data. Next.js calls the Rust API from
  server-only modules and never imports database clients or schema. The import
  checker follows aliases and re-exports.
- `gradavia-core` stays free of I/O. Adapters validate external input.
- Drizzle alone owns schema and migrations; SQLx consumes that schema.
- Follow the [data contract](docs/data-contract.md): preserve provenance,
  campaign, missing/suppressed values, and indicator definitions.
- Follow the [design system](docs/design-system.md): monochrome themes,
  keyboard access, reduced motion, and source-owned UI components.
- Record copied component provenance and local changes in
  [third-party sources](docs/third-party.md).

## Feedback loop

1. Inspect the affected code and current behavior.
2. Write or update an execution plan for work spanning multiple boundaries.
3. Make the smallest complete change and run focused checks.
4. Run `just verify` (checks/unit tests) and relevant focused tests before delivery.
   Use `just verify-full` for opt-in exhaustive validation. For UI changes, inspect
   the real browser at desktop and mobile widths and exercise relevant keyboard interactions.
5. Inspect the diff for accidental files, secrets, and stale documentation.
6. Report test results and limitations. Local success, remote CI, merge, and
   deployment are separate states.

Test meaningful behavior and invariants, not copies of the implementation.
Turn recurring review findings into a check when practical.

## Environments and diagnostics

- Development uses Neon; tests use disposable PostgreSQL 18.
- Keep credentials in the ignored root `.env.local`. Never log connection
  strings, environment dumps, credentials, or raw database driver errors.
- `just db-check` explicitly reaches the configured Neon branch. Builds and
  browser tests must work without live credentials or external dataset access.
- Each checkout has its own environment and artifacts. Set distinct `PORT`
  and `E2E_PORT` values when running concurrent instances.
- Keep failure logs, screenshots, and traces under `.artifacts`.
- Follow [development](docs/development.md) for migrations and cleanup.

Update the architecture, decisions, data definitions, and quality evidence when
behavior changes. Move completed plans out of the active directory and record
remaining work in [technical debt](docs/exec-plans/tech-debt.md).
