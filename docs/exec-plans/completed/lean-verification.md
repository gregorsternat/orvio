# Lean verification

## Objective and decisions

Keep the existing architecture, data and documentation guardrails while making
routine validation proportional to the change. Documentation and planning rules
remain unchanged. No product behavior or schema changes.

- Make `just verify` checks plus unit tests, without a browser, Next.js build or database.
- Run eight existing production browser journeys on desktop/mobile for application changes.
- Run database contracts for backend, schema, tooling and configuration changes.
- Preserve exhaustive verification as `just verify-full` and a manual CI run.
- Documentation-only changes check Markdown and local links and do not deploy.
  Later docs-only pushes do not cancel an application release already awaiting publication.
- Missing Git comparison information selects all automatic checks conservatively.

## Steps

1. Split setup/verification recipes and tag the existing smoke journeys.
2. Add a tested Git change selector and conditional, timed CI steps.
3. Update current command/coverage documentation without rewriting historical evidence.
4. Run focused selector checks, quick verification, smoke and exhaustive verification.
5. Record results and limits, then move this plan to completed.

## Acceptance and evidence

Smoke selects eight tests in two projects with no retries. Existing exhaustive
coverage stays available. Selection covers documentation, frontend, Rust,
migrations, lockfiles, deleted/renamed files and unavailable comparisons.
Both PR and push comparisons are tested with real temporary Git histories.

Reference CI run: `38070545462` took 17 minutes for verification, including
6.9 minutes of development journeys and 3.4 minutes of production journeys.
The target for a routine frontend CI run is under five minutes; this is a target,
not a measured result. Local checks cannot establish remote CI or deployment.

## Completed implementation and validation

Completed locally on 2026-10-11 (Asia/Shanghai), against `bc4da92`.

- `just verify` passed: checks, 115 TypeScript tests, 11 Node tests and Rust suites.
- Selector tests exercise documentation/frontend/backend/config changes, real PR
  merge-base divergence, push deletions/renames, missing commits and conservative
  fallback. CLI checks also verified GitHub output serialization and manual mode.
- Publication selection keeps a validated application release eligible when only
  documentation was added afterward; newer application changes, divergent branches
  and missing commits prevent that release. This closes the interaction between
  documentation-only deployment skips and the existing supersession check.
- `just test-smoke` passed 16 production executions in 18.0 seconds, excluding
  its preceding build. Listing the selection confirmed eight cases in two projects.
  An isolated config pointed the existing landing smoke at an unavailable local
  server: the real journey failed and Playwright exited 1 as expected.
- `just verify-full` passed PostgreSQL 18 contracts and 366 browser executions:
  175 development, 173 production, and six in each of the three failure states.
  Eight existing project/runtime exclusions remain intentional. The full browser
  passes took 2.7 minutes in development and 1.7 minutes in production locally.
- `just check-docs` and `git diff --check` passed. The installed actionlint reports
  only the pre-existing `concurrency.queue` key, reproduced against the baseline;
  validation with that exact unsupported-key diagnostic excluded passed.

Evidence: `.artifacts/lean-verification/{verify,smoke,full,docs,expected-failure}.log`,
plus `.artifacts/database/result.json` and the normal browser artifacts.
The expected-failure config and artifacts are ignored and are not part of the suite.

## Remaining limits

No remote CI run, commit, merge or deployment was performed. The reference run's
17-minute CI duration and these local timings are different environments; the
under-five-minute frontend CI target remains to be measured on the first remote
run. No API, schema, dependencies, lockfiles or product behavior changed.
Documentation/planning and visual-inspection obligations remain in force.
