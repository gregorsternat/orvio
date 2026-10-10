# Repository workflow and maintenance

Gradavia uses a short [AGENTS.md](../AGENTS.md) as its map. The repository holds
the contracts, decisions and evidence needed to work without recovering earlier
chat history. This adapts the knowledge organization and feedback principles in
[Harness engineering](https://openai.com/index/harness-engineering/); it does not
adopt every workflow or autonomy policy described in that article.

## Find the authoritative context

| Question                                             | Read first                                                                         | Check against                                                                        |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| What is the product and what is deliberately absent? | [Product](product.md), [feature coverage](feature-coverage.md)                     | `apps/web/src/app`, the relevant feature and its browser journeys                    |
| Where does a change belong?                          | [Architecture](../ARCHITECTURE.md), [decisions](decisions.md)                      | Feature imports, `crates/api`, `crates/core`, `packages/db/src/schema.ts`            |
| What does a number mean?                             | [Data contract](data-contract.md), [analysis methodology](analysis-methodology.md) | Source adapters, validators, SQL, fixtures and retained source provenance            |
| How do I run or diagnose it?                         | [Development](development.md), [API](api.md), [ingestion](ingestion.md)            | `justfile`, environment variable names, runtime scripts and health/data responses    |
| How does production receive changes?                 | [Deployment](deployment.md)                                                        | `.github/workflows/ci.yml`, both Wrangler configurations and exact workflow steps    |
| What is actually verified?                           | [Quality](quality.md)                                                              | Dated local results, CI artifacts and public smoke results for the relevant revision |
| What should be done next?                            | [Plans](exec-plans/index.md), [debt](exec-plans/tech-debt.md)                      | The owner's current request; deferred ideas are not a scheduled roadmap              |

Read the relevant local `AGENTS.md` before changing a subtree. For Next.js code,
`apps/web/AGENTS.md` points to the documentation bundled with the installed version.
Use manifests and lockfiles for dependency versions rather than duplicating a
version inventory in prose.

## Feedback loop

1. Inspect the exact checkout, working changes, affected implementation and tests.
   Establish whether the request is a new behavior, a regression or a doc correction.
2. For work across boundaries, add an execution plan with scope, decisions,
   steps and observable acceptance criteria. Small corrections need no extra plan.
3. Implement the smallest complete change. Run focused checks while iterating;
   retain useful failure traces and avoid testing copies of the implementation.
4. Run `mise exec -- just verify` (checks and unit tests) before delivery, plus
   focused tests of the affected behavior. UI changes also require real
   desktop/mobile inspection and relevant keyboard interactions. For hosting
   changes, use the separate Cloudflare checks in the deployment guide.
5. Review the diff, update affected contracts and evidence, then move completed
   plans to `completed/`. Give unresolved work an explicit limit or debt trigger.
   Report local validation, remote CI and release outcomes separately.

The product has no fixed priority order or committed feature roadmap as of
2026-10-07. The owner chooses the next bounded task when working on it.
Do not turn a feasibility suggestion into an active plan without that direction.

## What the guardrails enforce

- `just check`: formatting, lint, types, TypeScript runtime import boundaries,
  pure Rust dependency allowlist, documentation structure and Rust Clippy.
- `just test-unit`: TypeScript, Node guardrail/runtime and Rust suites.
- `just test-db`: actual migrations and HTTP/database behavior with disposable
  PostgreSQL 18, including source publication and reader permissions.
- `just test-e2e`: credential-free builds, development/production Chromium
  journeys and the three production data-failure states. Retries are zero.
- `just verify`: `check` and `test-unit`, without Next.js builds, browsers or databases.
- `just test-smoke`: a credential-free build and eight `@smoke` production journeys
  on desktop/mobile (16 executions, zero retries), using the real API and disposable PostgreSQL.
- `just verify-full`: `check` and the complete `test` chain above, on demand.
  Install Chromium with `just setup-browser`; Docker supplies disposable PostgreSQL.
- `just check-docs`: Markdown formatting and local documentation links only.
  `just setup-js` installs its dependencies without Rust or Chromium.
- `just cf-check`: OpenNext build and Worker dry runs, including the API image;
  `just cf-api-image` explicitly builds the Linux image. These do not publish.
- `just db-check`: read-only connectivity to the explicitly configured Neon
  target. It is separate from offline validation and does not prove dataset availability.

The documentation checker verifies required entry points, existing local link
targets, top-level index membership and AGENTS length. It does not validate link
fragments, external pages, prose accuracy, freshness dates or every nested index.
Architecture checks do not prove all feature-layer purity or statistical correctness.

## CI selection

`Verify repository` remains the validation job for pull requests and main pushes.
Checks, unit tests, database contracts, build and smoke have separate timed steps.
The selector compares the PR head with its merge base against the event's base SHA;
main pushes compare the event's exact before/after SHAs. Renames include both old
and new paths. Missing commits/events, invalid comparisons, empty diffs and unknown
events select all automatic checks, never a successful skip.

- Documentation-only means Markdown at the root, under `docs/` or `.github/`,
  or an `AGENTS.md`. Run `just check-docs`; skip the build, browsers and deployment.
- Ordinary `apps/web/src/`, `apps/web/public/` and `tests/browser/*.spec.ts` changes
  run `just verify`, a credential-free build and production `@smoke` tests.
- Other paths also run `just test-db`: Rust, schema/migrations, API Worker,
  scripts/fixtures, manifests, lockfiles, workflows and build/test configuration.
  Unknown paths conservatively receive these checks too.

The smoke covers landing search, responsive/keyboard navigation, formation detail
and missingness, persisted favorites, shareable same-campaign comparison,
workspace drafts/history, failed-panel recovery, and robots/sitemaps.
Other journeys remain in the exhaustive suite and can be selected locally.

The manual **CI → Run workflow** action runs `just verify-full` and never deploys.
There is no scheduled exhaustive run. Main application pushes use the same
selective validation before the existing Cloudflare release checks and public smoke.
Later documentation-only main commits do not cancel an application release already
waiting to publish; later application commits still supersede it.
Browser harnesses own their disposable databases/containers; documentation-only
runs do not start PostgreSQL. CI retains failure artifacts for seven days.

## Prevent documentation drift

Update the document that owns the changed contract; link to it instead of copying
its rules. Keep the README and AGENTS short. Mark superseded decisions explicitly
and preserve the rationale. Summarize current verification in `quality.md`; keep
historical observations in its linked archive with their original scope.

Before closing a change, check route/command examples, environment assumptions,
feature limits, plan status and copied-component provenance. When a recurring
finding is mechanically testable, add a focused guardrail as part of the relevant
implementation. Semantic review remains necessary even when every link resolves.

The checked-in workflow runs on pull requests and main pushes. There is no
scheduled documentation gardener, automatic merge workflow, production alerting
policy or scheduled ingestion in this repository. Logs, smoke tests and manual
maintenance are the current tools; [operational debt](exec-plans/tech-debt.md)
records the remaining needs.
