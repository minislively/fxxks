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
    contextTrust: {
      schemaVersion: 1,
      source: "fooks check --json operator-check projection",
      researchReference: "docs/research/context-trust-and-stale-evidence-research.md",
      claimBoundary: "synthetic test contextTrust",
      sourceOfTruth: {
        current: [{ kind: "issue", source: "activeArtifacts", reason: "open issue count", contractScope: "top-level-active-artifact", authority: "current-work" }],
      },
      advisoryOnly: [],
      historicalOnly: [],
      nonAuthorizing: [
        {
          kind: "stale-residue-active-boundary",
          source: "stale residue",
          reason: "cleanup-review only",
          referenceField: "activeWorkReceipts.staleResidueActiveBoundary",
          contractScope: "stale-residue-boundary",
          authority: "insufficient",
        },
      ],
    },
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
  assert.ok(packet.sourceOfTruth.authoritativeFilesAndDocs.includes("src/ops/sequential-planning-hint.ts"));
  assert.equal(packet.staleOrHistoricalContextToAvoid.length, 2);
  assert.equal(packet.nextRecommendedAction.action, "continue-implementation-for-linked-issue");
  assert.equal(packet.authoritativeResumePacket.issue, "#986");
  assert.equal(packet.authoritativeResumePacket.compact, true);
  assert.equal(packet.authoritativeResumePacket.beforeNewSession, true);
  assert.equal(packet.authoritativeResumePacket.currentSourceOfTruth.authorityStatus, "present");
  assert.equal(packet.authoritativeResumePacket.staleHistoricalBoundary.status, "present");
  assert.equal(packet.authoritativeResumePacket.nextSessionAdvisory.action, "continue-implementation-for-linked-issue");
  assert.deepEqual(packet.planningWarnings, []);
  assert.deepEqual(packet.combinedReliabilityWarnings, []);
  assert.deepEqual(packet.resetCompactHandoffRecommendations, []);
  assert.deepEqual(packet.sequentialPlanningHints, []);
  assert.deepEqual(packet.longRunBudgetWarnings, []);
});

test("source-of-truth handoff packet emits deterministic diagnostic timing receipt", () => {
  const cwd = repoRoot;
  const runner = (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    if (key === "git status --porcelain=v1") return " M src/ops/source-of-truth-handoff.ts\n";
    if (key === "gh issue view 963 --json number,title,state,url") {
      return JSON.stringify({ number: 963, title: "source of truth handoff", state: "OPEN", url: "https://github.com/minislively/fooks/issues/963" });
    }
    if (key === "gh pr list --head fooks-issue-963-source-of-truth-handoff --state all --json number,title,state,url,headRefName,baseRefName,isDraft,statusCheckRollup --limit 1") {
      return "[]";
    }
    throw new Error(`unexpected command: ${key}`);
  };
  let tick = 0;
  const nowMs = () => {
    tick += 2;
    return tick;
  };

  const packet = buildSourceOfTruthHandoffPacket(baseSnapshot(cwd), basePreflight(), {
    commandRunner: runner,
    now: () => "2026-05-19T01:02:03.000Z",
    nowMs,
  });

  const receipt = packet.diagnostics.handoffTiming;
  assert.equal(receipt.status, "diagnostic");
  assert.equal(receipt.source, "fooks handoff assembly timing");
  assert.match(receipt.claimBoundary, /Diagnostic\/read-only/);
  assert.match(receipt.claimBoundary, /not current-work authority/);
  assert.match(receipt.claimBoundary, /not provider billing\/runtime proof/);
  assert.ok(Number.isFinite(receipt.totalMs));
  assert.ok(receipt.totalMs >= 0);
  const phaseNames = receipt.phases.map((phase) => phase.name);
  assert.ok(phaseNames.includes("read-changed-paths"));
  assert.ok(phaseNames.includes("linked-issue"));
  assert.ok(phaseNames.includes("linked-pull-request"));
  assert.ok(phaseNames.includes("authoritative-resume-packet"));
  for (const phase of receipt.phases) {
    assert.equal(phase.status, "ok");
    assert.ok(Number.isFinite(phase.elapsedMs));
    assert.ok(phase.elapsedMs >= 0);
  }
});

test("authoritative resume packet compacts stale/context/reliability overlap before new session", () => {
  const cwd = repoRoot;
  const snapshot = baseSnapshot(cwd);
  snapshot.runtimeProvenance.git.branch = "fooks-issue-976-runtime-planning-warning";
  snapshot.activity.worktree.branch = "fooks-issue-976-runtime-planning-warning";
  snapshot.activity.worktree.upstream = "origin/fooks-issue-976-runtime-planning-warning";
  const runner = (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    if (key === "git status --porcelain=v1") return " M src/ops/source-of-truth-handoff.ts\n M test/source-of-truth-handoff.test.mjs\n";
    if (key === "gh issue view 976 --json number,title,state,url") {
      return JSON.stringify({ number: 976, title: "runtime planning warning", state: "OPEN", url: "https://github.com/minislively/fooks/issues/976" });
    }
    if (key === "gh pr list --head fooks-issue-976-runtime-planning-warning --state all --json number,title,state,url,headRefName,baseRefName,isDraft,statusCheckRollup --limit 1") {
      return "[]";
    }
    throw new Error(`unexpected command: ${key}`);
  };

  const packet = buildSourceOfTruthHandoffPacket(snapshot, basePreflight(), { commandRunner: runner, now: () => "2026-05-20T10:02:03.000Z" });
  const resume = packet.authoritativeResumePacket;
  assert.equal(resume.schemaVersion, 1);
  assert.equal(resume.status, "advisory");
  assert.match(resume.claimBoundary, /not provider billing\/runtime proof/);
  assert.match(resume.claimBoundary, /not autonomous CI\/merge authority/);
  assert.equal(resume.currentSourceOfTruth.linkedArtifacts.issue.number, 976);
  assert.equal(resume.currentSourceOfTruth.scope.branch, "fooks-issue-976-runtime-planning-warning");
  assert.deepEqual(resume.currentSourceOfTruth.scope.changedPaths, ["src/ops/source-of-truth-handoff.ts", "test/source-of-truth-handoff.test.mjs"]);
  assert.equal(resume.staleHistoricalBoundary.status, "present");
  assert.equal(resume.staleHistoricalBoundary.avoidCount, 2);
  assert.match(resume.staleHistoricalBoundary.instruction, /Treat listed stale\/historical\/non-authorizing entries as boundaries/);
  assert.equal(resume.reliabilityBoundary.planningWarningCount, 1);
  assert.equal(resume.reliabilityBoundary.combinedReliabilityWarningCount, 1);
  assert.equal(resume.reliabilityBoundary.sequentialPlanningHintCount, 1);
  assert.equal(resume.reliabilityBoundary.planBeforeExecuteGuardCount, 1);
  assert.equal(resume.reliabilityBoundary.longRunBudgetWarningCount, 1);
  assert.equal(resume.reliabilityBoundary.resetCompactHandoffRecommendationCount, 1);
  assert.equal(packet.resetCompactHandoffRecommendations.length, 1);
  assert.deepEqual(packet.resetCompactHandoffRecommendations[0].recommendedActions, ["reset-context", "compact-current-source-of-truth", "handoff-to-fresh-agent"]);
  assert.equal(resume.reliabilityBoundary.longRunBudgetRiskLevel, "high");
  assert.equal(resume.reliabilityBoundary.staleContextReliabilityOverlap, true);
  assert.equal(resume.reliabilityBoundary.stopBeforeMoreExecution, true);
  assert.equal(resume.nextSessionAdvisory.action, "stop-before-more-execution");
  assert.match(resume.nextSessionAdvisory.rationale, /recheck current authority/);
  assert.ok(resume.nextSessionAdvisory.requiredRechecks.some((line) => /fooks check --json/.test(line)));
  assert.ok(resume.nextSessionAdvisory.requiredRechecks.some((line) => /budget-risk boundary/.test(line)));
  assert.match(resume.forbiddenClaims.join("\n"), /provider usage\/billing-token proof/);
  assert.match(resume.forbiddenClaims.join("\n"), /autonomous CI\/merge authority/);
  assert.match(JSON.stringify(resume), /sourceOfTruth.currentAuthority/);
});

test("authoritative resume packet stays advisory and clear for ordinary non-risk handoff", () => {
  const cwd = repoRoot;
  const snapshot = baseSnapshot(cwd);
  snapshot.contextTrust.nonAuthorizing = [];
  snapshot.contextTrust.historicalOnly = [];
  const preflight = basePreflight();
  preflight.historicalOnly = [];
  preflight.nonAuthorizing = [];
  const runner = (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    if (key === "git status --porcelain=v1") return "";
    if (key === "gh issue view 963 --json number,title,state,url") return JSON.stringify({ number: 963, title: "source of truth handoff", state: "OPEN" });
    if (key === "gh pr list --head fooks-issue-963-source-of-truth-handoff --state all --json number,title,state,url,headRefName,baseRefName,isDraft,statusCheckRollup --limit 1") {
      return JSON.stringify([{ number: 1001, state: "OPEN", headRefName: "fooks-issue-963-source-of-truth-handoff", baseRefName: "main", isDraft: false, statusCheckRollup: [] }]);
    }
    throw new Error(`unexpected command: ${key}`);
  };

  const packet = buildSourceOfTruthHandoffPacket(snapshot, preflight, { commandRunner: runner, now: () => "2026-05-20T10:03:03.000Z" });
  const resume = packet.authoritativeResumePacket;
  assert.equal(resume.staleHistoricalBoundary.status, "clear");
  assert.equal(resume.staleHistoricalBoundary.avoidCount, 0);
  assert.equal(resume.reliabilityBoundary.planningWarningCount, 0);
  assert.equal(resume.reliabilityBoundary.combinedReliabilityWarningCount, 0);
  assert.equal(resume.reliabilityBoundary.sequentialPlanningHintCount, 0);
  assert.equal(resume.reliabilityBoundary.planBeforeExecuteGuardCount, 0);
  assert.equal(resume.reliabilityBoundary.longRunBudgetWarningCount, 0);
  assert.equal(resume.reliabilityBoundary.resetCompactHandoffRecommendationCount, 0);
  assert.deepEqual(packet.resetCompactHandoffRecommendations, []);
  assert.equal(resume.reliabilityBoundary.longRunBudgetRiskLevel, "clear");
  assert.equal(resume.reliabilityBoundary.stopBeforeMoreExecution, false);
  assert.equal(resume.nextSessionAdvisory.action, "continue-implementation-for-linked-issue");
  assert.match(resume.staleHistoricalBoundary.instruction, /No stale\/historical\/non-authorizing entries/);
  assert.match(resume.claimBoundary, /preserves the full handoff output/);
  assert.match(resume.forbiddenClaims.join("\n"), /frontend runtime behavior change/);
});

test("source-of-truth handoff packet emits JSON-ready diagnostic timing shape without live CLI load", () => {
  const cwd = repoRoot;
  const runner = (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    if (key === "git status --porcelain=v1") return "";
    if (key === "gh issue view 963 --json number,title,state,url") return JSON.stringify({ number: 963, state: "OPEN" });
    if (key === "gh pr list --head fooks-issue-963-source-of-truth-handoff --state all --json number,title,state,url,headRefName,baseRefName,isDraft,statusCheckRollup --limit 1") return "[]";
    throw new Error(`unexpected command: ${key}`);
  };
  const packet = buildSourceOfTruthHandoffPacket(baseSnapshot(cwd), basePreflight(), {
    commandRunner: runner,
    now: () => "2026-05-19T01:02:03.000Z",
    nowMs: () => 1,
    timingPhases: [
      { name: "read-operator-check-snapshot", elapsedMs: 7, status: "ok" },
      { name: "build-preflight-packet", elapsedMs: 2, status: "ok" },
      { name: "build-source-of-truth-handoff-packet", elapsedMs: 4, status: "ok" },
    ],
    timingStartedAtMs: 0,
  });
  const stdout = JSON.stringify(packet);
  const reparsed = JSON.parse(stdout);
  assert.equal(packet.schemaVersion, 1);
  assert.equal(reparsed.command, "handoff");
  assert.equal(reparsed.derivedFrom.operatorCheckCommand, "check");
  assert.equal(reparsed.derivedFrom.preflightCommand, "preflight");
  assert.equal(reparsed.derivedFrom.staleContextCommand, "stale-context");
  assert.ok(Array.isArray(reparsed.sourceOfTruth.authoritativeFilesAndDocs));
  assert.ok(reparsed.currentStatus.operatorCheck.verdict);
  assert.equal(reparsed.diagnostics.handoffTiming.status, "diagnostic");
  const phaseNames = reparsed.diagnostics.handoffTiming.phases.map((phase) => phase.name);
  assert.ok(phaseNames.includes("read-operator-check-snapshot"));
  assert.ok(phaseNames.includes("build-preflight-packet"));
  assert.ok(phaseNames.includes("build-source-of-truth-handoff-packet"));
});

test("handoff compact authoritative resume packet excludes diagnostic timing", () => {
  const cwd = repoRoot;
  const runner = (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    if (key === "git status --porcelain=v1") return "";
    if (key === "gh issue view 963 --json number,title,state,url") return JSON.stringify({ number: 963, state: "OPEN" });
    if (key === "gh pr list --head fooks-issue-963-source-of-truth-handoff --state all --json number,title,state,url,headRefName,baseRefName,isDraft,statusCheckRollup --limit 1") return "[]";
    throw new Error(`unexpected command: ${key}`);
  };
  const fullPacket = buildSourceOfTruthHandoffPacket(baseSnapshot(cwd), basePreflight(), {
    commandRunner: runner,
    now: () => "2026-05-19T01:02:03.000Z",
    nowMs: () => 1,
  });
  const serializedResumePacket = JSON.stringify(fullPacket.authoritativeResumePacket);
  const resumePacket = JSON.parse(serializedResumePacket);

  assert.deepEqual(resumePacket, JSON.parse(JSON.stringify(fullPacket.authoritativeResumePacket)));
  assert.equal(resumePacket.schemaVersion, 1);
  assert.equal(resumePacket.status, "advisory");
  assert.equal(resumePacket.compact, true);
  assert.equal(resumePacket.beforeNewSession, true);
  assert.equal(resumePacket.derivedFrom.handoffCommand, "handoff");
  assert.equal(resumePacket.derivedFrom.handoffSchemaVersion, fullPacket.schemaVersion);
  assert.equal(resumePacket.currentSourceOfTruth.scope.cwd, fullPacket.scope.cwd);
  assert.equal(resumePacket.currentSourceOfTruth.scope.changedPathCount, fullPacket.scope.changedPathCount);
  assert.equal(resumePacket.staleHistoricalBoundary.avoidCount, fullPacket.staleOrHistoricalContextToAvoid.length);
  assert.equal(resumePacket.reliabilityBoundary.planningWarningCount, fullPacket.planningWarnings.length);
  assert.equal(resumePacket.reliabilityBoundary.combinedReliabilityWarningCount, fullPacket.combinedReliabilityWarnings.length);
  assert.equal(resumePacket.reliabilityBoundary.sequentialPlanningHintCount, fullPacket.sequentialPlanningHints.length);
  assert.equal(resumePacket.reliabilityBoundary.planBeforeExecuteGuardCount, fullPacket.planBeforeExecuteGuards.length);
  assert.equal(resumePacket.reliabilityBoundary.resetCompactHandoffRecommendationCount, fullPacket.resetCompactHandoffRecommendations.length);
  assert.equal(Object.hasOwn(resumePacket, "currentStatus"), false);
  assert.equal(Object.hasOwn(resumePacket, "sourceOfTruth"), false);
  assert.equal(Object.hasOwn(resumePacket, "diagnostics"), false);
  assert.match(resumePacket.claimBoundary, /not provider billing\/runtime proof/);
  assert.match(resumePacket.claimBoundary, /not autonomous CI\/merge authority/);
  assert.match(resumePacket.claimBoundary, /not provider\/runtime hook behavior/);
  assert.match(resumePacket.claimBoundary, /not product support expansion/);
  assert.match(resumePacket.claimBoundary, /not frontend behavior change/);
  assert.match(resumePacket.forbiddenClaims.join("\n"), /provider billing\/runtime proof/);
  assert.match(resumePacket.forbiddenClaims.join("\n"), /autonomous CI\/merge authority/);
});

test("handoff CLI rejects ambiguous full and resume JSON projection flags", () => {
  assert.throws(
    () => execFileSync(process.execPath, [cli, "handoff", "--json", "--resume-json"], { cwd: repoRoot, encoding: "utf8", timeout: 20_000, stdio: ["ignore", "pipe", "pipe"] }),
    /handoff accepts either --json or --resume-json, not both/,
  );
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
  assert.equal(packet.combinedReliabilityWarnings.length, 1);
  assert.equal(packet.combinedReliabilityWarnings[0].trigger, "context-risk-and-runtime-planning-overlap");
  assert.deepEqual(packet.combinedReliabilityWarnings[0].recommendedActions, ["reset-context", "compress-current-source-of-truth", "handoff-to-fresh-agent"]);
  assert.equal(packet.combinedReliabilityWarnings[0].requiredOverlap.contextRisk[0].contractScope, "stale-residue-boundary");
  assert.equal(packet.combinedReliabilityWarnings[0].requiredOverlap.runtimePlanning[0].issue, "#960");
  assert.match(packet.combinedReliabilityWarnings[0].claimBoundary, /Advisory-only overlap warning/);
  assert.match(packet.combinedReliabilityWarnings[0].forbiddenClaims.join("\n"), /runtime-token savings proof/);

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
  assert.deepEqual(nonTargetPacket.combinedReliabilityWarnings, []);
  assert.deepEqual(nonTargetPacket.resetCompactHandoffRecommendations, []);
  assert.deepEqual(nonTargetPacket.sequentialPlanningHints, []);
});

test("source-of-truth handoff does not emit combined reliability warning for runtime-only risk", () => {
  const cwd = repoRoot;
  const snapshot = baseSnapshot(cwd);
  snapshot.runtimeProvenance.git.branch = "fooks-issue-960-runtime-token-cost-plan";
  snapshot.activity.worktree.branch = "fooks-issue-960-runtime-token-cost-plan";
  snapshot.activity.worktree.upstream = "origin/fooks-issue-960-runtime-token-cost-plan";
  snapshot.contextTrust.nonAuthorizing = [];
  snapshot.contextTrust.historicalOnly = [];
  const runner = (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    if (key === "git status --porcelain=v1") return "";
    if (key === "gh issue view 960 --json number,title,state,url") return JSON.stringify({ number: 960, state: "OPEN" });
    if (key === "gh pr list --head fooks-issue-960-runtime-token-cost-plan --state all --json number,title,state,url,headRefName,baseRefName,isDraft,statusCheckRollup --limit 1") return "[]";
    throw new Error(`unexpected command: ${key}`);
  };

  const packet = buildSourceOfTruthHandoffPacket(snapshot, basePreflight(), { commandRunner: runner, now: () => "2026-05-19T01:02:03.000Z" });
  assert.equal(packet.planningWarnings.length, 1);
  assert.deepEqual(packet.combinedReliabilityWarnings, []);
  assert.deepEqual(packet.resetCompactHandoffRecommendations, []);
});

test("source-of-truth handoff emits issue #976 long-run runtime planning warning", () => {
  const cwd = repoRoot;
  const snapshot = baseSnapshot(cwd);
  snapshot.runtimeProvenance.git.branch = "fooks-issue-976-runtime-planning-warning";
  snapshot.activity.worktree.branch = "fooks-issue-976-runtime-planning-warning";
  snapshot.activity.worktree.upstream = "origin/fooks-issue-976-runtime-planning-warning";
  const runner = (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    if (key === "git status --porcelain=v1") return "";
    if (key === "gh issue view 976 --json number,title,state,url") {
      return JSON.stringify({ number: 976, title: "runtime planning warning", state: "OPEN", url: "https://github.com/minislively/fooks/issues/976" });
    }
    if (key === "gh pr list --head fooks-issue-976-runtime-planning-warning --state all --json number,title,state,url,headRefName,baseRefName,isDraft,statusCheckRollup --limit 1") {
      return "[]";
    }
    throw new Error(`unexpected command: ${key}`);
  };

  const packet = buildSourceOfTruthHandoffPacket(snapshot, basePreflight(), { commandRunner: runner, now: () => "2026-05-19T22:02:03.000Z" });
  assert.equal(packet.planningWarnings.length, 1);
  assert.equal(packet.planningWarnings[0].issue, "#976");
  assert.equal(packet.planningWarnings[0].status, "advisory");
  assert.equal(packet.planningWarnings[0].trigger, "linked-issue-976");
  assert.match(packet.planningWarnings[0].message, /context quality degrades/);
  assert.match(packet.planningWarnings[0].forbiddenClaims.join("\n"), /runtime-token savings proof/);
  assert.equal(packet.combinedReliabilityWarnings.length, 1);
  assert.equal(packet.combinedReliabilityWarnings[0].requiredOverlap.runtimePlanning[0].issue, "#976");
  assert.equal(packet.sequentialPlanningHints.length, 1);
  assert.equal(packet.sequentialPlanningHints[0].issue, "#982");
  assert.equal(packet.sequentialPlanningHints[0].trigger, "combined-reliability-warning-present");
  assert.match(packet.sequentialPlanningHints[0].message, /write a bounded plan/);
  assert.equal(packet.planBeforeExecuteGuards.length, 1);
  assert.equal(packet.longRunBudgetWarnings.length, 1);
  assert.equal(packet.longRunBudgetWarnings[0].issue, "#988");
  assert.equal(packet.longRunBudgetWarnings[0].riskLevel, "high");
  assert.equal(packet.longRunBudgetWarnings[0].trigger, "plan-before-execute-stop-with-runtime-planning");
  assert.equal(packet.resetCompactHandoffRecommendations.length, 1);
  assert.equal(packet.resetCompactHandoffRecommendations[0].issue, "#996");
  assert.match(packet.longRunBudgetWarnings[0].claimBoundary, /not provider billing\/token\/runtime proof/);
  assert.match(packet.sequentialPlanningHints[0].claimBoundary, /no provider billing-runtime proof|does not prove provider billing\/runtime token usage/);
});


test("source-of-truth handoff emits issue #982 sequential planning hint without runtime proof claims", () => {
  const cwd = repoRoot;
  const snapshot = baseSnapshot(cwd);
  snapshot.runtimeProvenance.git.branch = "fooks-issue-982-sequential-planning-hint";
  snapshot.activity.worktree.branch = "fooks-issue-982-sequential-planning-hint";
  snapshot.activity.worktree.upstream = "origin/fooks-issue-982-sequential-planning-hint";
  const runner = (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    if (key === "git status --porcelain=v1") return "";
    if (key === "gh issue view 982 --json number,title,state,url") {
      return JSON.stringify({ number: 982, title: "sequential planning hint", state: "OPEN", url: "https://github.com/minislively/fooks/issues/982" });
    }
    if (key === "gh pr list --head fooks-issue-982-sequential-planning-hint --state all --json number,title,state,url,headRefName,baseRefName,isDraft,statusCheckRollup --limit 1") {
      return "[]";
    }
    throw new Error(`unexpected command: ${key}`);
  };

  const packet = buildSourceOfTruthHandoffPacket(snapshot, basePreflight(), { commandRunner: runner, now: () => "2026-05-20T04:02:03.000Z" });
  assert.deepEqual(packet.planningWarnings, []);
  assert.deepEqual(packet.combinedReliabilityWarnings, []);
  assert.deepEqual(packet.resetCompactHandoffRecommendations, []);
  assert.equal(packet.sequentialPlanningHints.length, 1);
  assert.equal(packet.sequentialPlanningHints[0].trigger, "linked-issue-982");
  assert.deepEqual(packet.sequentialPlanningHints[0].recommendations, [
    "write-plan-before-execute",
    "split-long-work-into-bounded-steps",
    "checkpoint-or-compress-current-source-of-truth",
    "handoff-before-burning-another-context-window",
  ]);
  assert.match(packet.sequentialPlanningHints[0].claimBoundary, /does not prove provider billing\/runtime token usage/);
  assert.match(packet.sequentialPlanningHints[0].forbiddenClaims.join("\n"), /autonomous execution authority/);
  assert.match(packet.sequentialPlanningHints[0].forbiddenClaims.join("\n"), /merge authority or merge-gate policy change/);
});

test("source-of-truth handoff emits issue #984 plan-before-execute guard without authority or frontend claims", () => {
  const cwd = repoRoot;
  const snapshot = baseSnapshot(cwd);
  snapshot.runtimeProvenance.git.branch = "fooks-issue-984-plan-before-execute-guard";
  snapshot.activity.worktree.branch = "fooks-issue-984-plan-before-execute-guard";
  snapshot.activity.worktree.upstream = "origin/fooks-issue-984-plan-before-execute-guard";
  const runner = (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    if (key === "git status --porcelain=v1") return " M src/ops/plan-before-execute-guard.ts\n";
    if (key === "gh issue view 984 --json number,title,state,url") {
      return JSON.stringify({ number: 984, title: "plan before execute guard", state: "OPEN", url: "https://github.com/minislively/fooks/issues/984" });
    }
    if (key === "gh pr list --head fooks-issue-984-plan-before-execute-guard --state all --json number,title,state,url,headRefName,baseRefName,isDraft,statusCheckRollup --limit 1") {
      return "[]";
    }
    throw new Error(`unexpected command: ${key}`);
  };

  const packet = buildSourceOfTruthHandoffPacket(snapshot, basePreflight(), { commandRunner: runner, now: () => "2026-05-20T08:02:03.000Z" });
  assert.ok(packet.sourceOfTruth.authoritativeFilesAndDocs.includes("src/ops/plan-before-execute-guard.ts"));
  assert.equal(packet.planBeforeExecuteGuards.length, 1);
  assert.equal(packet.planBeforeExecuteGuards[0].issue, "#984");
  assert.equal(packet.planBeforeExecuteGuards[0].epic, "#960");
  assert.equal(packet.planBeforeExecuteGuards[0].trigger, "linked-issue-984");
  assert.equal(packet.planBeforeExecuteGuards[0].stopBeforeMoreExecution, true);
  assert.match(packet.planBeforeExecuteGuards[0].message, /write or refresh a bounded plan/);
  assert.match(packet.planBeforeExecuteGuards[0].claimBoundary, /not provider billing\/runtime proof/);
  assert.match(packet.planBeforeExecuteGuards[0].claimBoundary, /not autonomous execution or merge authority/);
  assert.match(packet.planBeforeExecuteGuards[0].claimBoundary, /not frontend behavior change/);
  assert.match(packet.planBeforeExecuteGuards[0].forbiddenClaims.join("\n"), /CI enforcement or blocking merge policy/);
});
