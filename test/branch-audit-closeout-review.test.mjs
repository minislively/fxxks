import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const rendererScript = path.join(repoRoot, "scripts", "render-branch-audit-closeout-review.mjs");

function fixtureAudit() {
  return {
    summary: {
      generatedAt: "2026-05-09T00:01:53.737Z",
      base: "origin/main",
      remote: "origin",
      githubPullRequestsChecked: true,
      githubRepository: "minislively/fooks",
      openPullRequests: 0,
      totalBranches: 3,
      counts: {
        "valid-candidate": 2,
        archived: 1,
        "redundant-merged": 0,
        "redundant-patch-equivalent": 0,
      },
    },
    branches: [
      {
        branch: "feature-small",
        ref: "origin/feature-small",
        classification: "valid-candidate",
        behindBaseCommits: 2,
        aheadOfBaseCommits: 1,
        uniquePatchCommits: 1,
        patchEquivalentCommits: 0,
        lastCommitDate: "2026-05-08",
        lastSha: "111111111111",
        lastSubject: "Small branch",
        currentTreeImpact: {
          deletedFiles: 1,
          destructiveStaleTree: true,
          deletedPathEvidence: ["test/old.test.mjs"],
        },
      },
      {
        branch: "feature-large",
        ref: "origin/feature-large",
        classification: "valid-candidate",
        behindBaseCommits: 10,
        aheadOfBaseCommits: 3,
        uniquePatchCommits: 2,
        patchEquivalentCommits: 1,
        lastCommitDate: "2026-05-07",
        lastSha: "222222222222",
        lastSubject: "Large branch",
        currentTreeImpact: {
          deletedFiles: 8,
          destructiveStaleTree: true,
          deletedPathEvidence: ["src/current.ts", "test/current.test.mjs"],
        },
      },
      {
        branch: "feature-archived",
        ref: "origin/feature-archived",
        classification: "archived",
        behindBaseCommits: 20,
        aheadOfBaseCommits: 4,
        uniquePatchCommits: 3,
        patchEquivalentCommits: 0,
        lastCommitDate: "2026-05-06",
        lastSha: "333333333333",
        lastSubject: "Archived branch",
        currentTreeImpact: {
          deletedFiles: 5,
          destructiveStaleTree: true,
          deletedPathEvidence: ["docs/current.md"],
        },
        archiveEvidence: {
          sourcePath: "docs/feature-archived-branch-archive.md",
          matchType: "branch-inspected",
          matchedRef: "origin/feature-archived",
          lineNumber: 5,
        },
      },
    ],
  };
}

test("branch audit closeout renderer produces read-only operator checklist", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-branch-audit-closeout-review-"));
  const input = path.join(tempDir, "audit.json");
  const output = path.join(tempDir, "review.md");
  fs.writeFileSync(input, JSON.stringify(fixtureAudit()), "utf8");

  try {
    execFileSync(process.execPath, [rendererScript, input, "--output", output], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const markdown = fs.readFileSync(output, "utf8");

    assert.match(markdown, /# Branch audit closeout review checklist/);
    assert.match(markdown, /This is a read-only operator review aid/);
    assert.match(markdown, /does not fetch remotes, delete branches, merge branch tips, prune refs, replay stale-tree deletes, or approve cleanup/);
    assert.match(markdown, /Any deletion, merge, or remote-prune action requires a separate explicit operator decision/);
    assert.match(markdown, /Remaining valid-candidate branches requiring owner review: 2/);
    assert.match(markdown, /Archived valid candidates with evidence: 1/);
    assert.match(markdown, /`git diff --stat origin\/main\.\.\.origin\/feature-large`/);
    assert.match(markdown, /`src\/current.ts`/);
    assert.match(markdown, /docs\/feature-archived-branch-archive.md:5 \(branch-inspected\)/);
    assert.ok(markdown.indexOf("feature-large") < markdown.indexOf("feature-small"), "larger stale-tree delete risk is listed first");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
