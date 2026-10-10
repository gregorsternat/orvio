# Cloudflare deployment

## Runtime boundary

The deployment uses two Workers in account
`aa772cd6962f92be034156b7855f6d62`:

- `gradavia-web` serves the official Next.js build through the OpenNext adapter.
  It receives only a private service binding to `gradavia-api`.
- `gradavia-api` starts the existing Rust binary in a Cloudflare Container. Its
  `DATABASE_URL` secret is passed to that container at runtime. It has no public
  Workers URL or custom domain.

`gradavia.com` is the canonical website. `www.gradavia.com` redirects to the apex
while retaining the path and query. Cloudflare manages the custom-domain DNS and
TLS certificates. The zone is `ecced0ef0eb47a53c3377130ff87820e`.

The container connects to Neon over TLS using a pooled URL and a dedicated reader
role. Next.js does not import a database client or receive database credentials.
Ingestion and Drizzle migrations remain explicitly operated outside Cloudflare.
The API's bounded SQLx pool and immutable-release caches are unchanged.

The web entrypoint performs the canonical redirect before OpenNext parses query
parameters, preserving encoded search values and repeated keys. `keep_names` is
disabled to keep the theme library's serialized browser script self-contained.
Both Workers use compatibility date `2026-10-01`, supported by the pinned local
workerd runtime. Recheck local preview when changing the adapter or date.
Service-binding requests use `redirect: "manual"` and reject every 3xx response.
Workers rejects the Node-compatible `redirect: "error"` option during Request
construction. Failure logs contain only a fixed stage and an allowlisted error
class, never the upstream body, URL, credentials or raw exception message.

## Account prerequisite

Cloudflare Containers requires Workers Paid. The account was upgraded by its
owner on 2026-10-05, and access was verified before deployment. Configuration in
this repository does not activate a subscription.

The [Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/)
describes the account subscription, included usage and additional resource usage.
An initial maximum of one instance and idle shutdown limit resource concurrency;
they are not a monetary spending cap. Review measured traffic before increasing
the instance count.

## Production database

The following inventory was verified at initial provisioning on 2026-10-05. It
is a recovery reference, not a live inventory or a default for every checkout.
Recheck the branch, endpoint and role before a production operation; independent
worktrees do not inherit the provisioning checkout's environment or archives.

Production was provisioned in Neon project `morning-firefly-45046041`, branch
`gradavia-production` (`br-mute-flower-b1nbhbx7`), endpoint
`ep-soft-surf-b1o2bgoj`. Compute is fixed at 0.25 CU and suspends after 300 seconds
of inactivity. It was cloned from the populated `development` branch; the
original development and empty default `production` root were preserved.

The initial copy contained 14 registered datasets, 13 published releases and
199,655 raw records. Release pointers, fingerprints, campaigns and counts match
the source branch. Cartography has no published release; its copied ingestion
journal does not represent a running production importer. Future development
imports do not automatically update this independent production branch.

The SQL-created `gradavia_api` role can SELECT only the three source tables.
Its actual pooled login and rejection of a harmless write were verified, even
after overriding the read-only transaction default. It has no administrative
attributes, ownership or role memberships. At provisioning, only its pooled
credential was retained in that checkout's
ignored, mode-600 root `.env.local`; the temporary administrator environment was
removed. This does not establish credentials in another checkout.

## Verification and deployment

Run all commands from the repository root with the pinned mise toolchain.
Docker is required for the Linux container build and local database tests.
The image build context excludes credentials, Git metadata and local artifacts.

Keep production credentials in the ignored root `.env.local` with mode 600.
Never print connection strings, pass secret values as command-line arguments,
or bake secrets into an image. The ordinary development database must remain
independent from production.

Use the following commands for preparation:

```sh
mise exec -- just verify
mise exec -- just setup-browser
mise exec -- just test-smoke
mise exec -- just cf-check
mise exec -- just cf-api-image
```

`cf-check` builds OpenNext and dry-runs both Workers; the API dry run also builds
its container image. Generated Worker environment types come from the Wrangler
configuration during type checking and are not maintained by hand. The image
uses digest-pinned Docker Official Images from Amazon ECR Public, avoiding a
local network failure reaching Docker Hub's authentication endpoint.

For a new environment, select and confirm its Neon branch before provisioning a
role. The production reader above already exists and must not be recreated or
silently rotated. Inspect the explicit administrator environment first:

```sh
mise exec -- just provision-api-reader --env-file /absolute/path/to/production.env
```

Then pass `--apply --confirm-endpoint <the-inspected-endpoint-id>` to create a
fresh `gradavia_api` login. This grants SELECT on `source_datasets`,
`source_releases` and `raw_records`; it grants no ownership, administrative role
membership, persistent writes or future-table privileges. Existing roles are
never silently changed or rotated. Unexpected effective PUBLIC grants cause
transaction rollback. Existing PUBLIC CONNECT and TEMPORARY are preserved.
The command appends only `GRADAVIA_API_DATABASE_URL` to the ignored root
`.env.local`, preserving development settings.

After enabling Workers Paid and authenticating Wrangler, publish in order:

```sh
mise exec -- just cf-api-secret
mise exec -- just cf-api-deploy
mise exec -- just cf-web-deploy
```

The secret command requires the dedicated `gradavia_api` username and streams
the value to Wrangler's standard input. It never passes credentials as command
arguments. On first setup Wrangler may create the private Worker before upload.
Deployment commands remove database environment variables from build processes.

Verification evidence is recorded in the
[execution plan](exec-plans/completed/cloudflare-deployment.md) and
[quality status](quality.md). Both Workers and custom domains were published on
2026-10-05 after Wrangler OAuth was renewed. The initial manual API version was
`0e5e59c6-62c3-49a5-9940-45ed4a363c47`; the corrected manual web version was
`ea72f0af-50f3-4a22-8700-c1d2edb29d69`. Both workers.dev URLs and preview URLs are
disabled; only the web Worker owns custom domains.

## Automatic main releases

The GitHub Actions `CI` workflow verifies pull requests and pushes to `main`.
Only a successful main application push can enter the `Deploy production` job.
Documentation-only pushes skip deployment. Pull requests and manual exhaustive
runs never publish Workers or receive the deployment token. Automatic verification
runs checks, unit tests, build and production smoke, plus database contracts for
backend/schema/tooling changes; see [CI selection](harness.md#ci-selection).
The manual **CI → Run workflow** action runs `just verify-full` without deployment.
The deployment job explicitly installs Chromium for its public production smoke.

The production job builds and dry-runs both Workers and the Linux container
before publishing. Releases share a non-cancelling concurrency group with `queue: max` so a new
push cannot interrupt the API/website pair or replace a pending release. Immediately before publishing, the
job checks that its application revision is still current: later application
changes supersede it, but later documentation-only commits do not cancel its
publication. Missing history or a rewritten branch skips publication. Main
verification is grouped by commit so an old rerun cannot cancel verification of
a newer main commit. The private API is published first, followed by the prebuilt
website. The final browser smoke requires real positive formation results and a
formation detail with provenance, in addition to health and canonical routing.

GitHub Actions needs one repository or `production` environment secret:
`CLOUDFLARE_API_TOKEN`. Use a dedicated token scoped to this Cloudflare account
with Workers Scripts Edit and Containers Edit, plus Workers Routes Edit scoped
to `gradavia.com`. The account and zone IDs are already in Wrangler configuration.
Do not grant unrelated KV, R2, D1 or Pages permissions. The production database
credential remains in the API Worker's existing secret; do not copy it to GitHub.

The token is supplied only to the publishing step. Verification and image/web
builds do not receive it. GitHub's `production` environment links to the site and
records deployment outcomes. Failed smoke checks retain sanitized status and a
public-page screenshot for seven days. A failed release does not automatically
roll back either Worker; inspect the job and use the rollback procedure below.
Migrations and ingestion remain explicit operations outside this workflow.

Follow the [continuous deployment plan](exec-plans/completed/cloudflare-continuous-deployment.md)
for activation and live-run evidence. The first automatic
[main release](https://github.com/gregorsternat/gradavia/actions/runs/37226070152)
completed successfully on 2026-10-05. Pushing or merging into main triggers this
pipeline; publication still depends
on successful verification, current-main selection and successful publish steps.
No local Wrangler login or manual publishing command is needed for that path.

## Release checks

1. Run `just verify`, `just test-smoke`, relevant database contracts and the Cloudflare-specific build/dry-run checks.
2. Build the Linux/amd64 API image and check its liveness and database readiness.
3. Verify that the dedicated reader can read published releases and cannot write
   source tables, change schemas or inherit a privileged role.
4. Deploy the API before the website, retaining its private network boundary.
5. Check HTTPS on both custom domains, canonical redirects and `/api/health`.
6. Exercise formations, overview and specialties with the expected live campaign
   and source counts. Liveness alone does not prove data availability.
7. Inspect desktop/mobile rendering and keyboard navigation in the real browser.

The frontend continues to show explicit empty/unavailable states when upstream
data cannot be read. It never substitutes fixture data.

## Rollback and operations

Use Wrangler's version history and rollback commands for the affected Worker.
Roll back the API and web separately, preserving compatibility of their `/v1`
HTTP contract. A Worker rollback does not roll back the database or source data.
Keep the last working image available until its replacement passes live checks.

Worker logs are enabled; application errors remain sanitized. Logs and health
endpoints do not provide an alerting policy. Public uptime alerts, freshness
thresholds and scheduled ingestion remain tracked operational work.

Reference documentation: [OpenNext adapter](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/),
[Containers](https://developers.cloudflare.com/containers/),
[service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/),
and [custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).
