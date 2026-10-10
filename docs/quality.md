# Verification status

Verification workflow reviewed on 2026-10-11 (Asia/Shanghai), with local
validation against `bc4da92`. Earlier evidence below retains its own tested revisions.
This page summarizes coverage and outstanding limits. Detailed past results live
in the [historical verification log](quality/history-through-2026-10-07.md).
A checked-in implementation, a local pass, remote CI, publication and production
health are separate observations; none establishes Google indexing or freshness.

## Current coverage

The current validation commands separate daily checks (`just verify`) from
production smoke (`just test-smoke`) and opt-in exhaustive verification
(`just verify-full`). Historical `just verify` results below refer to the old
exhaustive command, not the current fast command. See [CI selection](harness.md#ci-selection).

| Area                      | Executable evidence                                                                                                                      | Remaining limit                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Architecture              | Import graph and Cargo dependency checks in `just check`; regression cases under `scripts/tests`                                         | Does not prove all side effects or statistical semantics                                                       |
| Documentation             | Required entry points, local link targets, top-level document indexing and the 110-line AGENTS limit in `scripts/check-docs.mjs`         | No anchor, external-link, semantic freshness or full nested-index validation                                   |
| Domain and HTTP contracts | TypeScript/Rust unit tests and `just test-db` against real Drizzle migrations and the Rust binary on disposable PostgreSQL 18            | Synthetic records establish behavior, not current official source coverage                                     |
| Browser journeys          | Eight production smoke journeys on desktop/mobile in automatic CI; development/production and three failure states in `just verify-full` | Safari, Firefox and manual screen-reader coverage remain UI-001                                                |
| Search discovery          | Metadata, crawler HTML, no-JavaScript formation navigation, sitemaps and unavailable-source cases                                        | Search Console ownership, processing and search-performance evidence remain SEO-001                            |
| Cloudflare delivery       | OpenNext build, Worker dry runs and image build; main-only deployment after verification; public data smoke                              | Neither verification command runs `just cf-check` or the public smoke; publication can precede a failing smoke |
| Ingestion and provenance  | Archive/replay, source-shape, transaction and concurrency checks                                                                         | Imports are manual; live source/schema drift and remote archive backup need separate checks                    |
| UI and local preparation  | Browser tests cover navigation, hydration readiness, chart equivalents, lists, sharing and storage failures                              | Historical visual review is scoped to the recorded change, not a fresh audit of every screen                   |

See [repository workflow](harness.md) for commands and maintenance rules,
[development](development.md) for isolation, and [technical debt](exec-plans/tech-debt.md)
for follow-up triggers.

## Lean verification validation (2026-10-11)

On the local diff against `bc4da92`, `just verify` passed checks, 115 TypeScript
cases, 11 Node cases and the Rust suites. `just test-smoke` passed all eight
selected journeys on desktop/mobile (16 executions in 18.0 seconds, excluding
build time). An intentional unavailable-server run of the existing landing smoke
failed with exit code 1, confirming that the selection does not hide failures.

`CI=true E2E_PORT=3592 mise exec -- just verify-full` passed the checks/unit suites,
PostgreSQL 18 contracts and 366 browser executions: 175 development, 173 production,
and six for each of unconfigured, empty and unavailable. Eight existing exclusions
remain intentional. The development/production browser passes took 2.7/1.7 minutes
on this machine. `just check-docs`, selector/CLI checks and `git diff --check` passed.
The installed actionlint passes after excluding its unsupported pre-existing
`concurrency.queue` diagnostic, also reproduced on the unchanged baseline workflow.

Evidence: `.artifacts/lean-verification/` and the [completed plan](exec-plans/completed/lean-verification.md).
The reference GitHub verification took 17 minutes; local timings do not establish
CI speed. No remote run or deployment was performed. The target of under five
minutes for ordinary frontend CI remains unmeasured.

## Evidence at this refresh

The updated base includes the SEO foundation, shared G mark, palette input focus
correction, browser-readiness fixes, removal of the sidebar BÊTA badge and the
chart-tooltip semantic-color correction. Source and local history establish these
changes through `cac11ff`; production state is recorded separately below.

The archived 2026-10-07 landing-readiness and branding checks record full local
verification with 131 development, 129 production and 18 data-state browser
executions passing, with eight intended exclusions. Those counts belong to
those runs; they are not a result for this documentation change.

At the initial read-only GitHub inspection, main
[run 37628801351](https://github.com/gregorsternat/gradavia/actions/runs/37628801351)
for `9f99df9` was still running. A run's successful verification alone is not
proof that the publish and smoke steps executed; inspect those exact steps when
reporting release state. The preceding completed
[run 37610391926](https://github.com/gregorsternat/gradavia/actions/runs/37610391926)
at `7d2bcd5` was checked directly: verification, current-main selection, API/web
publication and public data smoke all succeeded. This establishes that release's
outcome, not the current runtime health or publication of subsequent commits.
No live Neon inventory or production data refresh was performed for this update.

### Documentation refresh validation

On 2026-10-07, `WRANGLER_SEND_METRICS=false CI=true E2E_PORT=3528 mise exec -- just verify`
passed in worktree `862e` for the documentation diff on `9f99df9`: formatting,
lint, types, architecture/docs, Clippy, 104 TypeScript cases, Node/Rust suites,
disposable PostgreSQL 18 contracts and credential-free builds. Chromium passed
131 development, 129 production and six cases in each of the three production
data states (278 executions, eight intended exclusions).

The updated base also contains the chart-tooltip correction from `cac11ff`; its
original verification record is preserved in the [historical log](quality/history-through-2026-10-07.md#chart-tooltip-contrast-2026-10-07).

Evidence: `.artifacts/docs-refresh/verify.log`. Final documentation formatting,
local links/fragments and `git diff --check` passed. The historical log was checked
against the original: only its introduction and relocated relative links changed.
The documentation refresh introduced no application, workflow or lockfile
changes. The incoming base includes the separately reviewed chart-tooltip fix.
After integrating the `cac11ff` base, `mise exec -- just check` passed and
`E2E_PORT=3534 mise exec -- just test-browser tests/browser/observatory.spec.ts tests/browser/formations.spec.ts`
passed all 34 development Chromium cases, covering overview charts and formation
history in desktop/mobile. This was a focused post-merge check; the main workflow
for `cac11ff` was still running when last inspected. No new manual visual review,
Cloudflare build or deployment was performed for the documentation-only change. See the [completed plan](exec-plans/completed/documentation-refresh.md).

## Navigation simplification validation

On 2026-10-07 (Asia/Shanghai), the navigation diff against `6f14ab0` passed
`WRANGLER_SEND_METRICS=false CI=true E2E_PORT=3544 mise exec -- just verify`:
110 TypeScript tests, Node/Rust suites, disposable PostgreSQL 18 contracts,
credential-free builds, and 290 Chromium executions (137 development, 135
production and 18 production data-state cases; eight intended exclusions).

Real-browser inspection covered desktop/mobile, light/dark, keyboard section and
palette navigation, the mobile menu, favorites/comparison counts and the grouped
screens using synthetic fixtures. Earlier failures exposed missing palette aliases,
active-link prefetch interference with campaign metadata and a premature reload
in a new test; the final run passes after those repairs. Details, evidence paths
and remaining browser/source boundaries are in the
[completed plan](exec-plans/completed/navigation-simplification.md).
No live dataset audit, remote CI result, merge or deployment is established by
these local checks.

On 2026-10-08 (Asia/Shanghai), the PR review follow-up diff against `3f0a2fc`
passed the same full `just verify` command: 115 TypeScript cases and the same
290 Chromium executions, with eight intended exclusions. Regression tests
first reproduced the five missing palette aliases and the inactive List
location actions, then passed after their correction. Real-browser desktop/mobile
inspection confirmed the List/Map action visibility and all five palette queries,
including Ctrl+K and Escape. Evidence: `.artifacts/navigation-review/verify.log`
and the follow-up section of the completed plan above. No live data audit or
deployment was performed.

## Arc copy-button validation

On 2026-10-09 (Asia/Shanghai), the Arc integration diff against `d8acc7a` passed
`WRANGLER_SEND_METRICS=false CI=true E2E_PORT=3566 mise exec -- just verify`:
formatting, lint, types, architecture/docs, Clippy, 115 TypeScript cases, Node/Rust
suites, disposable PostgreSQL 18 contracts and credential-free builds. Chromium
passed 139 development, 137 production and six cases in each of the three
production data states (294 executions, eight intended exclusions).

Clipboard journeys verify keyboard activation, URL/hash changes, source-version
preservation, note-sharing consent, stable button width and persistent manual
recovery after a denied clipboard write. Real-browser review covered light/dark,
390/768/1024/1440 widths, 44px copy targets and no horizontal page overflow.
Reduced-motion and both-theme accessibility journeys remain passing. Arc source,
MIT notices and integration patches are recorded in [third-party sources](third-party.md).
No dependency versions or lockfiles changed.

Evidence and initial corrected failures are recorded in the
[completed plan](exec-plans/completed/arc-copy-buttons.md), with the final log at
`.artifacts/arc-copy/verify.log`. These local fixture checks do not establish
remote CI, merge, deployment or live data availability. Existing UI-001 limits
remain in [technical debt](exec-plans/tech-debt.md).

### PR #32 merge repair

On 2026-10-09 (Asia/Shanghai), merging `main` at `53d135f` into `66abf68`
retained Arc clipboard actions and the workspace's scoped navigation/hash.
Explicit share paths now use the existing canonical workspace URL conversion.
`mise exec -- just check` passed. A focused development Chromium run at
`E2E_PORT=3574` passed 14 desktop/mobile executions covering clipboard keyboard
activation/recovery, source versions, note consent, History and shared-list retry.
Desktop analysis and mobile copy-error screenshots were inspected. The first run
failed both evolution cases on the missing `onglet` parameter; the canonical URL
fix passes the same checks. Logs: `.artifacts/pr32-conflicts/focused.log` and
`final-focused.log`. The full suite and production browser runs were not repeated
for this conflict repair; remote CI and deployment remain separate.

### PR #32 CI clock repair

The [CI run for `5727b50`](https://github.com/gregorsternat/gradavia/actions/runs/37899976219)
failed the desktop clipboard-recovery case: feedback returned to `idle`.
The test installed Playwright's clock after creating native feedback timers;
a local Chromium reproduction confirmed that clearing such a timer after clock
installation did not cancel it. The test now installs the clock before navigation,
following the [Clock API ordering requirement](https://playwright.dev/docs/clock).

On 2026-10-09 (Asia/Shanghai), the corrected case passed five repetitions per
desktop/mobile project in both development and production (20 executions total,
no retries). `mise exec -- just build`, focused ESLint/formatting and documentation
checks passed. Evidence: `.artifacts/pr32-ci/{github-failure,focused-development,focused-production,build}.log`.
This is focused local validation; the full CI result remains separate.

### PR #32 stale clipboard completion follow-up

The [CI run for `c5c21d7`](https://github.com/gregorsternat/gradavia/actions/runs/37905115181)
failed the desktop development copy-recovery case: after a rejected clipboard
write, feedback remained `idle`. The hook now ignores clipboard completions and
feedback timers from older copy operations. A browser regression defers one
successful write, starts a newer rejected write, then resolves the old write and
checks that the error remains visible. The focused Chromium case passed five
repetitions per desktop/mobile project (10 executions). Type, lint, formatting
and documentation checks passed locally. Evidence:
`.artifacts/pr32-ci/copy-race-retry-dev/`. The next remote CI run remains the
merge gate.

The next [CI run](https://github.com/gregorsternat/gradavia/actions/runs/37908000074)
passed 174 browser cases but failed a newly added mobile assertion that waited
for `data-copy-state="copied"` after the Space-key clipboard write. The clipboard
content and keyboard activation succeeded; the earlier Enter assertion already
checks visible copied feedback. Removed the redundant state assertion while
retaining the stale-write regression and keyboard clipboard check.

## GitHub repository link validation (2026-10-08)

On 2026-10-08 (Asia/Shanghai), `CI=true E2E_PORT=3542 mise exec -- just verify`
completed successfully with the repository-link diff on base `d8acc7a`: formatting, lint, types,
architecture/docs, Clippy, 115 TypeScript cases, Node/Rust suites, disposable
PostgreSQL 18 contracts and credential-free builds. Chromium passed 137 development,
135 production and six cases in each production data state (290 executions,
eight intended exclusions). Unrelated workspace-navigation changes were introduced
concurrently in this checkout after the checks/build began; this run does not
establish validation of their latest state. An initial typecheck rejected a Lucide
brand-icon import; the final implementation uses the source-owned Octicons SVG instead.
The web TypeScript check was repeated after those concurrent edits and passed;
evidence: `.artifacts/github-link/final-types.log`.

Real-browser inspection covered the homepage footer and expanded/collapsed
application sidebar at 1280×900, the mobile navigation at 390×844 and the homepage
footer at 320×740, in light/dark themes. The repository link has visible keyboard
focus, a French accessible name, a 40px target, the expected repository URL and
`target="_blank"` with `noopener noreferrer`. The narrow homepage had no horizontal
overflow. Evidence: `.artifacts/github-link/verify.log`, `desktop-page.jpg`,
`desktop-footer.jpg` and `mobile-footer.jpg` in the same directory.

The authenticated GitHub inspection found the destination private; the owner plans
to make it public. Anonymous access and publication of this diff remain unverified.
No deployment was performed.

## Persistent workspace validation (2026-10-08)

`CI=true E2E_PORT=3540 mise exec -- just verify` passed for the local workspace
navigation diff on `e0ce3a3`, based on merged PR #29: formatting, lint, types,
architecture/docs, Clippy, 115 TypeScript tests, Node/Rust suites, real disposable
PostgreSQL 18 contracts and credential-free builds. Chromium passed 165 development,
163 production and six cases in each of three production data states: 346
executions with eight intended exclusions.

The suite checks all workspace panel pairs, preserved state and map camera,
History traversal, deep links, legacy parameters/fragments, SSR without JavaScript,
SEO, keyboard access, request reuse, stale responses and failure recovery. Network
inspection confirms that Budget JavaScript is downloaded on first activation,
not with the initial Favoris page. The initial run after separating tool bundles
exposed ten readiness failures; these were fixed and the focused fourteen-case
follow-up and final full run passed. This final result supersedes those failed
attempts for the final code, without treating the earlier attempts as passes.

Real Chromium inspection covered desktop territories and mobile quiz/analysis,
scrollable tab bars, visible keyboard focus and activation. Evidence lives under
`.artifacts/workspace-tabs`: `verify.log`, `readiness.log`, `code-loading.log`,
`verification-notes.md`, `desktop-territoires.png`, `mobile-estimer.png` and
`mobile-analyse.png`. See the [completed plan](exec-plans/completed/persistent-workspaces.md)
for implementation scope. No production data, remote CI or publication was verified
by this work; Safari/Firefox and manual screen-reader limits remain UI-001.

## Workspace review corrections (2026-10-09)

`CI=true E2E_PORT=3540 mise exec -- just verify` passed for the local diff on
`8aeef8b`: code/documentation checks, 115 TypeScript tests, Node/Rust suites,
disposable PostgreSQL 18 contracts and credential-free production build. Chromium
passed 171 development, 169 production and 18 production data-state executions
(358 total, eight intended exclusions).

New browser tests reproduce and cover inactive print styles, shared-list retry
recovery without losing another panel's draft, and campaign changes during a
pending read followed by List/Map navigation. All six new executions failed before
the fixes and pass afterward. Desktop/mobile Chromium print screenshots were
visually inspected. Existing keyboard and workspace tests now await observable
client readiness when testing History navigation; native no-JavaScript journeys
remain separate.

Evidence: `.artifacts/workspace-review/verify.log`, targeted logs and print images
under `focused-results`. Earlier failures and their resolution are documented in
the [completed plan](exec-plans/completed/persistent-workspaces.md#pr-31-review-follow-up)
and retained alongside the final log. This is local validation; remote CI and
publication are not established by it.

## Reading and adding evidence

- Keep this page a current summary. Put detailed investigations and historical
  run narratives in linked files under `docs/quality/` or a completed plan.
- Record the date/timezone, tested revision or local diff, environment, command,
  result, exclusions and evidence location. Never replace a failed run with an
  undifferentiated later success.
- `.artifacts/` is ignored and local to a checkout; CI artifacts expire after
  seven days. A path records where evidence was produced, not durable access.
  Preserve the useful conclusion and public run link in versioned documentation.
- Dataset totals must name the source release/campaign and observation context.
  Old totals are not assertions about the current configured Neon branch.
- Use the [historical log](quality/history-through-2026-10-07.md) for foundation,
  ingestion, observatory, deployment, expanded exploration, SEO and UI evidence.
  Recheck the relevant path before promoting historical evidence to current status.

### PR #31 CI follow-up (2026-10-09)

[CI run 37806978985](https://github.com/gregorsternat/gradavia/actions/runs/37806978985)
failed three development browser executions on `8f08c19`: rapid comparison
removals on both widths and theme restoration on desktop. Controlled delayed
responses and JavaScript downloads reproduced both causes before the fixes.
Current comparison IDs now govern retained content and subsequent actions;
theme controls wait for client readiness. Eight focused executions passed after
the corrections, including keyboard operation.

The full local `CI=true E2E_PORT=3540 mise exec -- just verify` then passed:
formatting, lint, types, architecture/docs, Clippy, 115 TypeScript tests,
Node/Rust suites, disposable PostgreSQL 18 contracts and credential-free build.
Chromium passed 173 development, 171 production and 18 data-state executions
(362 total, eight intended exclusions). Evidence: `.artifacts/ci-workspace/verify.log`;
regression failures, focused results and desktop/mobile visual inspection are
retained in the same directory. A preliminary formatting check caught generated
CLI snapshots outside the ignored artifact directory; they were moved before the
successful full run. Remote CI and publication are not established by this local pass.
