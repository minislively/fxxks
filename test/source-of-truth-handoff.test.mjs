import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const cli = path.join(repoRoot, "dist", "cli", "index.js");
const { buildSourceOfTruthHandoffPacket } = require(path.join(repoRoot, "dist", "ops", "source-of-truth-handoff.js"));

function baseSnapshot(cwd) {
  return {
    schemaVersion: 1,
    command: "check",
    generatedAt: "2026-05-19T00:00:00.000Z",
    cwd,
    source: "fooks check --json",
    verdict: "ready",
    blockers: [],
    runtimeProvenance: { git: { branch: "fooks-issue-963-source-of-truth-handoff", head: "abc123" } },
    activity: {
      worktree: {
        branch: "fooks-issue-963-source-of-truth-handoff",
        upstream: "origin/fooks-issue-963-source-of-truth-handoff",
        clean: false,
        ahead: 1,
        behind: 0,
      },
    },
    postMergeMainCiEvidence: {
      source: "GitHub Actions run list for exact local origin/main head; read-only and no fetch performed",
      remoteFreshness: "not verified",
      summary: {
        exactHeadWorkflowCount: 1,
        successCount: 1,
        pendingCount: 0,
        unknownCount: 0,
        failureCount: 0,
        allExactHeadConclusionsSuccessful: true,
      },
      workflowEvidence: [
        { workflow: "CI", status: "success", conclusion: "success", reason: "success", url: "https://example.test/run", headSha: "abc123" },
      ],
    },
  };
}

function basePreflight() {
  return {
    schemaVersion: 1,
    command: "preflight",
    summary: { authorityStatus: "present" },
    guidance: { riskLevel: "low", recommendedAction: "continue-with-current-authority", rationale: "current authority exists" },
    currentAuthority: [{ kind: "issue", source: "activeArtifacts", reason: "open issue count", contractScope: "top-level-active-artifact" }],
    historicalOnly: [{ kind: "post-merge-main-ci-receipt", source: "main ci", reason: "receipt only", referenceField: "postMergeMainCiEvidence" }],
    nonAuthorizing: [{ kind: "stale-residue-active-boundary", source: "stale residue", reason: "cleanup-review only" }],
  };
}

test("source-of-truth handoff packet links inferred issue, current branch PR checks, and stale avoid list", () => {
  const cwd = repoRoot;
  const runner = (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    if (key === "git status --porcelain=v1") return " M src/ops/source-of-truth-handoff.ts\n?? test/source-of-truth-handoff.test.mjs\n";
    if (key === "gh issue view 963 --json number,title,state,url") {
      return JSON.stringify({ number: 963, title: "source of truth handoff", state: "OPEN", url: "https://github.com/minislively/fooks/issues/963" });
    }
    if (key === "gh pr list --head fooks-issue-963-source-of-truth-handoff --state all --json number,title,state,url,headRefName,baseRefName,isDraft,statusCheckRollup --limit 1") {
      return JSON.stringify([{
        number: 1001,
        title: "handoff",
        state: "OPEN",
        url: "https://github.com/minislively/fooks/pull/1001",
        headRefName: "fooks-issue-963-source-of-truth-handoff",
        baseRefName: "main",
        isDraft: false,
        statusCheckRollup: [{ name: "CI", status: "COMPLETED", conclusion: "SUCCESS", detailsUrl: "https://example.test/check" }],
      }]);
    }
    throw new Error(`unexpected command: ${key}`);
  };

  const packet = buildSourceOfTruthHandoffPacket(baseSnapshot(cwd), basePreflight(), { runner, commandRunner: runner, now: () => "2026-05-19T01:02:03.000Z" });
  assert.equal(packet.command, "handoff");
  assert.equal(packet.linkedArtifacts.issue.status, "linked");
  assert.equal(packet.linkedArtifacts.issue.number, 963);
  assert.equal(packet.linkedArtifacts.pullRequest.status, "linked");
  assert.equal(packet.currentStatus.pullRequestChecks.status, "available");
  assert.equal(packet.currentStatus.pullRequestChecks.checks[0].name, "CI");
  assert.deepEqual(packet.scope.changedPaths, ["src/ops/source-of-truth-handoff.ts", "test/source-of-truth-handoff.test.mjs"]);
  assert.match(packet.claimBoundary, /bounded to the invocation cwd\/current branch\/worktree/);
  assert.ok(packet.sourceOfTruth.authoritativeFilesAndDocs.includes("src/ops/operator-check.ts"));
  assert.ok(packet.sourceOfTruth.authoritativeFilesAndDocs.includes("src/ops/source-of-truth-handoff.ts"));
  assert.equal(packet.staleOrHistoricalContextToAvoid.length, 2);
  assert.equal(packet.nextRecommendedAction.action, "continue-implementation-for-linked-issue");
});

test("handoff CLI emits JSON packet", () => {
  const stdout = execFileSync(process.execPath, [cli, "handoff", "--json"], { cwd: repoRoot, encoding: "utf8", timeout: 20_000 });
  const packet = JSON.parse(stdout);
  assert.equal(packet.schemaVersion, 1);
  assert.equal(packet.command, "handoff");
  assert.equal(packet.derivedFrom.operatorCheckCommand, "check");
  assert.equal(packet.derivedFrom.preflightCommand, "preflight");
  assert.equal(packet.derivedFrom.staleContextCommand, "stale-context");
  assert.ok(Array.isArray(packet.sourceOfTruth.authoritativeFilesAndDocs));
  assert.ok(packet.currentStatus.operatorCheck.verdict);
});

test("source-of-truth handoff emits narrow issue #960 runtime/token-cost planning warning only", () => {
  const cwd = repoRoot;
  const snapshot = baseSnapshot(cwd);
  snapshot.runtimeProvenance.git.branch = "fooks-issue-960-runtime-token-cost-plan";
  snapshot.activity.worktree.branch = "fooks-issue-960-runtime-token-cost-plan";
  snapshot.activity.worktree.upstream = "origin/fooks-issue-960-runtime-token-cost-plan";
  const runner = (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    if (key === "git status --porcelain=v1") return "";
    if (key === "gh issue view 960 --json number,title,state,url") {
      return JSON.stringify({ number: 960, title: "runtime token cost planning", state: "OPEN", url: "https://github.com/minislively/fooks/issues/960" });
    }
    if (key === "gh pr list --head fooks-issue-960-runtime-token-cost-plan --state all --json number,title,state,url,headRefName,baseRefName,isDraft,statusCheckRollup --limit 1") {
      return "[]";
    }
    throw new Error(`unexpected command: ${key}`);
  };

  const packet = buildSourceOfTruthHandoffPacket(snapshot, basePreflight(), { commandRunner: runner, now: () => "2026-05-19T01:02:03.000Z" });
  assert.equal(packet.planningWarnings.length, 1);
  assert.equal(packet.planningWarnings[0].issue, "#960");
  assert.equal(packet.planningWarnings[0].status, "advisory");
  assert.equal(packet.planningWarnings[0].trigger, "linked-issue-960");
  assert.deepEqual(packet.planningWarnings[0].prerequisiteIssues, ["#961", "#962", "#963"]);
  assert.match(packet.planningWarnings[0].claimBoundary, /does not change provider\/runtime hooks/);
  assert.match(packet.planningWarnings[0].forbiddenClaims.join("\n"), /provider usage\/billing-token proof/);

  const nonTargetPacket = buildSourceOfTruthHandoffPacket(baseSnapshot(cwd), basePreflight(), {
    commandRunner: (command, args) => {
      const key = `${command} ${args.join(" ")}`;
      if (key === "git status --porcelain=v1") return "";
      if (key === "gh issue view 963 --json number,title,state,url") return JSON.stringify({ number: 963, state: "OPEN" });
      if (key === "gh pr list --head fooks-issue-963-source-of-truth-handoff --state all --json number,title,state,url,headRefName,baseRefName,isDraft,statusCheckRollup --limit 1") return "[]";
      throw new Error(`unexpected command: ${key}`);
    },
    now: () => "2026-05-19T01:02:03.000Z",
  });
  assert.deepEqual(nonTargetPacket.planningWarnings, []);
});
