import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const allChecks = { docsOnly: false, database: true };

function isDocumentation(file) {
  return (
    file.endsWith(".md") &&
    (!file.includes("/") ||
      file.startsWith("docs/") ||
      file.startsWith(".github/") ||
      path.posix.basename(file) === "AGENTS.md")
  );
}

export function classifyChanges(files) {
  if (!files.length) return { ...allChecks };
  const application = files.filter((file) => !isDocumentation(file));
  return {
    docsOnly: application.length === 0,
    // Only ordinary web source/assets and browser cases can skip DB contracts.
    // Backend, fixtures, scripts, manifests/configuration and unknown paths opt in.
    database: application.some(
      (file) =>
        !(
          file.startsWith("apps/web/src/") ||
          file.startsWith("apps/web/public/") ||
          /^tests\/browser\/[^/]+\.spec\.ts$/.test(file)
        ),
    ),
  };
}

export function selectChecks(eventName, event, cwd = process.cwd()) {
  try {
    let base, head, comparison;
    if (eventName === "pull_request") {
      base = event.pull_request.base.sha;
      head = event.pull_request.head.sha;
      comparison = "...";
    } else if (eventName === "push") {
      base = event.before;
      head = event.after;
      comparison = "..";
    } else {
      return { ...allChecks };
    }
    const valid = (sha) => /^[a-f0-9]{40}$/.test(sha) && !/^0+$/.test(sha);
    if (!valid(base) || !valid(head)) return { ...allChecks };
    const files = execFileSync(
      "git",
      [
        "diff",
        "--name-only",
        "--no-renames",
        "-z",
        `${base}${comparison}${head}`,
        "--",
      ],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    )
      .split("\0")
      .filter(Boolean);
    return classifyChanges(files);
  } catch {
    // Never turn an incomplete/shallow history or malformed event into a skip.
    return { ...allChecks };
  }
}

export function canPublish(release, latest, cwd = process.cwd()) {
  const valid = (sha) => /^[a-f0-9]{40}$/.test(sha) && !/^0+$/.test(sha);
  if (!valid(release) || !valid(latest)) return false;
  if (release === latest) return true;
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", release, latest], {
      cwd,
      stdio: "ignore",
    });
    // A later documentation-only push has no deployment of its own. It must not
    // cancel the already-validated application release waiting to publish.
    return selectChecks("push", { before: release, after: latest }, cwd)
      .docsOnly;
  } catch {
    return false;
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  let event = {};
  try {
    event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  } catch {
    // selectChecks falls back to all checks for an unavailable event.
  }
  const selection = selectChecks(process.env.GITHUB_EVENT_NAME, event);
  const output =
    process.argv[2] === "--release"
      ? `current=${canPublish(process.env.GITHUB_SHA, process.env.LATEST_SHA)}\n`
      : `docs_only=${selection.docsOnly}\ndatabase=${selection.database}\n`;
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, output);
  process.stdout.write(output);
}
