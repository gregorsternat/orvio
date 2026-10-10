import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { canPublish, classifyChanges, selectChecks } from "../ci-changes.mjs";

const full = { docsOnly: false, database: true };
const docs = { docsOnly: true, database: false };
const web = { docsOnly: false, database: false };

test("documentation-only and ordinary frontend changes select bounded checks", () => {
  assert.deepEqual(
    classifyChanges(["README.md", "docs/harness.md", "apps/web/AGENTS.md"]),
    docs,
  );
  assert.deepEqual(
    classifyChanges(["docs/harness.md", "apps/web/src/app/page.tsx"]),
    web,
  );
  assert.deepEqual(
    classifyChanges([
      "apps/web/public/logo.svg",
      "tests/browser/shell.spec.ts",
    ]),
    web,
  );
});

test("backend, schema, dependencies and test infrastructure require DB contracts", () => {
  for (const file of [
    "crates/api/src/lib.rs",
    "crates/aggregator/src/main.rs",
    "packages/db/migrations/0001.sql",
    "packages/db/src/schema.ts",
    "apps/api-worker/src/index.ts",
    "scripts/e2e-server.ts",
    "tests/browser/fixtures.ts",
    ".github/workflows/ci.yml",
    "package.json",
    "apps/web/package.json",
    "Cargo.toml",
    "Cargo.lock",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "playwright.config.ts",
    "vitest.config.ts",
    "apps/web/next.config.ts",
    "tsconfig.json",
    ".mise.toml",
    "rust-toolchain.toml",
    "justfile",
    "Dockerfile.api",
    "unknown/path.txt",
    "apps/web/src/content.mdx",
  ]) {
    // MDX under web source is executable frontend, never documentation-only.
    assert.deepEqual(
      classifyChanges([file]),
      file.endsWith(".mdx") ? web : full,
      file,
    );
  }
});

test("missing comparison information, manual runs and empty diffs fail closed", () => {
  assert.deepEqual(classifyChanges([]), full);
  assert.deepEqual(selectChecks("workflow_dispatch", {}), full);
  assert.deepEqual(selectChecks("pull_request", {}), full);
  assert.deepEqual(
    selectChecks("push", { before: "0".repeat(40), after: "a".repeat(40) }),
    full,
  );
  assert.deepEqual(
    selectChecks("push", {
      before: "--output=unexpected",
      after: "a".repeat(40),
    }),
    full,
  );
});

test("real Git comparisons handle PR divergence, push deletions and renames", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "gradavia-ci-selection-"));
  const git = (...args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const commit = (name) => {
    git("add", "-A");
    git("commit", "-m", name);
    return git("rev-parse", "HEAD");
  };
  const push = (before, after) => selectChecks("push", { before, after }, cwd);
  try {
    git("init", "-b", "main");
    git("config", "user.name", "CI selection test");
    git("config", "user.email", "test@example.invalid");
    writeFileSync(path.join(cwd, "README.md"), "Initial\n");
    writeFileSync(path.join(cwd, "package.json"), "{}\n");
    const base = commit("initial");
    git("checkout", "-b", "docs");
    writeFileSync(path.join(cwd, "README.md"), "Updated\n");
    const head = commit("docs only");
    git("checkout", "main");
    writeFileSync(path.join(cwd, "package.json"), '{"private":true}\n');
    const newBase = commit("base advances");
    assert.deepEqual(
      selectChecks(
        "pull_request",
        { pull_request: { base: { sha: newBase }, head: { sha: head } } },
        cwd,
      ),
      docs,
    );
    assert.deepEqual(push(base, head), docs);
    assert.deepEqual(push(base, newBase), full);
    assert.equal(canPublish(base, base, cwd), true);
    assert.equal(canPublish(base, head, cwd), true);
    assert.equal(canPublish(base, newBase, cwd), false);
    assert.equal(canPublish(head, newBase, cwd), false);
    assert.equal(canPublish(head, base, cwd), false);
    assert.equal(canPublish(base, "a".repeat(40), cwd), false);
    assert.equal(canPublish(undefined, undefined, cwd), false);
    renameSync(
      path.join(cwd, "package.json"),
      path.join(cwd, "dependencies.md"),
    );
    const renamed = commit("rename code to documentation");
    assert.deepEqual(push(newBase, renamed), full);
    rmSync(path.join(cwd, "README.md"));
    const deleted = commit("delete documentation");
    assert.deepEqual(push(renamed, deleted), docs);
    assert.deepEqual(push(deleted, deleted), full);
    assert.deepEqual(push("a".repeat(40), deleted), full);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
