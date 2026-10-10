set dotenv-load := true
set dotenv-filename := ".env.local"

default:
    @just --list

# Install locked dependencies without downloading a browser.
setup: setup-js
    cargo fetch --locked

setup-js:
    pnpm install --frozen-lockfile

# Install Chromium explicitly when running browser checks.
setup-browser:
    pnpm exec playwright install chromium

# Inspect prerequisites without connecting to external services.
doctor:
    node scripts/doctor.mjs
    cargo run --locked -q -p gradavia-aggregator -- doctor

# Manual raw ingestion; run sources, sync, status, or replay --manifest <path>.
[positional-arguments]
ingest *args:
    cargo run --release --locked -q -p gradavia-aggregator -- "$@"

# Refresh Rust resolution after an intentional dependency change.
lock-rust:
    cargo generate-lockfile

# Focused Rust checks, including HTTP/archive tests without live services.
check-ingest:
    cargo fmt --all -- --check
    cargo clippy --workspace --all-targets --locked -- -D warnings
    cargo test --workspace --locked

[positional-arguments]
test-ingest *args:
    cargo test --locked -p gradavia-aggregator "$@"

# Start the Rust API and website; only the API receives database credentials.
dev:
    cargo build --locked -p gradavia-api
    pnpm exec tsx scripts/dev.ts

# Run each service independently when needed.
api:
    cargo run --locked -p gradavia-api

dev-web:
    env -u DATABASE_URL -u DATABASE_URL_UNPOOLED -u GRADAVIA_API_DATABASE_URL -u GRADAVIA_DATA_ENV_FILE -u TEST_DATABASE_URL -u GRADAVIA_TEST_DATABASE_URL -u ORVIO_TEST_DATABASE_URL pnpm dev

# Fast checks; these are the same commands used in CI.
check:
    pnpm format:check
    pnpm lint
    pnpm typecheck
    pnpm check:architecture
    pnpm check:docs
    cargo fmt --all -- --check
    cargo clippy --workspace --all-targets --locked -- -D warnings

# Documentation-only validation needs neither Rust nor a browser/database.
check-docs:
    pnpm exec prettier --check '**/*.md'
    pnpm check:docs

test-unit:
    pnpm test:unit
    cargo test --workspace --locked

test-db:
    cargo build --locked -p gradavia-api
    pnpm test:db

# Focused browser checks against the same disposable harness as the full suite.
[positional-arguments]
test-browser *args:
    pnpm exec playwright test "$@"

# Serve disposable fixture data for manual browser inspection; stop with Ctrl-C.
test-browser-server:
    pnpm exec tsx scripts/e2e-server.ts

test-e2e: build
    pnpm test:e2e
    E2E_PRODUCTION=1 pnpm test:e2e
    E2E_PRODUCTION=1 E2E_STATE=unconfigured pnpm test:e2e
    E2E_PRODUCTION=1 E2E_STATE=empty pnpm test:e2e
    E2E_PRODUCTION=1 E2E_STATE=unavailable pnpm test:e2e

# Eight existing journeys in production, on desktop and mobile.
test-smoke: build
    env -u E2E_STATE E2E_PRODUCTION=1 pnpm test:e2e --grep @smoke

# Full test suite, including disposable PostgreSQL and browser tests.
test: test-unit test-db test-e2e

# Verify that build steps never need live database credentials.
build:
    env -u DATABASE_URL -u DATABASE_URL_UNPOOLED -u GRADAVIA_API_DATABASE_URL -u GRADAVIA_DATA_ENV_FILE -u GRADAVIA_API_URL pnpm build
    cargo build --workspace --locked

# Read-only checks against the explicitly configured development database.
db-check:
    pnpm db:check
    cargo run --locked -q -p gradavia-aggregator -- doctor --database

db-generate:
    pnpm db:generate

db-migrate:
    pnpm db:migrate

format:
    pnpm format
    cargo fmt --all

# Daily feedback: no Next.js build, browser or database.
verify: check test-unit

# Opt-in exhaustive validation; preserves the original verification chain.
verify-full: check test

# Build the Cloudflare website without database credentials or a live API.
cf-build:
    env -u DATABASE_URL -u DATABASE_URL_UNPOOLED -u GRADAVIA_API_DATABASE_URL -u GRADAVIA_API_URL -u GRADAVIA_DATA_ENV_FILE pnpm --filter @gradavia/web cf:build

# Validate both Worker bundles without publishing them.
cf-check: cf-build
    env -u DATABASE_URL -u DATABASE_URL_UNPOOLED -u GRADAVIA_API_DATABASE_URL pnpm --filter @gradavia/web cf:dry-run
    env -u DATABASE_URL -u DATABASE_URL_UNPOOLED -u GRADAVIA_API_DATABASE_URL pnpm --filter @gradavia/api-worker cf:dry-run

# Build the Linux image used by Cloudflare Containers; no secrets enter its context.
cf-api-image:
    docker build --platform linux/amd64 --file Dockerfile.api --tag gradavia-api:local .

# Upload the private API first; requires Workers Paid and Wrangler authentication.
cf-api-secret:
    node scripts/cloudflare-api-secret.mjs

[positional-arguments]
provision-api-reader *args:
    pnpm exec tsx scripts/provision-api-reader.ts "$@"

cf-api-deploy:
    env -u DATABASE_URL -u DATABASE_URL_UNPOOLED -u GRADAVIA_API_DATABASE_URL pnpm --filter @gradavia/api-worker cf:deploy

# Publish the built website and its custom domains after the API is ready.
cf-web-publish:
    env -u DATABASE_URL -u DATABASE_URL_UNPOOLED -u GRADAVIA_API_DATABASE_URL -u GRADAVIA_API_URL pnpm --filter @gradavia/web cf:deploy

cf-web-deploy: cf-build cf-web-publish

# Verify the public Cloudflare-to-database path without database credentials.
cf-smoke:
    node scripts/cloudflare-smoke.mjs
