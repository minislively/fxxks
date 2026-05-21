// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const cli = path.join(repoRoot, "dist", "cli", "index.js");
const require = createRequire(import.meta.url);

const {
  OPERATOR_ACTIVITY_CLAIM_BOUNDARY,
  OPERATOR_ACTIVITY_COMMAND,
  OPERATOR_ACTIVITY_CURRENT_RUN_CLAIM_BOUNDARY,
  OPERATOR_ACTIVITY_CURRENT_RUN_SOURCE,
  OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_CLAIM_BOUNDARY,
  OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_SOURCE,
  OPERATOR_ACTIVITY_REMOTE_COUNTS_FLAG,
  OPERATOR_ACTIVITY_REMOTE_SOURCE,
  OPERATOR_ACTIVITY_STAGED_OMX_PROMPT_SOURCE,
  OPERATOR_ACTIVITY_TMUX_COMMAND,
  OPERATOR_ACTIVITY_LEGACY_WORKTREE_ENTRY_LIMIT,
  parseOperatorActivityTmuxPanes,
  readOperatorActivitySnapshot,
} = require(path.join(repoRoot, "dist", "ops", "operator-activity.js"));

const {
  OPERATOR_CHECK_CLAIM_BOUNDARY,
  OPERATOR_CHECK_COMMAND,
  OPERATOR_CHECK_SOURCE,
  OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_CLAIM_BOUNDARY,
  OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_SOURCE,
  OPERATOR_CHECK_RELIABILITY_WARNING_VISIBILITY_CLAIM_BOUNDARY,
  OPERATOR_CHECK_RELIABILITY_WARNING_VISIBILITY_SOURCE,
  buildOperatorCheckResumeHandoffProjection,
  buildOperatorCheckReliabilityWarningVisibility,
  readOperatorCheckSnapshot,
} = require(path.join(repoRoot, "dist", "ops", "operator-check.js"));

const {
  buildRuntimeTokenCostPlanningWarnings,
} = require(path.join(repoRoot, "dist", "ops", "runtime-token-cost-planning-warning.js"));

const {
  buildCombinedReliabilityWarnings,
} = require(path.join(repoRoot, "dist", "ops", "combined-reliability-warning.js"));

const {
  SEQUENTIAL_PLANNING_HINT_CLAIM_BOUNDARY,
  buildSequentialPlanningHints,
} = require(path.join(repoRoot, "dist", "ops", "sequential-planning-hint.js"));

const {
  OPERATOR_CONTEXT_TRUST_RESEARCH_REFERENCE,
  OPERATOR_CONTEXT_TRUST_SOURCE,
} = require(path.join(repoRoot, "dist", "ops", "context-trust.js"));

const {
  PREFLIGHT_COMMAND,
  PREFLIGHT_SOURCE,
  buildPreflightPacket,
  renderPreflightText,
} = require(path.join(repoRoot, "dist", "ops", "preflight.js"));

function runWithCli(cliPath, args, cwd, envOverrides = {}) {
  return JSON.parse(execFileSync(process.execPath, [cliPath, ...args], { cwd, encoding: "utf8", env: { ...process.env, ...envOverrides } }));
}

function run(args, cwd, envOverrides = {}) {
  return runWithCli(cli, args, cwd, envOverrides);
}

function runText(args, cwd) {
  return execFileSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" });
}

function runNpmScript(script, args = []) {
  return JSON.parse(execFileSync("npm", ["run", "-s", script, "--", ...args], { cwd: repoRoot, encoding: "utf8" }));
}

function makeTempProject() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-activity-"));
  fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
  fs.writeFileSync(path.join(tempDir, "src", "index.ts"), "export const value = 1;\n");
  return tempDir;
}

function syntheticPreflightSnapshot({ current = [], nonAuthorizing = [], advisoryOnly = [], historicalOnly = [], verdict = "idleRequiresActiveArtifact", blockers = [] } = {}) {
  return {
    schemaVersion: 1,
    command: OPERATOR_CHECK_COMMAND,
    verdict,
    blockers,
    contextTrust: {
      schemaVersion: 1,
      source: OPERATOR_CONTEXT_TRUST_SOURCE,
      researchReference: OPERATOR_CONTEXT_TRUST_RESEARCH_REFERENCE,
      claimBoundary: "synthetic test contextTrust",
      sourceOfTruth: { current },
      advisoryOnly,
      historicalOnly,
      nonAuthorizing,
    },
  };
}

function writeExecutable(filePath, body) {
  fs.writeFileSync(filePath, body, { mode: 0o755 });
}

function makeNoTmuxServerCliFixture(tmuxError = "no server running on /tmp/tmux-1000/default\n") {
  const tempDir = fs.realpathSync(makeTempProject());
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-no-tmux-bin-"));
  const mainHead = "no-tmux-cli-main-head";
  writeExecutable(path.join(binDir, "tmux"), `#!/usr/bin/env node
process.stderr.write(${JSON.stringify(tmuxError)});
process.exit(1);
`);
  writeExecutable(path.join(binDir, "gh"), `#!/usr/bin/env node
const args = process.argv.slice(2).join(" ");
if (args.startsWith("issue list")) {
  process.stdout.write("[]");
  process.exit(0);
}
if (args.startsWith("pr list")) {
  process.stdout.write("[]");
  process.exit(0);
}
if (args.startsWith("run list")) {
  process.stdout.write("[]");
  process.exit(0);
}
process.stderr.write("unexpected gh " + args + "\\n");
process.exit(2);
`);
  writeExecutable(path.join(binDir, "git"), `#!/usr/bin/env node
const args = process.argv.slice(2);
const joined = args.join(" ");
const cwd = process.cwd();
const mainHead = ${JSON.stringify(mainHead)};
if (joined === "status --porcelain=v1 -z") process.exit(0);
if (joined === "symbolic-ref --quiet --short HEAD") {
  process.stdout.write("main\\n");
  process.exit(0);
}
if (joined === "rev-parse --abbrev-ref --symbolic-full-name @{u}") {
  process.stdout.write("origin/main\\n");
  process.exit(0);
}
if (joined === "rev-list --left-right --count HEAD...@{u}") {
  process.stdout.write("0\\t0\\n");
  process.exit(0);
}
if (joined === "config --get remote.origin.url") {
  process.stdout.write("git@github.com:minislively/fooks.git\\n");
  process.exit(0);
}
if (joined === "worktree list --porcelain") {
  process.stdout.write(["worktree " + cwd, "HEAD " + mainHead, "branch refs/heads/main", ""].join("\\n"));
  process.exit(0);
}
if (joined === "rev-parse --verify origin/main") {
  process.stdout.write(mainHead + "\\n");
  process.exit(0);
}
if (joined === "rev-parse HEAD") {
  process.stdout.write(mainHead + "\\n");
  process.exit(0);
}
if (joined === "branch --show-current") {
  process.stdout.write("main\\n");
  process.exit(0);
}
if (joined === "branch --format=%(refname:short)") {
  process.stdout.write("main\\n");
  process.exit(0);
}
if (joined === "branch -r --format=%(refname:short)") {
  process.stdout.write("origin/main\\n");
  process.exit(0);
}
if (joined === "branch --merged origin/main") {
  process.stdout.write("main\\n");
  process.exit(0);
}
if (joined === "diff --shortstat origin/main...HEAD") process.exit(0);
if (joined === "rev-list --left-right --count origin/main...HEAD") {
  process.stdout.write("0 0\\n");
  process.exit(0);
}
process.stderr.write("unexpected git " + joined + "\\n");
process.exit(2);
`);
  return { tempDir, env: { PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}` } };
}

function makeActiveReceiptCliFixture() {
  const tempDir = fs.realpathSync(makeTempProject());
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-active-receipt-bin-"));
  const branch = "dogfood/issue-998-current-run-receipt-cli";
  const head = "active-receipt-cli-head";
  writeExecutable(path.join(binDir, "tmux"), `#!/usr/bin/env node
const cwd = process.cwd();
process.stdout.write("fooks-998\\t" + cwd + "\\tzsh\\t%98\\n");
`);
  writeExecutable(path.join(binDir, "gh"), `#!/usr/bin/env node
const args = process.argv.slice(2).join(" ");
if (args.startsWith("issue list")) {
  process.stdout.write("[{\\"number\\":998}]");
  process.exit(0);
}
if (args.startsWith("pr list")) {
  process.stdout.write("[]");
  process.exit(0);
}
if (args.startsWith("run list")) {
  process.stdout.write("[]");
  process.exit(0);
}
process.stderr.write("unexpected gh " + args + "\\n");
process.exit(2);
`);
  writeExecutable(path.join(binDir, "git"), `#!/usr/bin/env node
const args = process.argv.slice(2);
const joined = args.join(" ");
const cwd = process.cwd();
const branch = ${JSON.stringify(branch)};
const head = ${JSON.stringify(head)};
if (joined === "status --porcelain=v1 -z") process.exit(0);
if (joined === "symbolic-ref --quiet --short HEAD") {
  process.stdout.write(branch + "\\n");
  process.exit(0);
}
if (joined === "rev-parse --abbrev-ref --symbolic-full-name @{u}") {
  process.stdout.write("origin/main\\n");
  process.exit(0);
}
if (joined === "rev-list --left-right --count HEAD...@{u}") {
  process.stdout.write("1\\t0\\n");
  process.exit(0);
}
if (joined === "config --get remote.origin.url") {
  process.stdout.write("git@github.com:minislively/fooks.git\\n");
  process.exit(0);
}
if (joined === "worktree list --porcelain") {
  process.stdout.write(["worktree " + cwd, "HEAD " + head, "branch refs/heads/" + branch, ""].join("\\n"));
  process.exit(0);
}
if (joined === "rev-parse --verify origin/main") {
  process.stdout.write("origin-main-head\\n");
  process.exit(0);
}
if (joined === "rev-parse HEAD") {
  process.stdout.write(head + "\\n");
  process.exit(0);
}
if (joined === "branch --show-current") {
  process.stdout.write(branch + "\\n");
  process.exit(0);
}
if (joined === "branch --format=%(refname:short)") {
  process.stdout.write(branch + "\\nmain\\n");
  process.exit(0);
}
if (joined === "branch -r --format=%(refname:short)") {
  process.stdout.write("origin/main\\n");
  process.exit(0);
}
if (joined === "branch --merged origin/main") {
  process.stdout.write("main\\n");
  process.exit(0);
}
if (joined === "diff --shortstat origin/main...HEAD") process.exit(0);
if (joined === "rev-list --left-right --count origin/main...HEAD") {
  process.stdout.write("1 0\\n");
  process.exit(0);
}
process.stderr.write("unexpected git " + joined + "\\n");
process.exit(2);
`);
  return { tempDir, env: { PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}` } };
}

function assertPostMergeMainCiDiagnostic(item, { workflow, reason, headSha }) {
  assert.equal(item.workflow, workflow);
  assert.equal(item.diagnostic.source, OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_SOURCE);
  assert.equal(item.diagnostic.apiSurface, "gh run list");
  assert.match(item.diagnostic.command, /^gh run list --branch main --limit 50 --json /);
  assert.match(item.diagnostic.lookup, new RegExp(`workflowName=${workflow.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.match(item.diagnostic.lookup, /branch=main/);
  assert.match(item.diagnostic.lookup, /no git fetch or mutation performed/);
  if (headSha) assert.match(item.diagnostic.lookup, new RegExp(`headSha=${headSha}`));
  assert.equal(item.diagnostic.reason, reason);
  assert.match(item.diagnostic.remoteFreshnessCaveat, /remote freshness not verified/);
  assert.match(item.diagnostic.remoteFreshnessCaveat, /not fetched/);
}

function readOperatorActivitySnapshotWithGhRunListError(detail) {
  const tempDir = makeTempProject();
  const mainHead = `main-head-${detail.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  const snapshot = readOperatorActivitySnapshot(tempDir, {
    includeRemoteCounts: true,
    now: () => "2026-05-12T11:30:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return "";
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "gh" && args[0] === "run") throw new Error(detail);
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, `HEAD ${mainHead}`, "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return `${mainHead}\n`;
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });
  return { snapshot, mainHead };
}

function tmuxNoServerError(socket = "/tmp/tmux-1000/default", stream = "stderr") {
  const error = new Error(`Command failed: tmux list-panes -a -F #{session_name}\t#{pane_current_path}`);
  const output = `no server running on ${socket}\n`;
  error[stream] = stream === "output" ? [null, output, ""] : output;
  error.code = 1;
  return error;
}

test("preflight builder projects synthetic contextTrust without evidence reads", () => {
  const preflightSource = fs.readFileSync(path.join(repoRoot, "src", "ops", "preflight.ts"), "utf8");
  const operatorCheckSource = fs.readFileSync(path.join(repoRoot, "src", "ops", "operator-check.ts"), "utf8");
  assert.doesNotMatch(preflightSource, /node:(?:fs|child_process)/);
  assert.doesNotMatch(preflightSource, /\bexecFileSync\b|\bspawnSync\b|\breadFileSync\b/);
  assert.doesNotMatch(operatorCheckSource, /preflight/);

  const mainEchoEntry = {
    kind: "main-echo-boundary",
    source: OPERATOR_ACTIVITY_CURRENT_RUN_SOURCE,
    reason: "main echo only",
    referenceField: "postMergeMainEchoBoundary",
    live: true,
    authority: "insufficient",
    contractScope: "main-echo-boundary",
  };
  const noAuthority = buildPreflightPacket(syntheticPreflightSnapshot({ nonAuthorizing: [mainEchoEntry] }));
  assert.equal(noAuthority.schemaVersion, 1);
  assert.equal(noAuthority.command, PREFLIGHT_COMMAND);
  assert.equal(noAuthority.source, PREFLIGHT_SOURCE);
  assert.equal(noAuthority.derivedFrom.operatorCheckCommand, OPERATOR_CHECK_COMMAND);
  assert.equal(noAuthority.derivedFrom.operatorCheckSchemaVersion, 1);
  assert.equal(noAuthority.derivedFrom.contextTrustSchemaVersion, 1);
  assert.equal(noAuthority.summary.authorityStatus, "missing");
  assert.equal(noAuthority.guidance.riskLevel, "high");
  assert.equal(noAuthority.guidance.recommendedAction, "create-or-link-active-artifact");
  assert.equal(noAuthority.currentAuthority.length, 0);
  assert.equal(noAuthority.nonAuthorizing[0].contractScope, "main-echo-boundary");
  const noAuthorityText = renderPreflightText(noAuthority);
  assert.match(noAuthorityText, /Preflight: BLOCK - active authority needed/);
  assert.match(noAuthorityText, /Risk: high/);
  assert.match(noAuthorityText, /Action: create-or-link-active-artifact/);
  assert.match(noAuthorityText, /Do not treat as current:/);
  assert.match(noAuthorityText, /main-echo-boundary/);
  assert.match(noAuthorityText, /no cleanup, authority creation, hook enforcement, or new evidence collection was performed/);

  const handoff = buildPreflightPacket(syntheticPreflightSnapshot({
    nonAuthorizing: [
      {
        kind: "live-non-main-worktree-handoff-candidate",
        source: "activeWorkReceipts.handoffArtifactEvidence",
        reason: "live handoff candidate only",
        referenceField: "activeWorkReceipts.handoffArtifactEvidence.currentEvidence.liveNonMainWorktreePresent",
        live: true,
        authority: "handoff-candidate",
        contractScope: "handoff-artifact-boundary",
      },
    ],
  }));
  assert.equal(handoff.summary.authorityStatus, "missing");
  assert.equal(handoff.guidance.riskLevel, "high");
  assert.equal(handoff.guidance.recommendedAction, "adopt-or-report-live-handoff");
  assert.equal(handoff.currentAuthority.some((entry) => entry.kind === "worktree"), false);
  assert.equal(handoff.nonAuthorizing[0].contractScope, "handoff-artifact-boundary");

  const mappedSessionWithCaveat = buildPreflightPacket(syntheticPreflightSnapshot({
    current: [
      {
        kind: "session",
        source: OPERATOR_ACTIVITY_TMUX_COMMAND,
        reason: "mapped session count-only current-work presence",
        referenceField: "activeArtifacts",
        count: 1,
        authority: "current-work",
        contractScope: "top-level-active-artifact",
      },
    ],
    nonAuthorizing: [
      {
        kind: "mapped-session-live-handoff-caveat",
        source: "activeWorkReceipts.handoffArtifactEvidence",
        reason: "mapped session lacks live handoff",
        referenceField: "activeWorkReceipts.handoffArtifactEvidence.currentEvidence.liveMappedFooksTmuxSessionCount",
        count: 1,
        live: false,
        authority: "insufficient",
        contractScope: "handoff-artifact-boundary",
      },
    ],
  }));
  assert.equal(mappedSessionWithCaveat.summary.authorityStatus, "present");
  assert.equal(mappedSessionWithCaveat.guidance.riskLevel, "medium");
  assert.equal(mappedSessionWithCaveat.guidance.recommendedAction, "continue-with-current-authority");
  assert.equal(mappedSessionWithCaveat.currentAuthority[0].contractScope, "top-level-active-artifact");
  assert.equal("number" in mappedSessionWithCaveat.currentAuthority[0], false);
  const mappedSessionText = renderPreflightText(mappedSessionWithCaveat);
  assert.match(mappedSessionText, /Preflight: WARN - continue with caution/);
  assert.match(mappedSessionText, /Current authority:/);
  assert.match(mappedSessionText, /session \(count=1, authority=current-work, scope=top-level-active-artifact\)/);
  assert.match(mappedSessionText, /Do not treat as current:/);

  const blocked = buildPreflightPacket(syntheticPreflightSnapshot({
    verdict: "blocked",
    blockers: ["tmux unavailable"],
  }));
  assert.equal(blocked.summary.authorityStatus, "blocked");
  assert.equal(blocked.guidance.riskLevel, "high");
  assert.equal(blocked.guidance.recommendedAction, "resolve-blockers-first");
  assert.match(renderPreflightText(blocked), /Preflight: BLOCK - resolve blockers first/);

  const staleResidue = buildPreflightPacket(syntheticPreflightSnapshot({
    current: [
      {
        kind: "issue",
        source: "synthetic issue list",
        reason: "count-only current-work presence",
        referenceField: "activeArtifacts",
        count: 3,
        authority: "current-work",
        contractScope: "top-level-active-artifact",
      },
    ],
    nonAuthorizing: [
      {
        kind: "stale-residue-active-boundary",
        source: "synthetic stale residue",
        reason: "cleanup-review context only",
        referenceField: "activeWorkReceipts.staleResidueActiveBoundary",
        count: 114,
        authority: "insufficient",
        contractScope: "stale-residue-boundary",
      },
      {
        kind: "local-only-residue-active-boundary",
        source: "synthetic local-only residue",
        reason: "local-only cleanup-review context only",
        referenceField: "activeWorkReceipts.localOnlyResidueActiveBoundary",
        count: 114,
        authority: "insufficient",
        contractScope: "cleanup-review-boundary",
      },
    ],
    advisoryOnly: [
      {
        kind: "required-active-artifact-guidance",
        source: "requiredActiveArtifact",
        reason: "active artifact present",
        referenceField: "requiredActiveArtifact",
        authority: "guidance",
        contractScope: "active-artifact-guidance",
      },
    ],
    historicalOnly: [
      {
        kind: "post-merge-main-ci-receipt",
        source: "synthetic CI receipt",
        reason: "historical receipt only",
        referenceField: "postMergeMainCiEvidence",
        count: 2,
        authority: "receipt",
        contractScope: "post-merge-receipt",
      },
    ],
  }));
  const staleResidueText = renderPreflightText(staleResidue);
  assert.match(staleResidueText, /Preflight: OK to continue/);
  assert.match(staleResidueText, /Current authority:/);
  assert.match(staleResidueText, /issue \(count=3, authority=current-work, scope=top-level-active-artifact\)/);
  assert.match(staleResidueText, /Do not treat as current:/);
  assert.match(staleResidueText, /stale-residue-active-boundary \(count=114, authority=insufficient, scope=stale-residue-boundary\)/);
  assert.match(staleResidueText, /local-only-residue-active-boundary \(count=114, authority=insufficient, scope=cleanup-review-boundary\)/);
  assert.match(staleResidueText, /Notes:/);
  assert.match(staleResidueText, /historical receipts present:/);
  assert.match(staleResidueText, /stale\/local-only residue is cleanup-review context, not active-work authority/);
});

test("operator reminder docs require a blocker or active artifact after clean CI/React echoes", () => {
  const boundaryDoc = fs.readFileSync(path.join(repoRoot, "docs", "post-merge-main-ci-echo-boundary.md"), "utf8");
  const dogfoodDoc = fs.readFileSync(path.join(repoRoot, "docs", "dogfood", "clean-merge-reminder-action-803.md"), "utf8");
  const issue823Doc = fs.readFileSync(path.join(repoRoot, "docs", "dogfood", "post-merge-react-web-ci-echo-anchor-823.md"), "utf8");
  const issue832Doc = fs.readFileSync(path.join(repoRoot, "docs", "dogfood", "check-clean-main-ci-echo-832.md"), "utf8");
  const issue857Doc = fs.readFileSync(path.join(repoRoot, "docs", "dogfood", "clean-slate-development-reminder-857.md"), "utf8");
  const issue863Doc = fs.readFileSync(path.join(repoRoot, "docs", "dogfood", "green-receipt-next-anchor-863.md"), "utf8");
  const issue865Doc = fs.readFileSync(path.join(repoRoot, "docs", "dogfood", "clean-slate-legacy-review-worktree-residue-865.md"), "utf8");
  const issue867Doc = fs.readFileSync(path.join(repoRoot, "docs", "dogfood", "post-receipt-nudge-anchor-867.md"), "utf8");
  const issue869Doc = fs.readFileSync(path.join(repoRoot, "docs", "dogfood", "receipt-only-nudge-loop-anchor-869.md"), "utf8");

  assert.match(boundaryDoc, /A development reminder must not end as a status-only idle report/);
  assert.match(boundaryDoc, /create\/adopt one active artifact/);
  assert.match(boundaryDoc, /issue, branch, session, or PR/);
  assert.match(boundaryDoc, /Blocker and no-blocker reports\s+must both keep the concrete next action explicit/);
  assert.match(boundaryDoc, /requiredActiveArtifact\.dogfoodHandoff/);
  assert.match(boundaryDoc, /requires-live-artifact/);
  assert.match(boundaryDoc, /ci-echo-and-stale-residue-are-not-active-work/);
  assert.match(dogfoodDoc, /issue #803/i);
  assert.match(dogfoodDoc, /must not repeat clean status as the next development action/);
  assert.match(dogfoodDoc, /report a real blocker/);
  assert.match(dogfoodDoc, /create or adopt one active issue, branch, session, or PR evidence artifact/);
  assert.match(dogfoodDoc, /Clean CI, clean React Web release-report echoes, and stale\s+local worktree inventory are verification or review receipts only/);
  assert.equal(/must repeat clean status as the next development action/.test(dogfoodDoc), false);
  assert.match(issue823Doc, /issue #823/i);
  assert.match(issue823Doc, /post-merge React Web CI or release-report nudge must stay non-active unless a\s+fresh active artifact exists/);
  assert.match(issue823Doc, /fresh active issue, branch, session, or PR/);
  assert.match(issue823Doc, /green CI, a successful release report, or\s+legacy local worktree residue as the active-work reason/);
  assert.match(issue823Doc, /not cleanup authority/);
  assert.match(issue832Doc, /issue #832/i);
  assert.match(issue832Doc, /`fooks check` must not\s+end as a status recap/);
  assert.match(issue832Doc, /create or adopt exactly one bounded active\s+artifact first/);
  assert.match(issue832Doc, /report only that artifact as the next development anchor/);
  assert.match(issue832Doc, /verification or inventory\s+receipts only/);
  assert.match(issue832Doc, /not change runtime\/provider behavior/);
  assert.match(issue857Doc, /issue #857/i);
  assert.match(issue857Doc, /main head: `a5d9ba1`/);
  assert.match(issue857Doc, /open PR\/issues: `0\/0`/);
  assert.match(issue857Doc, /Blocker report:[\s\S]*concrete next action required/);
  assert.match(issue857Doc, /No-blocker report:[\s\S]*concrete active issue, branch,\s+session, or PR anchor/);
  assert.match(issue857Doc, /no active issue\/branch\/session\/PR is currently\s+attached/);
  assert.match(issue857Doc, /branch `er\/clean-slate-reminder-857`/);
  assert.match(issue857Doc, /node --test test\/operator-activity\.test\.mjs test\/post-merge-main-ci-echo-boundary-doc\.test\.mjs/);
  assert.match(issue857Doc, /does not change provider\s+behavior, merge gates, detector scope, frontend behavior, cleanup policy,\s+performance claims, or product claims/);
  assert.match(issue863Doc, /issue #863/i);
  assert.match(issue863Doc, /final green post-merge `main` receipts from the next fooks\s+development anchor/);
  assert.match(issue863Doc, /both `main` CI and the React Web release-report\s+green/);
  assert.match(issue863Doc, /final verification receipts only/);
  assert.match(issue863Doc, /neither receipt is a concrete next-development anchor by itself/);
  assert.match(issue863Doc, /create or adopt one concrete issue, branch, session,\s+or PR artifact/);
  assert.match(issue863Doc, /report the concrete blocker that prevents creating or\s+adopting an issue, branch, session, or PR artifact/);
  assert.match(issue863Doc, /must not repeat the final green `main` CI receipt or React Web\s+release-report receipt as the answer/);
  assert.match(issue863Doc, /branch `dogfood\/issue-863-green-receipt-next-anchor`/);
  assert.match(issue863Doc, /node --test test\/operator-activity\.test\.mjs test\/post-merge-main-ci-echo-boundary-doc\.test\.mjs/);
  assert.match(issue863Doc, /does not\s+change runtime\/provider behavior, merge-gate policy, detector scope, React Web\s+behavior, React Native behavior, TUI behavior, WebView behavior, performance\s+claims, or product claims/);
  assert.match(issue865Doc, /issue #865/i);
  assert.match(issue865Doc, /old local review\s+worktrees as active development after open PR\/issues and live sessions are zero/);
  assert.match(issue865Doc, /legacy review-worktree residue is stale\/manual-review evidence\s+only/);
  assert.match(issue865Doc, /active issue evidence/);
  assert.match(issue865Doc, /active non-`main` branch evidence/);
  assert.match(issue865Doc, /active mapped fooks session evidence/);
  assert.match(issue865Doc, /active PR evidence/);
  assert.match(issue865Doc, /concrete blocker/);
  assert.match(issue865Doc, /legacyReviewWorktreeResidueBoundary/);
  assert.match(issue865Doc, /classification: "stale-manual-review-evidence"/);
  assert.match(issue865Doc, /satisfiesActiveDevelopmentRequirement: false/);
  assert.match(issue865Doc, /does not delete legacy worktrees/);
  assert.match(issue865Doc, /change runtime\/provider behavior/);
  assert.match(issue865Doc, /change merge-gate\s+policy/);
  assert.match(issue865Doc, /broaden detector scope/);
  assert.match(issue865Doc, /change React Web\/RN\/TUI\/WebView behavior/);
  assert.match(issue865Doc, /performance claims/);
  assert.match(issue865Doc, /product claims/);
  assert.match(issue867Doc, /issue #867/i);
  assert.match(issue867Doc, /PR #866/);
  assert.match(issue867Doc, /main CI\/release success is a receipt/);
  assert.match(issue867Doc, /fresh post-receipt nudge/);
  assert.match(issue867Doc, /new issue, branch, session, PR anchor, or concrete blocker/);
  assert.match(issue867Doc, /postReceiptNudgeAnchorBoundary/);
  assert.match(issue867Doc, /requiresFreshPostReceiptNudgeAnchor: true/);
  assert.match(issue867Doc, /mainCiReleaseSuccessReceipt/);
  assert.match(issue867Doc, /activeDevelopmentEvidence: false/);
  assert.match(issue867Doc, /does not change runtime\/provider behavior/);
  assert.match(issue867Doc, /merge-gate policy/);
  assert.match(issue867Doc, /detector scope/);
  assert.match(issue867Doc, /React Web\/RN\/TUI\/WebView behavior/);
  assert.match(issue867Doc, /performance claims/);
  assert.match(issue867Doc, /product claims/);
  assert.match(issue869Doc, /issue #869/i);
  assert.match(issue869Doc, /PR #868/);
  assert.match(issue869Doc, /successful `main` CI\s+run was already recorded as a receipt/);
  assert.match(issue869Doc, /newly created or adopted issue evidence/);
  assert.match(issue869Doc, /mapped OMX session evidence/);
  assert.match(issue869Doc, /must not reuse the last merged commit, the successful\s+`main` CI run, or any release receipt/);
  assert.match(issue869Doc, /receiptOnlyNudgeLoopBoundary/);
  assert.match(issue869Doc, /requiresIssueAndOmxSessionEvidence: true/);
  assert.match(issue869Doc, /satisfiesNudgeReportAnchorRequirement: false/);
  assert.match(issue869Doc, /repeatedReceiptOnlyReportAllowed: false/);
  assert.match(issue869Doc, /does not change runtime\/provider behavior/);
  assert.match(issue869Doc, /merge-gate policy/);
  assert.match(issue869Doc, /detector scope/);
  assert.match(issue869Doc, /React Web\/RN\/TUI\/WebView behavior/);
  assert.match(issue869Doc, /performance claims/);
  assert.match(issue869Doc, /product\s+claims/);
});

test("parseOperatorActivityTmuxPanes parses tab-delimited session, path, and command", () => {
  assert.deepEqual(parseOperatorActivityTmuxPanes("fooks-a\t/tmp/fooks\tzsh\nother\t/tmp/other\tnode\n"), [
    { session: "fooks-a", path: "/tmp/fooks", command: "zsh" },
    { session: "other", path: "/tmp/other", command: "node" },
  ]);
});

test("operator activity snapshot is local-first and does not call remote counts unless explicitly enabled", () => {
  const tempDir = makeTempProject();
  const calls = [];
  const snapshot = readOperatorActivitySnapshot(tempDir, {
    now: () => "2026-05-03T22:10:00.000Z",
    runner: () => " M src/index.ts\0?? notes.md\0",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "dogfood/issue-424\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "2\t1\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      calls.push([command, ...args].join(" "));
      if (command === "gh") throw new Error("gh must not be called by default");
      return `fooks-dogfood\t${tempDir}\tzsh\nnot-related\t/tmp/elsewhere\tzsh\n`;
    },
  });

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.command, OPERATOR_ACTIVITY_COMMAND);
  assert.equal(snapshot.claimBoundary, OPERATOR_ACTIVITY_CLAIM_BOUNDARY);
  assert.equal(snapshot.readOnly, true);
  assert.equal(snapshot.generatedAt, "2026-05-03T22:10:00.000Z");
  assert.equal(snapshot.worktree.branch, "dogfood/issue-424");
  assert.equal(snapshot.worktree.upstream, "origin/main");
  assert.equal(snapshot.worktree.ahead, 2);
  assert.equal(snapshot.worktree.behind, 1);
  assert.equal(snapshot.worktree.clean, false);
  assert.equal(snapshot.worktree.delta.source, "current git status only; no session baseline comparison");
  assert.deepEqual(snapshot.worktree.delta.changedPaths, ["notes.md", "src/index.ts"]);
  assert.equal(snapshot.tmux.available, true);
  assert.equal(snapshot.tmux.command, OPERATOR_ACTIVITY_TMUX_COMMAND);
  assert.equal(snapshot.tmux.sessions.length, 1);
  assert.equal(snapshot.tmux.sessions[0].session, "fooks-dogfood");
  assert.equal(snapshot.optionalCounts.enabled, false);
  assert.match(snapshot.optionalCounts.source, /--include-remote-counts/);
  assert.equal(calls.some((call) => call.startsWith("gh ")), false);
});

test("idle activity snapshot remains zero and read-only with opt-in remote counts", () => {
  const tempDir = makeTempProject();
  const commandCalls = [];
  const gitCalls = [];
  const snapshot = readOperatorActivitySnapshot(tempDir, {
    includeRemoteCounts: true,
    now: () => "2026-05-04T02:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      gitCalls.push(args.join(" "));
      if (args[0] === "fetch") throw new Error("status activity must not fetch");
      if (args[0] === "symbolic-ref") return "dogfood/issue-428-idle-activity-snapshot\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      commandCalls.push([command, ...args].join(" "));
      if (command === "tmux") return "not-related\t/tmp/no-active-pane\tzsh\nalso-other\t/tmp/elsewhere\tnode\n";
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      throw new Error(`unexpected command ${command} ${args.join(" ")}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.command, OPERATOR_ACTIVITY_COMMAND);
  assert.equal(snapshot.generatedAt, "2026-05-04T02:00:00.000Z");
  assert.equal(snapshot.cwd, tempDir);
  assert.equal(snapshot.claimBoundary, OPERATOR_ACTIVITY_CLAIM_BOUNDARY);
  assert.equal(snapshot.readOnly, true);
  assert.equal(snapshot.worktree.clean, true);
  assert.equal(snapshot.worktree.verdict.kind, "clean");
  assert.equal(snapshot.worktree.branch, "dogfood/issue-428-idle-activity-snapshot");
  assert.equal(snapshot.worktree.upstream, "origin/main");
  assert.equal(snapshot.worktree.ahead, 0);
  assert.equal(snapshot.worktree.behind, 0);
  assert.equal(snapshot.worktree.divergenceSource, "local tracking refs only; no fetch performed");
  assert.deepEqual(snapshot.worktree.delta, {
    source: "current git status only; no session baseline comparison",
    changedPathCount: 0,
    trackedPathCount: 0,
    untrackedPathCount: 0,
    conflictedPathCount: 0,
    changedPaths: [],
    conflictedPaths: [],
  });
  assert.deepEqual(snapshot.worktree.blockers, []);
  assert.equal(snapshot.tmux.available, true);
  assert.equal(snapshot.tmux.command, OPERATOR_ACTIVITY_TMUX_COMMAND);
  assert.deepEqual(snapshot.tmux.sessions, []);
  assert.deepEqual(snapshot.tmux.blockers, []);
  assert.deepEqual(snapshot.optionalCounts, {
    enabled: true,
    source: OPERATOR_ACTIVITY_REMOTE_SOURCE,
    openIssues: 0,
    openPullRequests: 0,
    blockers: [],
  });
  assert.deepEqual(snapshot.currentRunEvidence, {
    available: true,
    source: OPERATOR_ACTIVITY_CURRENT_RUN_SOURCE,
    claimBoundary: OPERATOR_ACTIVITY_CURRENT_RUN_CLAIM_BOUNDARY,
    classification: "activeOrUnknown",
    mainEchoEvidence: false,
    activeWorkEvidence: true,
    remoteCountsRequired: true,
    evidence: {
      branch: "dogfood/issue-428-idle-activity-snapshot",
      upstream: "origin/main",
      clean: true,
      ahead: 0,
      behind: 0,
      fooksSessionCount: 0,
      openIssues: 0,
      openPullRequests: 0,
      legacyStaleClosedArtifactWorktreeCount: 0,
    },
    receipt: {
      status: "active",
      active: true,
      oneLine: "Current fooks run appears active: branch dogfood/issue-428-idle-activity-snapshot.",
      evidenceKinds: ["branch"],
      advisoryOnly: true,
      readOnly: true,
      claimBoundary: OPERATOR_ACTIVITY_CURRENT_RUN_CLAIM_BOUNDARY,
    },
    reasons: [
      "current branch is dogfood/issue-428-idle-activity-snapshot, not main",
      "current worktree is clean",
      "local tracking divergence is zero",
      "no fooks-like tmux sessions are mapped to this snapshot",
      "open issue and pull request counts are both zero",
    ],
    blockers: [],
  });
  assert.deepEqual(snapshot.blockers, []);
  assert.equal(commandCalls.filter((call) => call.startsWith("gh ")).length, 3);
  assert.equal(gitCalls.some((call) => call.includes("fetch")), false);
});

test("operator activity reports exact-head post-merge main CI and release-report conclusions", () => {
  const tempDir = makeTempProject();
  const mainHead = "abc123main";
  const calls = [];
  const runs = [
    {
      databaseId: 101,
      status: "completed",
      conclusion: "success",
      updatedAt: "2026-05-12T10:00:00Z",
      headBranch: "main",
      headSha: mainHead,
      event: "push",
      workflowName: "CI",
      url: "https://github.com/minislively/fooks/actions/runs/101",
    },
    {
      databaseId: 102,
      status: "completed",
      conclusion: "success",
      updatedAt: "2026-05-12T10:05:00Z",
      headBranch: "main",
      headSha: mainHead,
      event: "push",
      workflowName: "React Web Release Report",
      url: "https://github.com/minislively/fooks/actions/runs/102",
    },
    {
      databaseId: 99,
      status: "completed",
      conclusion: "success",
      updatedAt: "2026-05-12T09:00:00Z",
      headBranch: "main",
      headSha: "stale-premerge",
      event: "push",
      workflowName: "CI",
      url: "https://github.com/minislively/fooks/actions/runs/99",
    },
  ];
  const snapshot = readOperatorActivitySnapshot(tempDir, {
    includeRemoteCounts: true,
    now: () => "2026-05-12T10:10:00.000Z",
    runner: () => "",
    gitRunner: /** @param {string} _cwd @param {string[]} args */ (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      calls.push([command, ...args].join(" "));
      const joined = args.join(" ");
      if (command === "tmux") return "";
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "gh" && args[0] === "run") return JSON.stringify(runs);
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, `HEAD ${mainHead}`, "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return `${mainHead}\n`;
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.postMergeMainCiEvidence.available, true);
  assert.equal(snapshot.postMergeMainCiEvidence.source, OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_SOURCE);
  assert.equal(snapshot.postMergeMainCiEvidence.claimBoundary, OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_CLAIM_BOUNDARY);
  assert.equal(snapshot.postMergeMainCiEvidence.readOnly, true);
  assert.equal(snapshot.postMergeMainCiEvidence.exactHeadRequired, true);
  assert.equal(snapshot.postMergeMainCiEvidence.mainRef, "origin/main");
  assert.equal(snapshot.postMergeMainCiEvidence.mainHeadSource, "local origin/main tracking ref; no fetch performed");
  assert.equal(snapshot.postMergeMainCiEvidence.remoteFreshness, "not verified");
  assert.equal(snapshot.postMergeMainCiEvidence.mainHead, mainHead);
  assert.deepEqual(snapshot.postMergeMainCiEvidence.summary, {
    exactHeadWorkflowCount: 2,
    successCount: 2,
    pendingCount: 0,
    unknownCount: 0,
    failureCount: 0,
    allExactHeadConclusionsSuccessful: true,
  });
  assert.deepEqual(snapshot.postMergeMainCiEvidence.workflowEvidence.map((item) => [item.workflow, item.status, item.headSha]), [
    ["CI", "success", mainHead],
    ["React Web Release Report", "success", mainHead],
  ]);
  assert.equal(calls.some((call) => /fetch|delete/.test(call)), false);
});


test("operator activity snapshot emits read-only subphase timing diagnostics", () => {
  const tempDir = makeTempProject();
  const snapshot = readOperatorActivitySnapshot(tempDir, {
    includeRemoteCounts: true,
    now: () => "2026-05-21T08:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return "";
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "git" && joined === "rev-parse --verify origin/main") return "activity-main-head\n";
      if (command === "gh" && args[0] === "run") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD activity-main-head", "branch refs/heads/main", ""].join("\n");
      }
      throw new Error(`unexpected command: ${command} ${joined}`);
    },
  });

  const receipt = snapshot.diagnostics.operatorActivityTiming;
  assert.equal(receipt.status, "diagnostic");
  assert.equal(receipt.readOnly, true);
  assert.match(receipt.claimBoundary, /Diagnostic\/read-only/);
  assert.match(receipt.claimBoundary, /not current-work authority/);
  assert.ok(Number.isFinite(receipt.totalMs));
  assert.ok(receipt.totalMs >= 0);
  const phaseNames = receipt.phases.map((phase) => phase.name);
  assert.ok(phaseNames.includes("current-worktree-evidence-status"));
  assert.ok(phaseNames.includes("read-tmux-activity"));
  assert.ok(phaseNames.includes("read-remote-counts"));
  assert.ok(phaseNames.includes("read-legacy-worktree-evidence"));
  assert.ok(phaseNames.includes("read-post-merge-main-ci-evidence"));
  for (const phase of receipt.phases) {
    assert.equal(phase.status, "ok");
    assert.ok(Number.isFinite(phase.elapsedMs));
    assert.ok(phase.elapsedMs >= 0);
  }
});

test("operator check snapshot emits narrow timing diagnostics without changing authority fields", () => {
  const tempDir = makeTempProject();
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-21T08:05:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return "";
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "rev-parse --verify origin/main") return "check-main-head\n";
      if (command === "gh" && args[0] === "run") return "[]";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD check-main-head", "branch refs/heads/main", ""].join("\n");
      }
      throw new Error(`unexpected command: ${command} ${joined}`);
    },
  });

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.command, OPERATOR_CHECK_COMMAND);
  assert.equal(snapshot.readOnly, true);
  assert.equal(snapshot.source, OPERATOR_CHECK_SOURCE);
  assert.equal(snapshot.contextTrust.source, OPERATOR_CONTEXT_TRUST_SOURCE);

  const receipt = snapshot.diagnostics.operatorCheckTiming;
  assert.equal(receipt.status, "diagnostic");
  assert.equal(receipt.readOnly, true);
  assert.match(receipt.claimBoundary, /not current-work authority/);
  assert.match(receipt.claimBoundary, /not handoff\/source-of-truth authority/);
  assert.ok(Number.isFinite(receipt.totalMs));
  assert.ok(receipt.totalMs >= 0);
  const phaseNames = receipt.phases.map((phase) => phase.name);
  assert.ok(phaseNames.includes("read-operator-activity-snapshot"));
  assert.ok(phaseNames.includes("build-active-work-receipts"));
  assert.ok(phaseNames.includes("build-active-work-receipts:repo-identity"));
  assert.ok(phaseNames.includes("build-active-work-receipts:base-identifiers"));
  assert.ok(phaseNames.includes("build-active-work-receipts:sibling-worktree-triage"));
  assert.ok(phaseNames.includes("build-active-work-receipts:legacy-local-residue-cleanup-review"));
  assert.ok(phaseNames.includes("read-sequential-planning-prompt"));
  assert.ok(phaseNames.includes("read-operator-check-runtime-provenance"));
  assert.ok(snapshot.activity.diagnostics.operatorActivityTiming.phases.some((phase) => phase.name === "read-remote-counts"));
  assert.ok(snapshot.activity.diagnostics.operatorActivityTiming.phases.some((phase) => phase.name === "read-post-merge-main-ci-evidence"));
  for (const phase of receipt.phases) {
    assert.equal(phase.status, "ok");
    assert.ok(Number.isFinite(phase.elapsedMs));
    assert.ok(phase.elapsedMs >= 0);
  }
});

test("operator check keeps missing exact-head workflow evidence unknown instead of success", () => {
  const tempDir = makeTempProject();
  const mainHead = "new-main-head";
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-12T11:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: /** @param {string} command @param {string[]} args */ (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return "";
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "rev-parse --verify origin/main") return `${mainHead}\n`;
      if (command === "gh" && args[0] === "run") {
        return JSON.stringify([
          {
            databaseId: 201,
            status: "completed",
            conclusion: "success",
            updatedAt: "2026-05-12T10:30:00Z",
            headBranch: "main",
            headSha: "old-main-head",
            event: "push",
            workflowName: "CI",
            url: "https://github.com/minislively/fooks/actions/runs/201",
          },
          {
            databaseId: 202,
            status: "in_progress",
            conclusion: "",
            updatedAt: "2026-05-12T10:35:00Z",
            headBranch: "main",
            headSha: mainHead,
            event: "push",
            workflowName: "React Web Release Report",
            url: "https://github.com/minislively/fooks/actions/runs/202",
          },
        ]);
      }
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, `HEAD ${mainHead}`, "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.postMergeMainCiEvidence.mainHead, mainHead);
  assert.deepEqual(snapshot.postMergeMainCiEvidence.workflowEvidence.map((item) => [item.workflow, item.status]), [
    ["CI", "unknown"],
    ["React Web Release Report", "pending"],
  ]);
  assertPostMergeMainCiDiagnostic(snapshot.postMergeMainCiEvidence.workflowEvidence[0], {
    workflow: "CI",
    reason: "empty-run",
    headSha: mainHead,
  });
  assertPostMergeMainCiDiagnostic(snapshot.postMergeMainCiEvidence.workflowEvidence[1], {
    workflow: "React Web Release Report",
    reason: "pending",
    headSha: mainHead,
  });
  assert.equal(snapshot.postMergeMainCiEvidence.summary.successCount, 0);
  assert.equal(snapshot.postMergeMainCiEvidence.summary.unknownCount, 1);
  assert.equal(snapshot.postMergeMainCiEvidence.summary.pendingCount, 1);
  assert.equal(snapshot.postMergeMainCiEvidence.summary.allExactHeadConclusionsSuccessful, false);
  assert.equal(snapshot.activity.postMergeMainCiEvidence, snapshot.postMergeMainCiEvidence);
});

test("operator activity diagnoses unavailable exact-head workflow lookups by bounded failure reason", () => {
  for (const { detail, reason } of [
    { detail: "HTTP 401 Bad credentials", reason: "auth" },
    { detail: "HTTP 429 API rate limit exceeded", reason: "rate-limit" },
  ]) {
    const { snapshot, mainHead } = readOperatorActivitySnapshotWithGhRunListError(detail);
    assert.equal(snapshot.postMergeMainCiEvidence.available, false);
    assert.equal(snapshot.postMergeMainCiEvidence.summary.exactHeadWorkflowCount, 0);
    assert.equal(snapshot.postMergeMainCiEvidence.summary.unknownCount, 2);
    assert.match(snapshot.postMergeMainCiEvidence.blockers.join("\n"), new RegExp(detail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    for (const item of snapshot.postMergeMainCiEvidence.workflowEvidence) {
      assertPostMergeMainCiDiagnostic(item, { workflow: item.workflow, reason, headSha: mainHead });
    }
  }
});

test("operator check falls back to read-only workflow-runs API when gh run list times out", () => {
  const tempDir = makeTempProject();
  const mainHead = "fallback-main-head-success";
  const calls = [];
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-17T02:15:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      calls.push(`${command} ${joined}`);
      if (command === "tmux") return "";
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") return "[]";
      if (command === "gh" && args[0] === "run") throw new Error("gh run list timed out");
      if (command === "gh" && joined === `api --method GET repos/minislively/fooks/actions/runs -f branch=main -f head_sha=${mainHead} -f per_page=100`) {
        return JSON.stringify({
          total_count: 2,
          workflow_runs: [
            {
              id: 90601,
              name: "CI",
              status: "completed",
              conclusion: "success",
              updated_at: "2026-05-17T02:10:00Z",
              head_branch: "main",
              head_sha: mainHead,
              event: "push",
              html_url: "https://github.com/minislively/fooks/actions/runs/90601",
            },
            {
              id: 90602,
              name: "React Web Release Report",
              status: "completed",
              conclusion: "success",
              updated_at: "2026-05-17T02:11:00Z",
              head_branch: "main",
              head_sha: mainHead,
              event: "push",
              html_url: "https://github.com/minislively/fooks/actions/runs/90602",
            },
          ],
        });
      }
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, `HEAD ${mainHead}`, "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return `${mainHead}\n`;
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.postMergeMainCiEvidence.available, true);
  assert.deepEqual(snapshot.postMergeMainCiEvidence.blockers, []);
  assert.deepEqual(snapshot.postMergeMainCiEvidence.summary, {
    exactHeadWorkflowCount: 2,
    successCount: 2,
    pendingCount: 0,
    unknownCount: 0,
    failureCount: 0,
    allExactHeadConclusionsSuccessful: true,
  });
  assert.equal(calls.some((call) => /fetch|delete|push/.test(call)), false);
  assert.equal(calls.some((call) => call.startsWith("gh api --method GET repos/minislively/fooks/actions/runs")), true);
  for (const item of snapshot.postMergeMainCiEvidence.workflowEvidence) {
    assert.equal(item.status, "success");
    assert.equal(item.diagnostic.apiSurface, "gh api actions workflow-runs");
    assert.equal(item.diagnostic.source, "GitHub REST API workflow-runs fallback for exact local origin/main head; read-only and no fetch performed");
    assert.equal(item.diagnostic.reason, "success");
    assert.equal(item.primaryDiagnostic.apiSurface, "gh run list");
    assert.equal(item.primaryDiagnostic.reason, "timeout");
    assert.equal(item.fallbackDiagnostic.apiSurface, "gh api actions workflow-runs");
    assert.match(item.fallbackDiagnostic.command, new RegExp(`head_sha=${mainHead}`));
    assert.match(item.fallbackDiagnostic.lookup, /no git fetch or mutation performed/);
  }
});

test("operator check treats an empty workflow-runs fallback as exact-head empty evidence", () => {
  const tempDir = makeTempProject();
  const mainHead = "fallback-main-head-empty";
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-17T02:18:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return "";
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") return "[]";
      if (command === "gh" && args[0] === "run") throw new Error("gh run list timed out");
      if (command === "gh" && joined === `api --method GET repos/minislively/fooks/actions/runs -f branch=main -f head_sha=${mainHead} -f per_page=100`) {
        return JSON.stringify({ total_count: 0, workflow_runs: [] });
      }
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, `HEAD ${mainHead}`, "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return `${mainHead}\n`;
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.postMergeMainCiEvidence.available, true);
  assert.deepEqual(snapshot.postMergeMainCiEvidence.blockers, []);
  assert.equal(snapshot.postMergeMainCiEvidence.summary.exactHeadWorkflowCount, 0);
  assert.equal(snapshot.postMergeMainCiEvidence.summary.unknownCount, 2);
  for (const item of snapshot.postMergeMainCiEvidence.workflowEvidence) {
    assert.equal(item.status, "unknown");
    assert.equal(item.diagnostic.apiSurface, "gh api actions workflow-runs");
    assert.equal(item.diagnostic.reason, "empty-run");
    assert.equal(item.primaryDiagnostic.reason, "timeout");
    assert.equal(item.fallbackDiagnostic.reason, "empty-run");
  }
});

test("operator check reports fallback unavailable when gh run list times out and workflow-runs fallback fails", () => {
  const tempDir = makeTempProject();
  const mainHead = "fallback-main-head-unavailable";
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-17T02:20:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return "";
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") return "[]";
      if (command === "gh" && args[0] === "run") throw new Error("gh run list timed out");
      if (command === "gh" && args[0] === "api") throw new Error("HTTP 503 workflow runs unavailable");
      if (command === "git" && joined === "config --get remote.origin.url") return "https://github.com/minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, `HEAD ${mainHead}`, "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return `${mainHead}\n`;
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.postMergeMainCiEvidence.available, false);
  assert.equal(snapshot.postMergeMainCiEvidence.summary.exactHeadWorkflowCount, 0);
  assert.equal(snapshot.postMergeMainCiEvidence.summary.unknownCount, 2);
  assert.match(snapshot.postMergeMainCiEvidence.blockers.join("\n"), /GitHub Actions run list unavailable: gh run list timed out/);
  assert.match(snapshot.postMergeMainCiEvidence.blockers.join("\n"), /GitHub Actions workflow-runs fallback unavailable: HTTP 503 workflow runs unavailable/);
  for (const item of snapshot.postMergeMainCiEvidence.workflowEvidence) {
    assert.equal(item.status, "unknown");
    assert.equal(item.diagnostic.apiSurface, "gh run list");
    assert.equal(item.diagnostic.reason, "timeout");
    assert.equal(item.fallbackDiagnostic.apiSurface, "gh api actions workflow-runs");
    assert.equal(item.fallbackDiagnostic.reason, "unavailable");
  }
});


test("operator check keeps workflow-runs fallback diagnostics truthful when API JSON is malformed", () => {
  const tempDir = makeTempProject();
  const mainHead = "fallback-main-head-malformed";
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-17T02:22:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return "";
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") return "[]";
      if (command === "gh" && args[0] === "run") throw new Error("gh run list timed out");
      if (command === "gh" && joined === `api --method GET repos/minislively/fooks/actions/runs -f branch=main -f head_sha=${mainHead} -f per_page=100`) {
        return JSON.stringify({ total_count: 1, workflow_runs: null });
      }
      if (command === "git" && joined === "config --get remote.origin.url") return "https://github.com/minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, `HEAD ${mainHead}`, "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return `${mainHead}\n`;
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.postMergeMainCiEvidence.available, false);
  assert.match(snapshot.postMergeMainCiEvidence.blockers.join("\n"), /non-array workflow_runs JSON/);
  for (const item of snapshot.postMergeMainCiEvidence.workflowEvidence) {
    assert.equal(item.status, "unknown");
    assert.equal(item.diagnostic.apiSurface, "gh run list");
    assert.equal(item.fallbackDiagnostic.apiSurface, "gh api actions workflow-runs");
    assert.equal(item.fallbackDiagnostic.reason, "parse-error");
    assert.match(item.fallbackDiagnostic.command, /repos\/minislively\/fooks\/actions\/runs/);
    assert.doesNotMatch(item.fallbackDiagnostic.command, /unknown\/unknown/);
  }
});

test("operator activity marks clean current main with zero counts and no sessions as non-active main echo evidence", () => {
  const tempDir = makeTempProject();
  const snapshot = readOperatorActivitySnapshot(tempDir, {
    includeRemoteCounts: true,
    now: () => "2026-05-10T02:30:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      if (command === "tmux") return "not-related\t/tmp/no-active-pane\tzsh\n";
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "git" && args.join(" ") === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD 111", "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && args.join(" ") === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && args.join(" ") === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && args.join(" ") === "branch --merged origin/main") return "main\n";
      throw new Error(`unexpected command ${command} ${args.join(" ")}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.currentRunEvidence.available, true);
  assert.equal(snapshot.currentRunEvidence.source, OPERATOR_ACTIVITY_CURRENT_RUN_SOURCE);
  assert.equal(snapshot.currentRunEvidence.claimBoundary, OPERATOR_ACTIVITY_CURRENT_RUN_CLAIM_BOUNDARY);
  assert.equal(snapshot.currentRunEvidence.classification, "mainEchoNonActive");
  assert.equal(snapshot.currentRunEvidence.mainEchoEvidence, true);
  assert.equal(snapshot.currentRunEvidence.activeWorkEvidence, false);
  assert.equal(snapshot.currentRunEvidence.remoteCountsRequired, true);
  assert.deepEqual(snapshot.currentRunEvidence.evidence, {
    branch: "main",
    upstream: "origin/main",
    clean: true,
    ahead: 0,
    behind: 0,
    fooksSessionCount: 0,
    openIssues: 0,
    openPullRequests: 0,
    legacyStaleClosedArtifactWorktreeCount: 0,
  });
  assert.deepEqual(snapshot.currentRunEvidence.reasons, [
    "current branch is main",
    "current worktree is clean",
    "local tracking divergence is zero",
    "no fooks-like tmux sessions are mapped to this snapshot",
    "open issue and pull request counts are both zero",
  ]);
  assert.deepEqual(snapshot.currentRunEvidence.receipt, {
    status: "idle",
    active: false,
    oneLine: "Current fooks run is idle/non-active: clean main, zero divergence, no mapped fooks sessions, zero open issues/PRs.",
    evidenceKinds: [],
    advisoryOnly: true,
    readOnly: true,
    claimBoundary: OPERATOR_ACTIVITY_CURRENT_RUN_CLAIM_BOUNDARY,
  });
  assert.deepEqual(snapshot.currentRunEvidence.blockers, []);
});

test("operator activity current-run receipt names dirty delta as active dogfood evidence", () => {
  const tempDir = makeTempProject();
  const snapshot = readOperatorActivitySnapshot(tempDir, {
    includeRemoteCounts: true,
    now: () => "2026-05-20T12:00:00.000Z",
    runner: () => " M src/index.ts\0?? notes.md\0",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      if (command === "tmux") return "not-related\t/tmp/no-active-pane\tzsh\n";
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      throw new Error(`unexpected command ${command} ${args.join(" ")}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.currentRunEvidence.mainEchoEvidence, false);
  assert.equal(snapshot.currentRunEvidence.activeWorkEvidence, true);
  assert.deepEqual(snapshot.currentRunEvidence.receipt, {
    status: "active",
    active: true,
    oneLine: "Current fooks run appears active: dirty worktree with 2 changed paths.",
    evidenceKinds: ["delta"],
    advisoryOnly: true,
    readOnly: true,
    claimBoundary: OPERATOR_ACTIVITY_CURRENT_RUN_CLAIM_BOUNDARY,
  });
});

test("operator activity does not count ancestor tmux panes as current active work for nested checkouts", () => {
  const tempDir = makeTempProject();
  const ancestorDir = path.dirname(path.dirname(tempDir));
  const snapshot = readOperatorActivitySnapshot(tempDir, {
    includeRemoteCounts: true,
    now: () => "2026-05-17T11:30:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux" && args[0] === "list-panes") return `omx-fooks-maintenance\t${ancestorDir}\tbash\t%13\n`;
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "gh" && args[0] === "run") return "[]";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD 111", "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir || targetPath === ancestorDir,
  });

  assert.equal(snapshot.tmux.sessions.length, 1);
  assert.equal(snapshot.tmux.sessions[0].status, "ancestorMaintenance");
  assert.equal(snapshot.tmux.sessions[0].current, false);
  assert.equal(snapshot.tmux.sessions[0].panes[0].ancestorOfCurrentCwd, true);
  assert.equal(snapshot.currentRunEvidence.evidence.fooksSessionCount, 0);
  assert.equal(snapshot.currentRunEvidence.mainEchoEvidence, true);
  assert.equal(snapshot.currentRunEvidence.activeWorkEvidence, false);
  assert.match(snapshot.currentRunEvidence.reasons.join("\n"), /ancestor maintenance tmux session\(s\) were not counted as active work evidence/);
});

test("operator check forces a concrete active artifact when post-merge main echo is idle", () => {
  const tempDir = makeTempProject();
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-10T03:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: /** @param {string} command @param {string[]} args */ (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return "not-related\t/tmp/no-active-pane\tzsh\n";
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD 111", "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.command, OPERATOR_CHECK_COMMAND);
  assert.equal(snapshot.claimBoundary, OPERATOR_CHECK_CLAIM_BOUNDARY);
  assert.equal(snapshot.readOnly, true);
  assert.equal(snapshot.source, OPERATOR_CHECK_SOURCE);
  assert.equal(snapshot.verdict, "idleRequiresActiveArtifact");
  assert.equal(snapshot.postMergeMainEchoBoundary.explicit, true);
  assert.equal(snapshot.postMergeMainEchoBoundary.currentRunClassification, "mainEchoNonActive");
  assert.equal(snapshot.postMergeMainEchoBoundary.mainEchoEvidence, true);
  assert.equal(snapshot.postMergeMainEchoBoundary.activeWorkEvidence, false);
  assert.equal(snapshot.postMergeMainEchoBoundary.echoOnly, true);
  assert.deepEqual(snapshot.activeArtifacts, []);
  assert.equal(snapshot.requiredActiveArtifact.required, true);
  assert.deepEqual(snapshot.requiredActiveArtifact.acceptableArtifacts, [
    "open GitHub issue",
    "open GitHub pull request",
    "mapped fooks tmux session",
  ]);
  assert.match(snapshot.requiredActiveArtifact.message, /No concrete active issue, PR, or mapped fooks session/);
  assert.equal(snapshot.requiredActiveArtifact.dogfoodHandoff.status, "requires-live-artifact");
  assert.equal(snapshot.requiredActiveArtifact.dogfoodHandoff.requiredBeforeNextDevelopmentAction, true);
  assert.equal(
    snapshot.requiredActiveArtifact.dogfoodHandoff.evidenceBoundary,
    "ci-echo-and-stale-residue-are-not-active-work",
  );
  assert.match(snapshot.requiredActiveArtifact.dogfoodHandoff.nextAction, /Create or link an open issue, open PR, or mapped fooks tmux session/);
  assert.equal(snapshot.activity.optionalCounts.enabled, true);
  assert.equal(snapshot.activity.currentRunEvidence.mainEchoEvidence, true);
  assert.equal(snapshot.activeWorkReceipts.classification, "mainEcho");
  assert.equal(snapshot.activeWorkReceipts.receipts.length, 1);
  assert.equal(snapshot.activeWorkReceipts.receipts[0].kind, "branch");
  assert.equal(snapshot.activeWorkReceipts.receipts[0].classification, "mainEcho");
  assert.match(snapshot.activeWorkReceipts.reportLine, /mainEcho=1/);
  assert.equal(snapshot.activeWorkReceipts.reportLine.includes("staleResidueLedger="), false);
  assert.deepEqual(snapshot.activeWorkReceipts.staleResidueLedger.counts, {
    "safe-cleanup": 0,
    "salvage-review": 0,
    "manual-review-noise": 0,
  });
  assert.equal(snapshot.activeWorkReceipts.staleResidueLedger.totalCount, 0);
  assert.equal(snapshot.activeWorkReceipts.cleanupReviewManifest.issue, "#739");
  assert.equal(snapshot.activeWorkReceipts.cleanupReviewManifest.readOnly, true);
  assert.equal(snapshot.activeWorkReceipts.cleanupReviewManifest.rowCount, 0);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.readOnly, true);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.staleResidueCount, 0);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.activeArtifactReceiptCount, 0);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.staleResidueIsActiveWorkEvidence, false);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.satisfiesActiveArtifactRequirement, false);
  assert.equal(snapshot.contextTrust.schemaVersion, 1);
  assert.equal(snapshot.contextTrust.source, OPERATOR_CONTEXT_TRUST_SOURCE);
  assert.equal(snapshot.contextTrust.researchReference, OPERATOR_CONTEXT_TRUST_RESEARCH_REFERENCE);
  assert.deepEqual(snapshot.contextTrust.sourceOfTruth.current, []);
  assert.equal(snapshot.contextTrust.advisoryOnly.some((entry) => entry.kind === "required-active-artifact-guidance"), true);
  assert.equal(snapshot.contextTrust.nonAuthorizing.some((entry) => entry.kind === "main-echo-boundary" && entry.referenceField === "postMergeMainEchoBoundary"), true);
  assert.equal(snapshot.contextTrust.nonAuthorizing.find((entry) => entry.kind === "main-echo-boundary")?.contractScope, "main-echo-boundary");
  assert.equal(snapshot.contextTrust.historicalOnly.some((entry) => entry.kind === "main-echo-boundary"), false);
  assert.equal(snapshot.contextTrust.historicalOnly.some((entry) => entry.kind === "post-merge-main-ci-receipt"), false);
  assert.equal(snapshot.contextTrust.historicalOnly.some((entry) => entry.kind === "post-receipt-nudge-anchor"), false);
  assert.equal(snapshot.contextTrust.historicalOnly.some((entry) => entry.kind === "receipt-only-nudge-loop"), false);
  assert.equal(snapshot.contextTrust.advisoryOnly.some((entry) => entry.kind === "post-receipt-nudge-anchor-guidance"), true);
  assert.equal(snapshot.contextTrust.advisoryOnly.some((entry) => entry.kind === "receipt-only-nudge-loop-guidance"), true);
  assert.deepEqual(snapshot.blockers, []);
});


test("operator check treats absent tmux server as zero mapped sessions and keeps CI uncertainty separate", () => {
  const tempDir = makeTempProject();
  const mainHead = "no-tmux-main-head";
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-16T04:20:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") throw tmuxNoServerError();
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") return "[]";
      if (command === "gh" && args[0] === "run") throw new Error("gh run list timed out");
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, `HEAD ${mainHead}`, "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return `${mainHead}\n`;
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.verdict, "idleRequiresActiveArtifact");
  assert.equal(snapshot.activity.tmux.available, true);
  assert.deepEqual(snapshot.activity.tmux.sessions, []);
  assert.deepEqual(snapshot.activity.tmux.blockers, []);
  assert.equal(snapshot.activity.currentRunEvidence.available, true);
  assert.equal(snapshot.activity.currentRunEvidence.classification, "mainEchoNonActive");
  assert.equal(snapshot.activity.currentRunEvidence.mainEchoEvidence, true);
  assert.equal(snapshot.activity.currentRunEvidence.activeWorkEvidence, false);
  assert.deepEqual(snapshot.activity.currentRunEvidence.blockers, []);
  assert.deepEqual(snapshot.activity.blockers, []);
  assert.deepEqual(snapshot.blockers, []);
  assert.equal(snapshot.requiredActiveArtifact.dogfoodHandoff.status, "requires-live-artifact");
  assert.equal(snapshot.postMergeMainCiEvidence.available, false);
  assert.match(snapshot.postMergeMainCiEvidence.blockers.join("\n"), /GitHub Actions run list unavailable: gh run list timed out/);
  assert.equal(snapshot.postMergeMainCiEvidence.summary.unknownCount, 2);
  assert.deepEqual(snapshot.postMergeMainCiEvidence.workflowEvidence.map((item) => item.diagnostic.reason), ["timeout", "timeout"]);
  for (const item of snapshot.postMergeMainCiEvidence.workflowEvidence) {
    assertPostMergeMainCiDiagnostic(item, { workflow: item.workflow, reason: "timeout", headSha: mainHead });
  }
  assert.equal(snapshot.activeWorkReceipts.classification, "mainEcho");
  assert.equal(snapshot.activeWorkReceipts.localOnlyResidueActiveBoundary.activeRequirementEvidence.mappedFooksTmuxProcSessionCount, 0);
});

test("CLI check and status activity treat absent tmux server as zero mapped sessions without top-level blockers", () => {
  const { tempDir, env } = makeNoTmuxServerCliFixture();

  const check = run(["check", "--json"], tempDir, env);
  assert.equal(check.verdict, "idleRequiresActiveArtifact");
  assert.deepEqual(check.blockers, []);
  assert.equal(check.activity.tmux.available, true);
  assert.deepEqual(check.activity.tmux.sessions, []);
  assert.deepEqual(check.activity.tmux.blockers, []);
  assert.deepEqual(check.activity.blockers, []);
  assert.equal(check.activity.currentRunEvidence.classification, "mainEchoNonActive");
  assert.deepEqual(check.activity.currentRunEvidence.blockers, []);
  assert.equal(check.requiredActiveArtifact.required, true);
  assert.equal(check.requiredActiveArtifact.dogfoodHandoff.status, "requires-live-artifact");
  assert.equal(check.activeWorkReceipts.classification, "mainEcho");
  assert.deepEqual(check.activeWorkReceipts.blockers, []);
  assert.equal(check.activeWorkReceipts.reportLine.includes("blocked"), false);
  assert.equal(check.activeWorkReceipts.localOnlyResidueActiveBoundary.activeRequirementEvidence.mappedFooksTmuxProcSessionCount, 0);
  assert.equal(check.blockers.includes("tmux activity unavailable: no server running on /tmp/tmux-1000/default"), false);
  assert.equal(JSON.stringify(check).includes("tmux activity unavailable"), false);
  assert.equal(check.postMergeMainCiEvidence.summary.exactHeadWorkflowCount, 0);
  assert.equal(check.postMergeMainCiEvidence.summary.unknownCount, 2);
  assert.deepEqual(check.postMergeMainCiEvidence.workflowEvidence.map((item) => item.diagnostic.reason), ["empty-run", "empty-run"]);
  for (const item of check.postMergeMainCiEvidence.workflowEvidence) {
    assertPostMergeMainCiDiagnostic(item, { workflow: item.workflow, reason: "empty-run", headSha: "no-tmux-cli-main-head" });
  }
  assert.equal(check.runtimeProvenance.schemaVersion, 1);
  assert.notEqual(check.runtimeProvenance, null);
  assert.equal(check.runtimeProvenance.package.status, "known");
  assert.equal(check.runtimeProvenance.package.name, "fxxk-frontend-hooks");
  assert.equal(check.runtimeProvenance.package.version, "0.1.3");
  assert.equal(check.runtimeProvenance.runtime.cwd, tempDir);
  assert.equal(check.runtimeProvenance.runtime.argv1Status, "known");
  assert.equal(check.runtimeProvenance.artifacts.executionKind, "built-dist");
  assert.equal(check.runtimeProvenance.artifacts.executionKindStatus, "known");
  assert.equal(check.runtimeProvenance.artifacts.cliEntrypointStatus, "known");
  assert.equal(check.runtimeProvenance.artifacts.freshnessStatus, "known");
  assert.match(check.runtimeProvenance.artifacts.operatorCheckModulePath, /dist[\\/]ops[\\/]operator-check\.js$/);
  assert.match(check.runtimeProvenance.artifacts.operatorCheckModuleRealPath, /dist[\\/]ops[\\/]operator-check\.js$/);
  assert.match(check.runtimeProvenance.artifacts.cliEntrypointPath, /dist[\\/]cli[\\/]index\.js$/);
  assert.match(check.runtimeProvenance.artifacts.cliEntrypointRealPath, /dist[\\/]cli[\\/]index\.js$/);
  assert.match(check.runtimeProvenance.artifacts.sourceOperatorCheckPath, /src[\\/]ops[\\/]operator-check\.ts$/);
  assert.equal(typeof check.runtimeProvenance.artifacts.sourceNewerThanOperatorCheckModule, "boolean");
  assert.equal(check.runtimeProvenance.git.scope, "invocation-cwd");
  assert.equal(check.runtimeProvenance.git.cwd, tempDir);
  assert.equal(check.runtimeProvenance.git.head, "no-tmux-cli-main-head");
  assert.equal(check.runtimeProvenance.git.headStatus, "known");
  assert.equal(check.runtimeProvenance.git.branch, "main");
  assert.equal(check.runtimeProvenance.git.branchStatus, "known");

  const activity = run(["status", "activity", "--include-remote-counts", "--json"], tempDir, env);
  assert.equal(activity.runtimeProvenance.schemaVersion, 1);
  assert.notEqual(activity.runtimeProvenance, null);
  assert.equal(activity.runtimeProvenance.package.status, "known");
  assert.equal(activity.runtimeProvenance.package.name, "fxxk-frontend-hooks");
  assert.equal(activity.runtimeProvenance.package.version, "0.1.3");
  assert.equal(activity.runtimeProvenance.runtime.cwd, tempDir);
  assert.equal(activity.runtimeProvenance.runtime.argv1Status, "known");
  assert.equal(activity.runtimeProvenance.artifacts.executionKind, "built-dist");
  assert.equal(activity.runtimeProvenance.artifacts.executionKindStatus, "known");
  assert.equal(activity.runtimeProvenance.artifacts.cliEntrypointStatus, "known");
  assert.equal(activity.runtimeProvenance.artifacts.freshnessStatus, "known");
  assert.match(activity.runtimeProvenance.artifacts.operatorActivityModulePath, /dist[\\/]ops[\\/]operator-activity\.js$/);
  assert.match(activity.runtimeProvenance.artifacts.operatorActivityModuleRealPath, /dist[\\/]ops[\\/]operator-activity\.js$/);
  assert.match(activity.runtimeProvenance.artifacts.cliEntrypointPath, /dist[\\/]cli[\\/]index\.js$/);
  assert.match(activity.runtimeProvenance.artifacts.cliEntrypointRealPath, /dist[\\/]cli[\\/]index\.js$/);
  assert.match(activity.runtimeProvenance.artifacts.sourceOperatorActivityPath, /src[\\/]ops[\\/]operator-activity\.ts$/);
  assert.equal(typeof activity.runtimeProvenance.artifacts.sourceNewerThanOperatorActivityModule, "boolean");
  assert.equal(activity.runtimeProvenance.git.scope, "invocation-cwd");
  assert.equal(activity.runtimeProvenance.git.cwd, tempDir);
  assert.equal(activity.runtimeProvenance.git.head, "no-tmux-cli-main-head");
  assert.equal(activity.runtimeProvenance.git.headStatus, "known");
  assert.equal(activity.runtimeProvenance.git.branch, "main");
  assert.equal(activity.runtimeProvenance.git.branchStatus, "known");
  assert.equal(activity.tmux.available, true);
  assert.deepEqual(activity.tmux.sessions, []);
  assert.deepEqual(activity.tmux.blockers, []);
  assert.deepEqual(activity.blockers, []);
  assert.equal(activity.currentRunEvidence.mainEchoEvidence, true);
  const receipt = run(["status", "activity", "--include-remote-counts", "--receipt-json"], tempDir, env);
  assert.deepEqual(receipt, activity.currentRunEvidence.receipt);
  assert.deepEqual(receipt, {
    status: "idle",
    active: false,
    oneLine: "Current fooks run is idle/non-active: clean main, zero divergence, no mapped fooks sessions, zero open issues/PRs.",
    evidenceKinds: [],
    advisoryOnly: true,
    readOnly: true,
    claimBoundary: OPERATOR_ACTIVITY_CURRENT_RUN_CLAIM_BOUNDARY,
  });
});

test("CLI status activity receipt projection matches full active current-run receipt", () => {
  const { tempDir, env } = makeActiveReceiptCliFixture();

  const activity = run(["status", "activity", "--include-remote-counts", "--json"], tempDir, env);
  const receipt = run(["status", "activity", "--include-remote-counts", "--receipt-json"], tempDir, env);

  assert.deepEqual(receipt, activity.currentRunEvidence.receipt);
  assert.deepEqual(receipt, {
    status: "active",
    active: true,
    oneLine: "Current fooks run appears active: 1 open issue, branch dogfood/issue-998-current-run-receipt-cli, 1 mapped fooks session.",
    evidenceKinds: ["issue", "branch", "session"],
    advisoryOnly: true,
    readOnly: true,
    claimBoundary: OPERATOR_ACTIVITY_CURRENT_RUN_CLAIM_BOUNDARY,
  });
  assert.equal(activity.currentRunEvidence.activeWorkEvidence, true);
  assert.equal(activity.currentRunEvidence.receipt.readOnly, true);
});


test("CLI check provenance keeps git unknowns diagnostic-only", () => {
  const { tempDir, env } = makeNoTmuxServerCliFixture();
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-git-provenance-bin-"));
  writeExecutable(path.join(binDir, "git"), `#!/bin/sh
if [ "$*" = "rev-parse HEAD" ] || [ "$*" = "branch --show-current" ]; then
  echo "git provenance unavailable" >&2
  exit 2
fi
PATH=${JSON.stringify(env.PATH)} exec git "$@"
`);
  const check = run(["check", "--json"], tempDir, { ...env, PATH: `${binDir}${path.delimiter}${env.PATH}` });

  assert.equal(check.runtimeProvenance.git.scope, "invocation-cwd");
  assert.equal(check.runtimeProvenance.git.cwd, tempDir);
  assert.equal(check.runtimeProvenance.git.head, undefined);
  assert.equal(check.runtimeProvenance.git.headStatus, "unknown");
  assert.equal(check.runtimeProvenance.git.branch, undefined);
  assert.equal(check.runtimeProvenance.git.branchStatus, "unknown");
  assert.match(check.runtimeProvenance.git.blockers.join("\n"), /git rev-parse HEAD unavailable/);
  assert.match(check.runtimeProvenance.git.blockers.join("\n"), /git branch --show-current unavailable/);
  assert.deepEqual(check.blockers, []);
  assert.equal(check.verdict, "idleRequiresActiveArtifact");
});


test("CLI check provenance rejects unrelated ancestor package.json", () => {
  const { tempDir, env } = makeNoTmuxServerCliFixture();
  const hostRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-host-package-"));
  fs.writeFileSync(path.join(hostRoot, "package.json"), JSON.stringify({ name: "host-app", version: "9.9.9" }));
  const standaloneDist = path.join(hostRoot, "dist");
  fs.cpSync(path.join(repoRoot, "dist"), standaloneDist, { recursive: true });
  const standaloneCli = path.join(standaloneDist, "cli", "index.js");

  const check = runWithCli(standaloneCli, ["check", "--json"], tempDir, env);

  assert.equal(check.runtimeProvenance.package.status, "unknown");
  assert.equal(check.runtimeProvenance.package.name, undefined);
  assert.equal(check.runtimeProvenance.package.version, undefined);
  assert.match(check.runtimeProvenance.package.reason, /does not match fooks CLI artifact ownership/);
  assert.equal(check.runtimeProvenance.artifacts.sourceOperatorCheckPath, undefined);
  assert.equal(check.runtimeProvenance.artifacts.freshnessStatus, "unknown");
  assert.deepEqual(check.blockers, []);
});

test("CLI check provenance reports explicit unknowns when package/source context is unavailable", () => {
  const { tempDir, env } = makeNoTmuxServerCliFixture();
  const standaloneRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-standalone-cli-"));
  const standaloneDist = path.join(standaloneRoot, "dist");
  fs.cpSync(path.join(repoRoot, "dist"), standaloneDist, { recursive: true });
  const standaloneCli = path.join(standaloneDist, "cli", "index.js");

  const check = runWithCli(standaloneCli, ["check", "--json"], tempDir, env);

  assert.equal(check.runtimeProvenance.schemaVersion, 1);
  assert.equal(check.runtimeProvenance.runtime.cwd, tempDir);
  assert.equal(check.runtimeProvenance.runtime.argv1Status, "known");
  assert.match(check.runtimeProvenance.artifacts.cliEntrypointPath, /dist[\/]cli[\/]index\.js$/);
  assert.equal(check.runtimeProvenance.artifacts.cliEntrypointStatus, "known");
  assert.equal(check.runtimeProvenance.artifacts.executionKind, "built-dist");
  assert.equal(check.runtimeProvenance.package.status, "unknown");
  assert.equal(check.runtimeProvenance.package.name, undefined);
  assert.equal(check.runtimeProvenance.package.version, undefined);
  assert.match(check.runtimeProvenance.package.reason, /package\.json ancestor not found/);
  assert.equal(check.runtimeProvenance.artifacts.sourceOperatorCheckPath, undefined);
  assert.equal(check.runtimeProvenance.artifacts.sourceNewerThanOperatorCheckModule, undefined);
  assert.equal(check.runtimeProvenance.artifacts.freshnessStatus, "unknown");
  assert.match(check.runtimeProvenance.artifacts.freshnessReason, /freshness comparison unavailable/);
  assert.equal(check.runtimeProvenance.git.headStatus, "known");
  assert.equal(check.runtimeProvenance.git.branchStatus, "known");
  assert.deepEqual(check.blockers, []);
});

test("root built CLI check treats tmux socket ENOENT as absent server, not a blocker", () => {
  const { tempDir, env } = makeNoTmuxServerCliFixture("error connecting to /tmp/fooks-empty-tmux/tmux-1000/default (No such file or directory)\n");

  const check = run(["check", "--json"], tempDir, env);
  assert.equal(check.verdict, "idleRequiresActiveArtifact");
  assert.deepEqual(check.blockers, []);
  assert.equal(check.activity.tmux.available, true);
  assert.deepEqual(check.activity.tmux.sessions, []);
  assert.deepEqual(check.activity.tmux.blockers, []);
  assert.equal(check.activeWorkReceipts.classification, "mainEcho");
  assert.deepEqual(check.activeWorkReceipts.blockers, []);
  assert.equal(check.activeWorkReceipts.reportLine.includes("blocked"), false);
  assert.equal(JSON.stringify(check).includes("tmux activity unavailable"), false);
  assert.equal(JSON.stringify(check).includes("tmux pane list unavailable"), false);
  assert.equal(check.runtimeProvenance.artifacts.executionKind, "built-dist");
});

test("operator check suppresses no-server tmux output from top-level blockers", () => {
  const tempDir = makeTempProject();
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-16T04:22:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") throw tmuxNoServerError("/tmp/tmux-1000/default", "output");
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "gh" && args[0] === "run") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD no-tmux-stdout-main", "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "no-tmux-stdout-main\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.activity.tmux.available, true);
  assert.deepEqual(snapshot.activity.tmux.blockers, []);
  assert.deepEqual(snapshot.activity.blockers, []);
  assert.deepEqual(snapshot.blockers, []);
  assert.equal(snapshot.activeWorkReceipts.classification, "mainEcho");
  assert.equal(snapshot.activeWorkReceipts.blockers.join("\n").includes("no server running"), false);
  assert.equal(JSON.stringify(snapshot).includes("tmux activity unavailable: no server running"), false);
});

test("operator check suppresses no-server tmux failures from nonstandard error renderings", () => {
  const tempDir = makeTempProject();
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-16T04:24:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") {
        throw {
          toString() {
            return "tmux activity unavailable: no server running on /tmp/tmux-1000/default";
          },
        };
      }
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "gh" && args[0] === "run") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD no-tmux-rendered-main", "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "no-tmux-rendered-main\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.deepEqual(snapshot.blockers, []);
  assert.equal(snapshot.activeWorkReceipts.classification, "mainEcho");
  assert.deepEqual(snapshot.activeWorkReceipts.blockers, []);
  assert.equal(JSON.stringify(snapshot).includes("tmux activity unavailable: no server running"), false);
});

test("operator check preserves true tmux failures as blockers", () => {
  const tempDir = makeTempProject();
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-16T04:25:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") {
        const error = new Error("tmux permission denied");
        error.stderr = "permission denied opening tmux socket\n";
        error.code = 1;
        throw error;
      }
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "gh" && args[0] === "run") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD 111", "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.verdict, "blocked");
  assert.equal(snapshot.activity.tmux.available, false);
  assert.match(snapshot.activity.tmux.blockers.join("\n"), /tmux activity unavailable: permission denied opening tmux socket/);
  assert.match(snapshot.activity.currentRunEvidence.blockers.join("\n"), /tmux session evidence unavailable/);
  assert.equal(snapshot.requiredActiveArtifact.dogfoodHandoff.status, "blocked");
  assert.match(snapshot.blockers.join("\n"), /tmux activity unavailable: permission denied opening tmux socket/);
});

test("operator check treats issue, PR, or mapped session as the concrete active boundary", () => {
  const tempDir = makeTempProject();
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-10T03:10:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "dogfood/issue-705-post-merge-echo-idle-boundary\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return `fooks-705\t${tempDir}\tzsh\n`;
      if (command === "gh" && args[0] === "issue") return "[{\"number\":705}]";
      if (command === "gh" && args[0] === "pr") return "[{\"number\":706}]";
      if (command === "git" && joined === "config --get remote.origin.url") return "https://github.com/minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD 111", "branch refs/heads/dogfood/issue-705-post-merge-echo-idle-boundary", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "dogfood/issue-705-post-merge-echo-idle-boundary\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.verdict, "activeArtifactPresent");
  assert.equal(snapshot.requiredActiveArtifact.required, false);
  assert.equal(snapshot.requiredActiveArtifact.dogfoodHandoff.status, "satisfied");
  assert.equal(snapshot.requiredActiveArtifact.dogfoodHandoff.requiredBeforeNextDevelopmentAction, false);
  assert.match(snapshot.requiredActiveArtifact.dogfoodHandoff.nextAction, /concrete active artifact already present/);
  assert.deepEqual(snapshot.activeArtifacts, [
    { kind: "issue", count: 1, source: OPERATOR_ACTIVITY_REMOTE_SOURCE },
    { kind: "pullRequest", count: 1, source: OPERATOR_ACTIVITY_REMOTE_SOURCE },
    { kind: "session", count: 1, source: OPERATOR_ACTIVITY_TMUX_COMMAND },
  ]);
  assert.equal(snapshot.postMergeMainEchoBoundary.echoOnly, false);
  assert.deepEqual(snapshot.currentRunReceipt, {
    status: "active",
    active: true,
    oneLine: "Current fooks run appears active: 1 open issue, 1 open PR, branch dogfood/issue-705-post-merge-echo-idle-boundary, 1 mapped fooks session.",
    evidenceKinds: ["issue", "pullRequest", "branch", "session"],
    advisoryOnly: true,
    readOnly: true,
    claimBoundary: OPERATOR_ACTIVITY_CURRENT_RUN_CLAIM_BOUNDARY,
  });
  assert.deepEqual(snapshot.activeWorkReceipts.currentRunReceipt, snapshot.currentRunReceipt);

  assert.equal(snapshot.activeWorkReceipts.schemaVersion, 1);
  assert.equal(snapshot.activeWorkReceipts.readOnly, true);
  assert.equal(snapshot.activeWorkReceipts.identifiers.repo, "github.com/minislively/fooks");
  assert.equal(snapshot.activeWorkReceipts.identifiers.repoSource, "git remote.origin.url");
  assert.equal(snapshot.activeWorkReceipts.classification, "active");
  assert.match(snapshot.activeWorkReceipts.reportLine, /fooks active-work receipt: active; active=4/);
  const receiptsByKind = new Map(snapshot.activeWorkReceipts.receipts.map((receipt) => [receipt.kind, receipt]));
  assert.deepEqual(receiptsByKind.get("issue"), {
    kind: "issue",
    classification: "active",
    identifiers: snapshot.activeWorkReceipts.identifiers,
    count: 1,
    source: OPERATOR_ACTIVITY_REMOTE_SOURCE,
    reasons: ["aggregate open issue count is greater than zero"],
    blockers: [],
  });
  assert.equal(receiptsByKind.get("pullRequest")?.count, 1);
  assert.equal(receiptsByKind.get("branch")?.classification, "active");
  const sessionReceipt = receiptsByKind.get("session");
  assert.equal(sessionReceipt?.classification, "active");
  assert.deepEqual(sessionReceipt?.identifiers.session, { name: "fooks-705", paneCount: 1 });
  assert.equal("number" in receiptsByKind.get("issue"), false);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.staleResidueCount, 0);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.activeArtifactReceiptCount, 3);
  assert.deepEqual(snapshot.activeWorkReceipts.staleResidueActiveBoundary.acceptableActiveArtifacts, [
    "open GitHub issue",
    "open GitHub pull request",
    "mapped fooks tmux session",
  ]);
  const trustCurrentByKind = new Map(snapshot.contextTrust.sourceOfTruth.current.map((entry) => [entry.kind, entry]));
  assert.equal(trustCurrentByKind.get("issue")?.count, 1);
  assert.equal(trustCurrentByKind.get("issue")?.authority, "current-work");
  assert.equal(trustCurrentByKind.get("issue")?.contractScope, "top-level-active-artifact");
  assert.match(trustCurrentByKind.get("issue")?.reason ?? "", /count-only current-work presence/);
  assert.equal(trustCurrentByKind.get("pullRequest")?.count, 1);
  assert.equal(trustCurrentByKind.get("session")?.count, 1);
  assert.equal("number" in trustCurrentByKind.get("issue"), false);
});

test("operator check does not treat staged unsubmitted OMX prompt pane as active session evidence for #910", () => {
  const tempDir = makeTempProject();
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-17T06:30:00.000Z",
    runner: () => "?? .fooks-session-task.txt\0",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "dogfood/issue-910-staged-omx-prompt-active-evidence\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: /** @param {string} command @param {string[]} args */ (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux" && args[0] === "list-panes") return `omx-issue-910\t${tempDir}\tnode\t%1\n`;
      if (command === "tmux" && args[0] === "capture-pane") {
        assert.equal(joined, "capture-pane -pt %1 -S -200");
        return "› Pain point: fooks status/check can count an OMX tmux pane as active work\n";
      }
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "gh" && args[0] === "run") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "https://github.com/minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD issue-910-head", "branch refs/heads/dogfood/issue-910-staged-omx-prompt-active-evidence", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "issue-910-head\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\ndogfood/issue-910-staged-omx-prompt-active-evidence\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\ndogfood/issue-910-staged-omx-prompt-active-evidence\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "?? .fooks-session-task.txt\0";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: /** @param {string} targetPath */ (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.activity.stagedOmxPromptEvidence.source, OPERATOR_ACTIVITY_STAGED_OMX_PROMPT_SOURCE);
  assert.equal(snapshot.activity.stagedOmxPromptEvidence.classification, "stagedPromptOnly");
  assert.equal(snapshot.activity.stagedOmxPromptEvidence.preventsActiveWorkEvidence, true);
  assert.deepEqual(snapshot.activity.stagedOmxPromptEvidence.conditions, {
    onlyFooksSessionTaskDelta: true,
    aheadZero: true,
    requiresNoSubmittedPromptOrWorkEvidence: true,
    requiresCurrentOmxPane: true,
  });
  assert.deepEqual(snapshot.activity.stagedOmxPromptEvidence.sessionNames, ["omx-issue-910"]);
  assert.equal(snapshot.activity.tmux.sessions[0].status, "stagedPromptOnly");
  assert.equal(snapshot.activity.currentRunEvidence.evidence.fooksSessionCount, 0);
  assert.equal(snapshot.activity.currentRunEvidence.activeWorkEvidence, false);
  assert.deepEqual(snapshot.activeArtifacts, []);
  assert.equal(snapshot.verdict, "idleRequiresActiveArtifact");
  assert.equal(snapshot.requiredActiveArtifact.required, true);
  assert.equal(snapshot.activeWorkReceipts.receipts.some((receipt) => receipt.kind === "session" && receipt.classification === "active"), false);
});

test("operator activity keeps OMX pane active when submitted prompt or work evidence is captured", () => {
  const tempDir = makeTempProject();
  const snapshot = readOperatorActivitySnapshot(tempDir, {
    includeRemoteCounts: true,
    now: () => "2026-05-17T06:35:00.000Z",
    runner: () => "?? .fooks-session-task.txt\0",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "dogfood/issue-910-staged-omx-prompt-active-evidence\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: /** @param {string} command @param {string[]} args */ (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux" && args[0] === "list-panes") return `omx-issue-910\t${tempDir}\tnode\t%2\n`;
      if (command === "tmux" && args[0] === "capture-pane") return "UserPromptSubmit accepted\nWorking\n";
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "gh" && args[0] === "run") return "[]";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD issue-910-head", "branch refs/heads/dogfood/issue-910-staged-omx-prompt-active-evidence", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "issue-910-head\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\ndogfood/issue-910-staged-omx-prompt-active-evidence\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\ndogfood/issue-910-staged-omx-prompt-active-evidence\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "?? .fooks-session-task.txt\0";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: /** @param {string} targetPath */ (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.stagedOmxPromptEvidence.classification, "activeOrUnknown");
  assert.equal(snapshot.tmux.sessions[0].status, "current");
  assert.equal(snapshot.currentRunEvidence.evidence.fooksSessionCount, 1);
  assert.equal(snapshot.currentRunEvidence.activeWorkEvidence, true);
});


test("operator check projects sibling worktree adoption receipts without cleanup commands", () => {
  const tempDir = makeTempProject();
  const siblingRoot = path.dirname(tempDir);
  const safeWorktree = path.join(siblingRoot, "old-clean-residue");
  const localAheadWorktree = path.join(siblingRoot, "local-ahead-orphan");
  const remoteWorktree = path.join(siblingRoot, "remote-active");
  const calls = [];
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-11T06:10:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "dogfood/issue-720-stale-worktree-active-adoption\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args, cwd) => {
      calls.push([command, ...args].join(" "));
      const joined = args.join(" ");
      if (command === "tmux" && joined.includes("pane_current_command")) return `fooks-720\t${tempDir}\tzsh\n`;
      if (command === "tmux") return `fooks-720\t${tempDir}\n`;
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "https://github.com/minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [
          `worktree ${tempDir}`,
          "HEAD 111",
          "branch refs/heads/dogfood/issue-720-stale-worktree-active-adoption",
          "",
          `worktree ${safeWorktree}`,
          "HEAD 222",
          "branch refs/heads/dogfood/old-clean-residue",
          "",
          `worktree ${localAheadWorktree}`,
          "HEAD 333",
          "branch refs/heads/dogfood/local-ahead-orphan",
          "",
          `worktree ${remoteWorktree}`,
          "HEAD 444",
          "branch refs/heads/dogfood/remote-active",
          "",
        ].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "dogfood/issue-720-stale-worktree-active-adoption\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\norigin/dogfood/remote-active\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") {
        if (cwd === localAheadWorktree) return "2 files changed, 10 insertions(+), 1 deletion(-)\n";
        if (cwd === remoteWorktree) return "1 file changed, 1 insertion(+)\n";
        return "";
      }
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") {
        if (cwd === localAheadWorktree) return "1 2\n";
        if (cwd === remoteWorktree) return "0 1\n";
        return "0 0\n";
      }
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => [tempDir, safeWorktree, localAheadWorktree, remoteWorktree].includes(targetPath),
  });

  const worktreeReceipts = snapshot.activeWorkReceipts.receipts.filter((receipt) => receipt.kind === "worktree");
  assert.equal(snapshot.activeWorkReceipts.readOnly, true);
  assert.equal(worktreeReceipts.length, 3);
  assert.equal(snapshot.activeWorkReceipts.staleResidueLedger.issue, "#736");
  assert.equal(snapshot.activeWorkReceipts.staleResidueLedger.readOnly, true);
  assert.equal(snapshot.activeWorkReceipts.staleResidueLedger.totalCount, 2);
  assert.deepEqual(snapshot.activeWorkReceipts.staleResidueLedger.counts, {
    "safe-cleanup": 1,
    "salvage-review": 1,
    "manual-review-noise": 0,
  });
  assert.deepEqual(snapshot.activeWorkReceipts.staleResidueLedger.classes.map((row) => row.nextReviewAction), [
    "review-closed-or-merged-evidence-before-manual-cleanup",
    "preserve-local-only-commits-before-adoption-or-cleanup",
    "confirm-closed-pr-or-detached-review-context-before-ignoring",
  ]);
  assert.equal(
    snapshot.activeWorkReceipts.staleResidueLedger.localOnlyCommitPolicy,
    "do-not-delete-local-only-commits-automatically",
  );
  assert.match(snapshot.activeWorkReceipts.reportLine, /staleResidueLedger=2/);
  assert.match(snapshot.activeWorkReceipts.reportLine, /cleanupReviewManifest=2\(#739\)/);
  assert.equal(snapshot.activeWorkReceipts.cleanupReviewManifest.issue, "#739");
  assert.equal(snapshot.activeWorkReceipts.cleanupReviewManifest.readOnly, true);
  assert.match(snapshot.activeWorkReceipts.cleanupReviewManifest.claimBoundary, /per-row reason, risk class, and required manual action/);
  assert.equal(snapshot.activeWorkReceipts.cleanupReviewManifest.rowCount, 2);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.staleResidueCount, 2);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.activeArtifactReceiptCount, 1);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.staleResidueIsActiveWorkEvidence, false);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.satisfiesActiveArtifactRequirement, false);
  assert.match(snapshot.activeWorkReceipts.staleResidueActiveBoundary.reminder, /require an open issue, open PR, or mapped fooks tmux session/);
  const staleResidueTrust = snapshot.contextTrust.nonAuthorizing.find((entry) => entry.kind === "stale-residue-active-boundary");
  assert.equal(staleResidueTrust?.count, 2);
  assert.equal(staleResidueTrust?.authority, "insufficient");
  assert.equal(staleResidueTrust?.contractScope, "stale-residue-boundary");
  assert.equal(snapshot.contextTrust.sourceOfTruth.current.some((entry) => entry.kind === "worktree"), false);
  const byBranch = new Map(worktreeReceipts.map((receipt) => [receipt.identifiers.worktree.branch, receipt]));
  const manifestRowsByBranch = new Map(snapshot.activeWorkReceipts.cleanupReviewManifest.rows.map((row) => [row.branch, row]));

  const safe = byBranch.get("dogfood/old-clean-residue");
  assert.equal(safe?.classification, "closedOrStale");
  assert.equal(safe?.identifiers.siblingWorktree?.category, "safe-cleanup");
  assert.match(safe?.reasons.join("\n") ?? "", /stale worktree residue candidate/);
  const safeManifestRow = manifestRowsByBranch.get("dogfood/old-clean-residue");
  assert.equal(safeManifestRow?.reviewId, "safe-cleanup:dogfood/old-clean-residue");
  assert.equal(safeManifestRow?.riskClass, "low-confirm-clean-before-manual-cleanup");
  assert.equal(safeManifestRow?.requiredManualAction, "confirm-no-needed-local-state-before-manual-cleanup");
  assert.match(safeManifestRow?.reason ?? "", /stale worktree residue candidate/);

  const localAhead = byBranch.get("dogfood/local-ahead-orphan");
  assert.equal(localAhead?.classification, "closedOrStale");
  assert.equal(localAhead?.identifiers.siblingWorktree?.category, "salvage-review");
  assert.equal(localAhead?.identifiers.siblingWorktree?.aheadOfBase, 2);
  assert.equal(localAhead?.identifiers.siblingWorktree?.localOnlyCommitPolicy, "do-not-delete-local-only-commits-automatically");
  assert.equal(localAhead?.identifiers.siblingWorktree?.behindBase, 1);
  assert.match(localAhead?.reasons.join("\n") ?? "", /preserve local-only commits/);
  const localAheadManifestRow = manifestRowsByBranch.get("dogfood/local-ahead-orphan");
  assert.equal(localAheadManifestRow?.riskClass, "high-preserve-local-only-state");
  assert.equal(localAheadManifestRow?.requiredManualAction, "preserve-or-cherry-pick-local-only-commits-before-adoption-or-cleanup");
  assert.equal(localAheadManifestRow?.evidence.aheadOfBase, 2);
  assert.equal(localAheadManifestRow?.evidence.remoteBranchExists, false);

  assert.equal(snapshot.activeWorkReceipts.salvageReviewQueue.issue, "#843");
  assert.equal(snapshot.activeWorkReceipts.salvageReviewQueue.readOnly, true);
  assert.equal(snapshot.activeWorkReceipts.salvageReviewQueue.itemCount, 1);
  assert.match(snapshot.activeWorkReceipts.salvageReviewQueue.claimBoundary, /does not delete, push, fetch, mutate/);
  const queueItem = snapshot.activeWorkReceipts.salvageReviewQueue.items[0];
  assert.equal(queueItem.branch, "dogfood/local-ahead-orphan");
  assert.equal(queueItem.head, "333");
  assert.equal(queueItem.category, "salvage-review");
  assert.equal(queueItem.evidence.aheadOfBase, 2);
  assert.equal(queueItem.evidence.behindBase, 1);
  assert.equal(queueItem.evidence.remoteBranchExists, false);
  assert.equal(queueItem.evidence.diff.changed, true);
  assert.match(queueItem.evidence.diff.summary, /2 files changed/);
  assert.equal(queueItem.localOnlyCommitPolicy, "do-not-delete-local-only-commits-automatically");

  const remote = byBranch.get("dogfood/remote-active");
  assert.equal(remote?.classification, "active");
  assert.equal(remote?.identifiers.siblingWorktree?.category, "keep");
  assert.equal(remote?.identifiers.siblingWorktree?.remoteBranchExists, true);

  const receiptJson = JSON.stringify([
    worktreeReceipts,
    snapshot.activeWorkReceipts.salvageReviewQueue,
    snapshot.activeWorkReceipts.staleResidueLedger,
    snapshot.activeWorkReceipts.cleanupReviewManifest,
    snapshot.activeWorkReceipts.staleResidueActiveBoundary,
  ]);
  assert.equal(receiptJson.includes(safeWorktree), false);
  assert.equal(receiptJson.includes(localAheadWorktree), false);
  assert.equal(/worktree remove|branch -d|deleteCommand|manualCleanupCommands/.test(receiptJson), false);
  assert.equal(calls.some((call) => /fetch|worktree remove|branch -d/.test(call)), false);
});

test("operator check receipt marks closed-PR remote worktree residue as non-active noise", () => {
  const tempDir = makeTempProject();
  const siblingRoot = path.dirname(tempDir);
  const closedPrWorktree = path.join(siblingRoot, "fooks-issue-631-rn-compare-inspect-visibility");
  const calls = [];
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-11T08:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args, cwd) => {
      calls.push([command, ...args].join(" "));
      const joined = args.join(" ");
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [
          `worktree ${tempDir}`,
          "HEAD 111",
          "branch refs/heads/main",
          "",
          `worktree ${closedPrWorktree}`,
          "HEAD 222",
          "branch refs/heads/fooks-issue-631-rn-compare-inspect-visibility",
          "",
        ].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\nfooks-issue-631-rn-compare-inspect-visibility\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\norigin/fooks-issue-631-rn-compare-inspect-visibility\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return cwd === closedPrWorktree ? "0 48\n" : "0 0\n";
      if (command === "tmux") return "";
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") {
        return JSON.stringify([
          {
            number: 634,
            url: "https://github.com/minislively/fooks/pull/634",
            headRefName: "fooks-issue-631-rn-compare-inspect-visibility",
            state: "CLOSED",
            closedAt: "2026-05-01T00:00:00Z",
          },
        ]);
      }
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => [tempDir, closedPrWorktree].includes(targetPath),
  });

  assert.equal(snapshot.verdict, "idleRequiresActiveArtifact");
  assert.deepEqual(snapshot.activeArtifacts, []);
  assert.equal(snapshot.requiredActiveArtifact.required, true);
  assert.equal(snapshot.requiredActiveArtifact.dogfoodHandoff.evidenceBoundary, "ci-echo-and-stale-residue-are-not-active-work");
  assert.equal(snapshot.postMergeMainEchoBoundary.echoOnly, true);
  assert.equal(snapshot.activity.currentRunEvidence.classification, "mainEchoNonActive");
  assert.equal(snapshot.activity.currentRunEvidence.mainEchoEvidence, true);
  assert.equal(snapshot.activity.currentRunEvidence.evidence.openIssues, 0);
  assert.equal(snapshot.activity.currentRunEvidence.evidence.openPullRequests, 0);
  assert.equal(snapshot.activeWorkReceipts.classification, "closedOrStale");
  const receipt = snapshot.activeWorkReceipts.receipts.find(
    (item) => item.kind === "worktree" && item.identifiers.worktree.branch === "fooks-issue-631-rn-compare-inspect-visibility",
  );
  assert.equal(receipt?.classification, "closedOrStale");
  assert.equal(receipt?.identifiers.siblingWorktree?.category, "manual-review-noise");
  assert.equal(receipt?.identifiers.siblingWorktree?.remoteBranchExists, true);
  assert.equal(receipt?.identifiers.siblingWorktree?.openPullRequestState, "none");
  assert.equal(receipt?.identifiers.siblingWorktree?.closedPullRequestState, "closed");
  assert.match(receipt?.reasons.join("\n") ?? "", /#723/);
  assert.match(receipt?.reasons.join("\n") ?? "", /closed pull request evidence.*#634/);
  assert.match(snapshot.activeWorkReceipts.reportLine, /closedOrStale=1/);
  assert.match(snapshot.activeWorkReceipts.reportLine, /staleResidueLedger=1/);
  assert.deepEqual(snapshot.activeWorkReceipts.staleResidueLedger.counts, {
    "safe-cleanup": 0,
    "salvage-review": 0,
    "manual-review-noise": 1,
  });
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.staleResidueCount, 1);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.activeArtifactReceiptCount, 0);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.satisfiesActiveArtifactRequirement, false);
  assert.equal(snapshot.activeWorkReceipts.reportLine.includes(closedPrWorktree), false);
  assert.equal(calls.some((call) => /fetch|worktree remove|branch -d/.test(call)), false);
});

test("operator check receipt marks detached PR review worktree leftovers as non-active cleanup-review noise", () => {
  const tempDir = makeTempProject();
  const siblingRoot = path.dirname(tempDir);
  const reviewLeftover = path.join(siblingRoot, "fooks-pr-728-review");
  const calls = [];
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-11T12:30:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args, cwd) => {
      calls.push([command, ...args].join(" "));
      const joined = args.join(" ");
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [
          `worktree ${tempDir}`,
          "HEAD 111",
          "branch refs/heads/main",
          "",
          `worktree ${reviewLeftover}`,
          "HEAD dcb590c",
          "detached",
          "",
        ].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") {
        return cwd === reviewLeftover ? "3 files changed, 15 insertions(+), 2 deletions(-)\n" : "";
      }
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") {
        return cwd === reviewLeftover ? "0 5\n" : "0 0\n";
      }
      if (command === "tmux") return "";
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") {
        return JSON.stringify([
          {
            number: 728,
            url: "https://github.com/minislively/fooks/pull/728",
            headRefName: "dogfood/issue-728-review",
            state: "MERGED",
            closedAt: "2026-05-10T00:00:00Z",
          },
        ]);
      }
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => [tempDir, reviewLeftover].includes(targetPath),
  });

  assert.equal(snapshot.activeWorkReceipts.classification, "closedOrStale");
  const receipt = snapshot.activeWorkReceipts.receipts.find(
    (item) => item.kind === "worktree" && item.identifiers.worktree.head === "dcb590c",
  );
  assert.equal(receipt?.classification, "closedOrStale");
  assert.equal(receipt?.identifiers.worktree.branch, undefined);
  assert.equal(receipt?.identifiers.siblingWorktree?.category, "manual-review-noise");
  assert.equal(receipt?.identifiers.siblingWorktree?.remoteBranchExists, "unknown");
  assert.equal(receipt?.identifiers.siblingWorktree?.openPullRequestState, "none");
  assert.equal(receipt?.identifiers.siblingWorktree?.closedPullRequestState, "closed");
  assert.equal(receipt?.identifiers.siblingWorktree?.activeTmuxPaneCount, 0);
  assert.equal(receipt?.identifiers.siblingWorktree?.aheadOfBase, 5);
  assert.match(receipt?.reasons.join("\n") ?? "", /#733/);
  assert.match(receipt?.reasons.join("\n") ?? "", /detached fooks PR review worktree leftover/);
  assert.match(receipt?.reasons.join("\n") ?? "", /do not auto-delete, push, or mutate/i);
  assert.match(snapshot.activeWorkReceipts.reportLine, /closedOrStale=1/);
  assert.match(snapshot.activeWorkReceipts.reportLine, /staleResidueLedger=1/);
  assert.deepEqual(snapshot.activeWorkReceipts.staleResidueLedger.counts, {
    "safe-cleanup": 0,
    "salvage-review": 0,
    "manual-review-noise": 1,
  });
  assert.equal(snapshot.activeWorkReceipts.salvageReviewQueue.itemCount, 0);

  const receiptJson = JSON.stringify([
    receipt,
    snapshot.activeWorkReceipts.salvageReviewQueue,
    snapshot.activeWorkReceipts.staleResidueLedger,
  ]);
  assert.equal(/worktree remove|branch -d|deleteCommand|manualCleanupCommands/.test(receiptJson), false);
  assert.equal(calls.some((call) => /fetch|worktree remove|branch -d|push/.test(call)), false);
});

test("operator check stale residue ledger aggregates manual-review-noise and excludes keep entries", () => {
  const tempDir = makeTempProject();
  const siblingRoot = path.dirname(tempDir);
  const closedPrWorktree = path.join(siblingRoot, "fooks-issue-631-rn-compare-inspect-visibility");
  const reviewLeftover = path.join(siblingRoot, "fooks-pr-728-review");
  const keepWorktree = path.join(siblingRoot, "remote-active");
  const calls = [];
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-11T13:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args, cwd) => {
      calls.push([command, ...args].join(" "));
      const joined = args.join(" ");
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [
          `worktree ${tempDir}`,
          "HEAD 111",
          "branch refs/heads/main",
          "",
          `worktree ${closedPrWorktree}`,
          "HEAD 222",
          "branch refs/heads/fooks-issue-631-rn-compare-inspect-visibility",
          "",
          `worktree ${reviewLeftover}`,
          "HEAD dcb590c",
          "detached",
          "",
          `worktree ${keepWorktree}`,
          "HEAD 444",
          "branch refs/heads/dogfood/remote-active",
          "",
        ].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") {
        return "main\nfooks-issue-631-rn-compare-inspect-visibility\ndogfood/remote-active\n";
      }
      if (command === "git" && joined === "branch -r --format=%(refname:short)") {
        return "origin/main\norigin/fooks-issue-631-rn-compare-inspect-visibility\norigin/dogfood/remote-active\n";
      }
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") {
        if (cwd === reviewLeftover) return "3 files changed, 15 insertions(+), 2 deletions(-)\n";
        if (cwd === keepWorktree) return "1 file changed, 1 insertion(+)\n";
        return "";
      }
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") {
        if (cwd === closedPrWorktree) return "0 48\n";
        if (cwd === reviewLeftover) return "0 5\n";
        if (cwd === keepWorktree) return "0 1\n";
        return "0 0\n";
      }
      if (command === "tmux") return "";
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") {
        return JSON.stringify([
          {
            number: 634,
            url: "https://github.com/minislively/fooks/pull/634",
            headRefName: "fooks-issue-631-rn-compare-inspect-visibility",
            state: "CLOSED",
            closedAt: "2026-05-01T00:00:00Z",
          },
          {
            number: 728,
            url: "https://github.com/minislively/fooks/pull/728",
            headRefName: "dogfood/issue-728-review",
            state: "MERGED",
            closedAt: "2026-05-10T00:00:00Z",
          },
        ]);
      }
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => [tempDir, closedPrWorktree, reviewLeftover, keepWorktree].includes(targetPath),
  });

  const ledger = snapshot.activeWorkReceipts.staleResidueLedger;
  assert.equal(ledger.totalCount, 2);
  assert.deepEqual(ledger.counts, {
    "safe-cleanup": 0,
    "salvage-review": 0,
    "manual-review-noise": 2,
  });
  assert.deepEqual(ledger.classes.map((row) => row.category), [
    "safe-cleanup",
    "salvage-review",
    "manual-review-noise",
  ]);
  assert.equal(ledger.classes[2].nextReviewAction, "confirm-closed-pr-or-detached-review-context-before-ignoring");
  assert.match(snapshot.activeWorkReceipts.reportLine, /staleResidueLedger=2/);
  assert.match(snapshot.activeWorkReceipts.reportLine, /cleanupReviewManifest=2\(#739\)/);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.staleResidueCount, 2);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.activeArtifactReceiptCount, 0);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.satisfiesActiveArtifactRequirement, false);

  const manifest = snapshot.activeWorkReceipts.cleanupReviewManifest;
  assert.equal(manifest.issue, "#739");
  assert.equal(manifest.rowCount, 2);
  assert.deepEqual(manifest.rows.map((row) => row.category), ["manual-review-noise", "manual-review-noise"]);
  assert.deepEqual(new Set(manifest.rows.map((row) => row.riskClass)), new Set(["medium-confirm-stale-context"]));
  assert.deepEqual(
    new Set(manifest.rows.map((row) => row.requiredManualAction)),
    new Set(["confirm-closed-pr-or-detached-review-context-before-ignoring"]),
  );
  assert.equal(JSON.stringify(manifest).includes(keepWorktree), false);

  const worktreeReceipts = snapshot.activeWorkReceipts.receipts.filter((receipt) => receipt.kind === "worktree");
  assert.equal(worktreeReceipts.filter((receipt) => receipt.identifiers.siblingWorktree?.category === "manual-review-noise").length, 2);
  assert.equal(worktreeReceipts.filter((receipt) => receipt.identifiers.siblingWorktree?.category === "keep").length, 1);
  assert.equal(JSON.stringify(ledger).includes(keepWorktree), false);
  assert.equal(/worktree remove|branch -d|deleteCommand|manualCleanupCommands/.test(JSON.stringify([ledger, manifest])), false);
  assert.equal(calls.some((call) => /fetch|worktree remove|branch -d|push/.test(call)), false);
});

test("operator activity exposes bounded stale legacy closed worktree evidence for zero-count reminders", () => {
  const tempDir = makeTempProject();
  fs.mkdirSync(path.join(tempDir, "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(tempDir, "docs", "closed-artifact-branch-archive-685.md"),
    [
      "# Archive: `fooks-closed-artifact-685` stale branch (#685)",
      "",
      "## Bounded evidence",
      "- Remote branch: `origin/fooks-closed-artifact-685`",
      "",
    ].join("\n"),
  );

  const staleWorktree = path.join(path.dirname(tempDir), "fooks.omx-worktrees", "fooks-closed-artifact-685");
  const calls = [];
  const snapshot = readOperatorActivitySnapshot(tempDir, {
    includeRemoteCounts: true,
    now: () => "2026-05-10T01:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      calls.push([command, ...args].join(" "));
      const joined = args.join(" ");
      if (command === "git" && joined === "worktree list --porcelain") {
        return [
          `worktree ${tempDir}`,
          "HEAD 111",
          "branch refs/heads/main",
          "",
          `worktree ${staleWorktree}`,
          "HEAD 222",
          "branch refs/heads/fooks-closed-artifact-685",
          "",
        ].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\nfooks-closed-artifact-685\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "tmux") return "not-related\t/tmp/no-active-pane\tzsh\n";
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir || targetPath === staleWorktree || targetPath === path.join(tempDir, "docs"),
  });

  assert.deepEqual(snapshot.optionalCounts, {
    enabled: true,
    source: OPERATOR_ACTIVITY_REMOTE_SOURCE,
    openIssues: 0,
    openPullRequests: 0,
    blockers: [],
  });
  assert.equal(snapshot.tmux.available, true);
  assert.deepEqual(snapshot.tmux.sessions, []);
  assert.equal(snapshot.legacyWorktreeEvidence.available, true);
  assert.equal(snapshot.legacyWorktreeEvidence.source, "status artifacts");
  assert.equal(snapshot.legacyWorktreeEvidence.staleClosedArtifactWorktreeCount, 1);
  assert.equal(snapshot.legacyWorktreeEvidence.entryLimit, OPERATOR_ACTIVITY_LEGACY_WORKTREE_ENTRY_LIMIT);
  assert.equal(snapshot.legacyWorktreeEvidence.omittedEntryCount, 0);
  assert.equal(snapshot.legacyWorktreeEvidence.cleanupCommandsIncluded, false);
  assert.deepEqual(snapshot.legacyWorktreeEvidence.blockers, []);
  assert.equal(snapshot.currentRunEvidence.classification, "mainEchoNonActive");
  assert.equal(snapshot.currentRunEvidence.mainEchoEvidence, true);
  assert.equal(snapshot.currentRunEvidence.activeWorkEvidence, false);
  assert.equal(snapshot.currentRunEvidence.evidence.legacyStaleClosedArtifactWorktreeCount, 1);
  assert.ok(
    snapshot.currentRunEvidence.reasons.includes(
      "legacy closed-artifact worktree evidence is separated from active current-run evidence",
    ),
  );
  assert.deepEqual(snapshot.legacyWorktreeEvidence.entries, [
    {
      path: staleWorktree,
      branch: "fooks-closed-artifact-685",
      head: "222",
      status: "staleClosedArtifact",
      reasons: [
        "branch has local branch-archive evidence",
        "no tmux panes map to this worktree",
        "worktree is not the current working directory",
      ],
      archiveEvidence: {
        sourcePath: path.join("docs", "closed-artifact-branch-archive-685.md"),
        matchType: "remote-branch",
        matchedRef: "origin/fooks-closed-artifact-685",
        lineNumber: 4,
      },
      activeSessionEvidence: "no tmux panes mapped to this worktree",
    },
  ]);

  const legacyJson = JSON.stringify(snapshot.legacyWorktreeEvidence);
  assert.equal(legacyJson.includes("manualCleanupCommands"), false);
  assert.equal(legacyJson.includes("cleanupOrder"), false);
  assert.equal(legacyJson.includes("staleRuntimeCleanups"), false);
  assert.equal(calls.some((call) => /fetch|worktree remove|branch -d|kill-session/.test(call)), false);
});

test("operator check surfaces legacy local residue as cleanup-review evidence only", () => {
  const tempDir = makeTempProject();
  fs.mkdirSync(path.join(tempDir, "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(tempDir, "docs", "fooks-issue-778-branch-archive.md"),
    [
      "# Archive: `fooks-issue-767-legacy-residue` stale branch (#767)",
      "",
      "- Remote branch: `origin/fooks-issue-767-legacy-residue`",
      "",
    ].join("\n"),
  );

  const staleWorktree = path.join(path.dirname(tempDir), "fooks.omx-worktrees", "fooks-issue-767-legacy-residue");
  const calls = [];
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-13T00:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args, cwd) => {
      calls.push([command, ...args].join(" "));
      const joined = args.join(" ");
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [
          `worktree ${tempDir}`,
          "HEAD 111",
          "branch refs/heads/main",
          "",
          `worktree ${staleWorktree}`,
          "HEAD 767767",
          "branch refs/heads/fooks-issue-767-legacy-residue",
          "",
        ].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\nfooks-issue-767-legacy-residue\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return cwd === staleWorktree ? "0 0\n" : "0 0\n";
      if (command === "tmux") return "not-related\t/tmp/no-active-pane\tzsh\n";
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") return "[]";
      if (command === "gh" && joined.startsWith("run list ")) return "[]";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir || targetPath === staleWorktree || targetPath === path.join(tempDir, "docs"),
  });

  assert.equal(snapshot.verdict, "idleRequiresActiveArtifact");
  assert.equal(snapshot.postMergeMainEchoBoundary.mainEchoEvidence, true);
  assert.deepEqual(snapshot.activeArtifacts, []);
  assert.equal(snapshot.requiredActiveArtifact.required, true);
  assert.deepEqual(snapshot.requiredActiveArtifact.acceptableArtifacts, [
    "open GitHub issue",
    "open GitHub pull request",
    "mapped fooks tmux session",
  ]);
  assert.equal(snapshot.requiredActiveArtifact.dogfoodHandoff.status, "requires-live-artifact");
  assert.equal(snapshot.requiredActiveArtifact.dogfoodHandoff.requiredBeforeNextDevelopmentAction, true);
  assert.equal(
    snapshot.requiredActiveArtifact.dogfoodHandoff.evidenceBoundary,
    "ci-echo-and-stale-residue-are-not-active-work",
  );

  const review = snapshot.activeWorkReceipts.legacyLocalResidueCleanupReview;
  assert.equal(review.issue, "#778");
  assert.equal(review.readOnly, true);
  assert.equal(review.rowCount, 1);
  assert.equal(review.cleanupCommandsIncluded, false);
  assert.equal(review.staleLocalResidueIsActiveWorkEvidence, false);
  assert.equal(review.satisfiesActiveArtifactRequirement, false);
  assert.match(review.claimBoundary, /never counts it as active work/);
  assert.match(snapshot.activeWorkReceipts.reportLine, /legacyLocalResidueCleanupReview=1\(#778\)/);
  assert.equal(snapshot.activeWorkReceipts.localOnlyResidueActiveBoundary.issue, "#853");
  assert.equal(snapshot.activeWorkReceipts.localOnlyResidueActiveBoundary.readOnly, true);
  assert.deepEqual(snapshot.activeWorkReceipts.localOnlyResidueActiveBoundary.activeRequirementEvidence, {
    openIssueCount: 0,
    openPullRequestCount: 0,
    mappedFooksTmuxProcSessionCount: 0,
  });
  assert.deepEqual(snapshot.activeWorkReceipts.localOnlyResidueActiveBoundary.cleanupReviewResidueEvidence, {
    siblingStaleResidueCount: 0,
    legacyLocalResidueCount: 1,
    totalLocalOnlyResidueCount: 1,
  });
  assert.equal(snapshot.activeWorkReceipts.localOnlyResidueActiveBoundary.localOnlyResidueIsActiveWorkEvidence, false);
  assert.equal(snapshot.activeWorkReceipts.localOnlyResidueActiveBoundary.satisfiesActiveArtifactRequirement, false);
  assert.equal(snapshot.activeWorkReceipts.localOnlyResidueActiveBoundary.cleanupReviewEvidenceOnly, true);
  assert.match(snapshot.activeWorkReceipts.localOnlyResidueActiveBoundary.claimBoundary, /separates open issue, open PR, mapped fooks tmux\/proc session counts/);
  assert.match(snapshot.activeWorkReceipts.localOnlyResidueActiveBoundary.reminder, /cleanup-review evidence only/);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.activeArtifactReceiptCount, 0);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.satisfiesActiveArtifactRequirement, false);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.staleResidueIsActiveWorkEvidence, false);
  assert.deepEqual(snapshot.activeWorkReceipts.staleResidueActiveBoundary.acceptableActiveArtifacts, [
    "open GitHub issue",
    "open GitHub pull request",
    "mapped fooks tmux session",
  ]);
  assert.equal(
    snapshot.activeWorkReceipts.receipts.some((receipt) => receipt.classification === "active"),
    false,
  );

  assert.deepEqual(review.rows, [
    {
      reviewId: "legacy-local-residue:fooks-issue-767-legacy-residue",
      path: staleWorktree,
      branch: "fooks-issue-767-legacy-residue",
      head: "767767",
      status: "staleClosedArtifact",
      reasons: [
        "branch has local branch-archive evidence",
        "no tmux panes map to this worktree",
        "worktree is not the current working directory",
      ],
      archiveEvidence: {
        sourcePath: path.join("docs", "fooks-issue-778-branch-archive.md"),
        matchType: "remote-branch",
        matchedRef: "origin/fooks-issue-767-legacy-residue",
        lineNumber: 3,
      },
      activeSessionEvidence: "no tmux panes mapped to this worktree",
      staleLocalResidueIsActiveWorkEvidence: false,
      satisfiesActiveArtifactRequirement: false,
      requiredManualAction: "confirm-closed-or-merged-artifact-before-manual-cleanup-review",
    },
  ]);

  const reviewJson = JSON.stringify(review);
  assert.equal(/worktree remove|branch -d|deleteCommand|manualCleanupCommands|cleanupOrder/.test(reviewJson), false);
  assert.equal(calls.some((call) => /fetch|worktree remove|branch -d|push|kill-session/.test(call)), false);
});

test("operator check classifies eight legacy review worktrees as stale manual-review evidence for clean-slate nudges", () => {
  const tempDir = makeTempProject();
  fs.mkdirSync(path.join(tempDir, "docs"), { recursive: true });
  const legacyBranches = Array.from({ length: 8 }, (_, index) => `fooks-review-legacy-pr-${index + 1}`);
  fs.writeFileSync(
    path.join(tempDir, "docs", "fooks-issue-865-branch-archive.md"),
    [
      "# Issue #865 legacy review worktree archive",
      "",
      ...legacyBranches.map((branch) => `- Remote branch: \`origin/${branch}\``),
      "",
    ].join("\n"),
  );

  const staleWorktrees = new Map(
    legacyBranches.map((branch) => [
      branch,
      path.join(path.dirname(tempDir), "fooks.omx-worktrees", branch),
    ]),
  );
  const calls = [];
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-15T00:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args, cwd) => {
      calls.push([command, ...args].join(" "));
      const joined = args.join(" ");
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        const rows = [`worktree ${tempDir}`, "HEAD mainsha", "branch refs/heads/main", ""];
        for (const [branch, worktreePath] of staleWorktrees) {
          rows.push(`worktree ${worktreePath}`, `HEAD ${branch.replace(/\W/gu, "").slice(0, 12)}`, `branch refs/heads/${branch}`, "");
        }
        return rows.join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return ["main", ...legacyBranches].join("\n") + "\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") {
        assert.ok(cwd === tempDir || [...staleWorktrees.values()].includes(cwd), `unexpected divergence cwd ${cwd}`);
        return "0 0\n";
      }
      if (command === "tmux") return "not-related\t/tmp/no-active-pane\tzsh\n";
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") return "[]";
      if (command === "gh" && joined.startsWith("run list ")) return "[]";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) =>
      targetPath === tempDir
      || targetPath === path.join(tempDir, "docs")
      || [...staleWorktrees.values()].includes(targetPath),
  });

  assert.equal(snapshot.verdict, "idleRequiresActiveArtifact");
  assert.deepEqual(snapshot.activeArtifacts, []);
  assert.equal(snapshot.requiredActiveArtifact.required, true);
  assert.equal(snapshot.requiredActiveArtifact.dogfoodHandoff.status, "requires-live-artifact");
  assert.equal(snapshot.activity.legacyWorktreeEvidence.staleClosedArtifactWorktreeCount, 8);
  assert.equal(snapshot.activity.legacyWorktreeEvidence.omittedEntryCount, 3);
  assert.equal(snapshot.activeWorkReceipts.legacyLocalResidueCleanupReview.rowCount, OPERATOR_ACTIVITY_LEGACY_WORKTREE_ENTRY_LIMIT);

  const boundary = snapshot.activeWorkReceipts.legacyReviewWorktreeResidueBoundary;
  assert.equal(boundary.issue, "#865");
  assert.equal(boundary.readOnly, true);
  assert.equal(boundary.legacyReviewWorktreeResidueCount, 8);
  assert.equal(boundary.classification, "stale-manual-review-evidence");
  assert.equal(boundary.staleManualReviewEvidenceOnly, true);
  assert.equal(boundary.satisfiesActiveDevelopmentRequirement, false);
  assert.deepEqual(boundary.acceptableActiveDevelopmentEvidence, [
    "open GitHub issue",
    "non-main active branch",
    "mapped fooks tmux session",
    "open GitHub pull request",
    "concrete blocker",
  ]);
  assert.match(boundary.claimBoundary, /issue #865/);
  assert.match(boundary.claimBoundary, /stale\/manual-review evidence only/);
  assert.match(boundary.nudgeRule, /issue, branch, session, PR evidence, or a concrete blocker/);
  assert.equal(
    snapshot.activeWorkReceipts.receipts.some((receipt) => receipt.classification === "active"),
    false,
  );
  const cleanupReviewGuard = snapshot.activeWorkReceipts.legacyReviewResidueCleanupReviewGuard;
  assert.equal(cleanupReviewGuard.issue, "#895");
  assert.equal(cleanupReviewGuard.readOnly, true);
  assert.equal(cleanupReviewGuard.cleanupReviewEvidence.legacyReviewWorktreeResidueCount, 8);
  assert.equal(cleanupReviewGuard.cleanupReviewEvidence.legacyLocalResidueCleanupReviewRowCount, OPERATOR_ACTIVITY_LEGACY_WORKTREE_ENTRY_LIMIT);
  assert.equal(cleanupReviewGuard.cleanupReviewEvidence.classification, "operator-cleanup-review-evidence");
  assert.equal(cleanupReviewGuard.cleanupReviewEvidence.actionableOperatorResidue, true);
  assert.deepEqual(cleanupReviewGuard.currentActiveAnchorEvidence, {
    openIssueCount: 0,
    openPullRequestCount: 0,
    mappedFooksTmuxProcSessionCount: 0,
    activeArtifactReceiptCount: 0,
    activeAnchorPresent: false,
  });
  assert.equal(cleanupReviewGuard.auditProvenanceBoundary.command, "worktree:audit");
  assert.equal(cleanupReviewGuard.auditProvenanceBoundary.linkedIssue, "#854");
  assert.equal(cleanupReviewGuard.auditProvenanceBoundary.triageLinkedIssue, "#711");
  assert.equal(cleanupReviewGuard.auditProvenanceBoundary.staleReviewCandidatesZeroMeansNoActiveAnchor, false);
  assert.equal(cleanupReviewGuard.auditProvenanceBoundary.entriesKeepRootMeansCurrentActiveWork, false);
  assert.equal(cleanupReviewGuard.residueSatisfiesActiveAnchorRequirement, false);
  assert.equal(cleanupReviewGuard.cleanupReviewEvidenceIsActiveWork, false);
  assert.match(cleanupReviewGuard.nudgeRediscoveryRule, /actionable cleanup-review evidence/);
  assert.match(cleanupReviewGuard.nudgeRediscoveryRule, /must not be rediscovered as current active work/);


  const receiptJson = JSON.stringify(snapshot.activeWorkReceipts);
  assert.equal(/worktree remove|branch -d|deleteCommand|manualCleanupCommands|cleanupOrder|kill-session/.test(receiptJson), false);
  assert.equal(calls.some((call) => /fetch|worktree remove|branch -d|push|kill-session/.test(call)), false);
});

test("operator check requires post-receipt nudge anchor after #866 main CI release receipts", () => {
  const tempDir = makeTempProject();
  const mainHead = "866-main-receipt-head";
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-15T12:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return "";
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") return "[]";
      if (command === "gh" && args[0] === "run") {
        return JSON.stringify([
          {
            databaseId: 86601,
            status: "completed",
            conclusion: "success",
            updatedAt: "2026-05-15T11:40:00Z",
            headBranch: "main",
            headSha: mainHead,
            event: "push",
            workflowName: "CI",
            url: "https://github.com/minislively/fooks/actions/runs/86601",
          },
          {
            databaseId: 86602,
            status: "completed",
            conclusion: "success",
            updatedAt: "2026-05-15T11:45:00Z",
            headBranch: "main",
            headSha: mainHead,
            event: "push",
            workflowName: "React Web Release Report",
            url: "https://github.com/minislively/fooks/actions/runs/86602",
          },
        ]);
      }
      if (command === "git" && joined === "config --get remote.origin.url") return "https://github.com/minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, `HEAD ${mainHead}`, "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return `${mainHead}\n`;
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.verdict, "idleRequiresActiveArtifact");
  assert.equal(snapshot.postMergeMainCiEvidence.summary.allExactHeadConclusionsSuccessful, true);
  assert.equal(snapshot.activeWorkReceipts.classification, "mainEcho");

  const boundary = snapshot.activeWorkReceipts.postReceiptNudgeAnchorBoundary;
  assert.equal(boundary.issue, "#867");
  assert.equal(boundary.readOnly, true);
  assert.equal(boundary.closedLegacyWorktreeBucketReceipt.issue, "#866");
  assert.equal(boundary.closedLegacyWorktreeBucketReceipt.activeDevelopmentEvidence, false);
  assert.equal(boundary.mainCiReleaseSuccessReceipt.allExactHeadConclusionsSuccessful, true);
  assert.equal(boundary.mainCiReleaseSuccessReceipt.activeDevelopmentEvidence, false);
  assert.deepEqual(boundary.currentAnchorEvidence, {
    openIssueCount: 0,
    openPullRequestCount: 0,
    nonMainBranch: undefined,
    mappedFooksTmuxSessionCount: 0,
    concreteBlockerCount: 0,
  });
  assert.equal(boundary.requiresFreshPostReceiptNudgeAnchor, true);
  assert.deepEqual(boundary.acceptableFreshAnchors, [
    "new issue",
    "non-main branch",
    "mapped fooks tmux session",
    "open pull request",
    "concrete blocker",
  ]);
  assert.match(boundary.claimBoundary, /issue #867/);
  assert.match(boundary.claimBoundary, /#866 main CI\/release success/);
  assert.match(boundary.nudgeRule, /must name a fresh issue, branch, session, PR anchor, or a concrete blocker/);
  assert.match(boundary.nudgeRule, /main CI\/release success is receipt-only/);

  const receiptJson = JSON.stringify(snapshot.activeWorkReceipts);
  assert.equal(/worktree remove|branch -d|deleteCommand|manualCleanupCommands|cleanupOrder|kill-session/.test(receiptJson), false);
});

test("operator check requires issue plus OMX session evidence after #868 receipt-only nudge loop", () => {
  const tempDir = makeTempProject();
  const mainHead = "868-main-receipt-head";
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-15T12:20:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return "";
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") return "[]";
      if (command === "gh" && args[0] === "run") {
        return JSON.stringify([
          {
            databaseId: 86801,
            status: "completed",
            conclusion: "success",
            updatedAt: "2026-05-15T12:00:00Z",
            headBranch: "main",
            headSha: mainHead,
            event: "push",
            workflowName: "CI",
            url: "https://github.com/minislively/fooks/actions/runs/86801",
          },
        ]);
      }
      if (command === "git" && joined === "config --get remote.origin.url") return "https://github.com/minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, `HEAD ${mainHead}`, "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return `${mainHead}\n`;
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  const boundary = snapshot.activeWorkReceipts.receiptOnlyNudgeLoopBoundary;
  assert.equal(boundary.issue, "#869");
  assert.equal(boundary.readOnly, true);
  assert.equal(boundary.priorReceipt.pullRequest, "#868");
  assert.equal(boundary.priorReceipt.lastMergedCommitOrMainCiRunIsActiveDevelopmentEvidence, false);
  assert.deepEqual(boundary.currentRequiredEvidence, {
    newlyCreatedOrAdoptedIssueCount: 0,
    mappedOmxSessionCount: 0,
  });
  assert.equal(boundary.requiresIssueAndOmxSessionEvidence, true);
  assert.equal(boundary.satisfiesNudgeReportAnchorRequirement, false);
  assert.equal(boundary.repeatedReceiptOnlyReportAllowed, false);
  assert.deepEqual(boundary.requiredReportEvidence, [
    "newly created/adopted issue evidence",
    "mapped OMX session evidence",
  ]);
  assert.deepEqual(boundary.prohibitedReportAnchors, [
    "last merged commit",
    "main CI run",
    "release receipt",
  ]);
  assert.match(boundary.claimBoundary, /issue #869/);
  assert.match(boundary.claimBoundary, /PR #868 receipt-only closeout/);
  assert.match(boundary.nudgeRule, /newly created\/adopted issue evidence plus mapped OMX session evidence/);
  assert.match(boundary.nudgeRule, /last merged commit or main CI run/);

  const receiptJson = JSON.stringify(snapshot.activeWorkReceipts);
  assert.equal(/worktree remove|branch -d|deleteCommand|manualCleanupCommands|cleanupOrder|kill-session/.test(receiptJson), false);
});

test("operator check satisfies #869 only when issue and OMX session evidence are both present", () => {
  const tempDir = makeTempProject();
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-15T12:25:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return `omx-issue-869\t${tempDir}\tzsh\n`;
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[{\"number\":869}]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") return "[]";
      if (command === "gh" && args[0] === "run") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "https://github.com/minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD issue-869-active-head", "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "issue-869-active-head\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  const boundary = snapshot.activeWorkReceipts.receiptOnlyNudgeLoopBoundary;
  assert.deepEqual(boundary.currentRequiredEvidence, {
    newlyCreatedOrAdoptedIssueCount: 1,
    mappedOmxSessionCount: 1,
  });
  assert.equal(boundary.requiresIssueAndOmxSessionEvidence, false);
  assert.equal(boundary.satisfiesNudgeReportAnchorRequirement, true);
  assert.equal(boundary.repeatedReceiptOnlyReportAllowed, false);
  assert.match(boundary.nudgeRule, /may proceed only by naming the newly created\/adopted issue evidence and mapped OMX session evidence/);
});


test("operator check exposes issue #885 handoff artifact evidence rule", () => {
  const tempDir = makeTempProject();
  const idleSnapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-16T06:20:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return "";
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") return "[]";
      if (command === "gh" && args[0] === "run") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "https://github.com/minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD issue-885-idle-head", "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "issue-885-idle-head\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: /** @param {string} targetPath */ (targetPath) => targetPath === tempDir,
  });

  const idleBoundary = idleSnapshot.activeWorkReceipts.handoffArtifactEvidence;
  assert.equal(idleBoundary.issue, "#885");
  assert.equal(idleBoundary.readOnly, true);
  assert.equal(idleBoundary.handoffRule, "adopt-live-artifact-else-create-exactly-one");
  assert.deepEqual(idleBoundary.adoptableLiveArtifacts, [
    "open GitHub issue",
    "open GitHub pull request",
    "mapped fooks tmux session",
    "live non-main worktree",
  ]);
  assert.deepEqual(idleBoundary.currentEvidence, {
    openIssueCount: 0,
    openPullRequestCount: 0,
    mappedFooksTmuxSessionCount: 0,
    liveMappedFooksTmuxSessionCount: 0,
    liveNonMainWorktreePresent: false,
    activeReceiptCount: 0,
  });
  assert.equal(idleBoundary.adoptedLiveArtifactPresent, false);
  assert.equal(idleBoundary.runCreatedArtifactRequirement.required, true);
  assert.equal(idleBoundary.runCreatedArtifactRequirement.exactlyOne, true);
  assert.deepEqual(idleBoundary.runCreatedArtifactRequirement.allowedArtifactKinds, ["issue", "branch", "session"]);
  assert.match(idleBoundary.nextReportRule, /create exactly one issue, branch, or session/);
  assert.match(idleBoundary.claimBoundary, /issue #885/);

  const worktreeOnlySnapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-16T06:22:00.000Z",
    runner: () => "",
    gitRunner: /** @param {string} _cwd @param {string[]} args */ (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "dogfood/issue-885-worktree-only\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "1\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: /** @param {string} command @param {string[]} args */ (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return "";
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") return "[]";
      if (command === "gh" && args[0] === "run") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "https://github.com/minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD issue-885-worktree-only-head", "branch refs/heads/dogfood/issue-885-worktree-only", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-head\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\ndogfood/issue-885-worktree-only\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return " 1 file changed, 5 insertions(+)\n";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "1 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: /** @param {string} targetPath */ (targetPath) => targetPath === tempDir,
  });

  const worktreeOnlyBoundary = worktreeOnlySnapshot.activeWorkReceipts.handoffArtifactEvidence;
  assert.equal(worktreeOnlySnapshot.verdict, "idleRequiresActiveArtifact");
  assert.equal(worktreeOnlySnapshot.requiredActiveArtifact.required, true);
  assert.equal(worktreeOnlyBoundary.adoptedLiveArtifactPresent, true);
  assert.equal(worktreeOnlyBoundary.runCreatedArtifactRequirement.required, false);
  assert.equal(worktreeOnlyBoundary.currentEvidence.liveNonMainWorktreePresent, true);
  assert.match(worktreeOnlyBoundary.nextReportRule, /separate from the top-level requiredActiveArtifact issue\/PR\/session contract/);
  const worktreeOnlyTrust = worktreeOnlySnapshot.contextTrust.nonAuthorizing.find((entry) => entry.kind === "live-non-main-worktree-handoff-candidate");
  assert.equal(worktreeOnlyTrust?.authority, "handoff-candidate");
  assert.equal(worktreeOnlyTrust?.contractScope, "handoff-artifact-boundary");
  assert.equal(worktreeOnlyTrust?.live, true);
  assert.equal(worktreeOnlySnapshot.contextTrust.sourceOfTruth.current.some((entry) => entry.kind === "worktree"), false);
  const worktreeOnlyPreflight = buildPreflightPacket(worktreeOnlySnapshot);
  assert.equal(worktreeOnlyPreflight.summary.authorityStatus, "missing");
  assert.equal(worktreeOnlyPreflight.guidance.riskLevel, "high");
  assert.equal(worktreeOnlyPreflight.guidance.recommendedAction, "adopt-or-report-live-handoff");
  assert.equal(worktreeOnlyPreflight.nonAuthorizing.some((entry) =>
    entry.authority === "handoff-candidate"
    && entry.contractScope === "handoff-artifact-boundary"
    && entry.live === true
  ), true);

  const staleSessionWorktree = path.join(tempDir, ".omx-worktrees", "issue-885-stale-session");
  const staleSessionOnlySnapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-16T06:23:00.000Z",
    runner: () => "",
    gitRunner: /** @param {string} _cwd @param {string[]} args */ (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: /** @param {string} command @param {string[]} args */ (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return `fooks-issue-885-stale\t${staleSessionWorktree} (deleted)\tzsh\n`;
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") return "[]";
      if (command === "gh" && args[0] === "run") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "https://github.com/minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD issue-885-stale-session-head", "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "issue-885-stale-session-head\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: /** @param {string} targetPath */ (targetPath) => targetPath === tempDir,
  });

  const staleSessionOnlyBoundary = staleSessionOnlySnapshot.activeWorkReceipts.handoffArtifactEvidence;
  assert.equal(staleSessionOnlyBoundary.currentEvidence.mappedFooksTmuxSessionCount, 1);
  assert.equal(staleSessionOnlyBoundary.currentEvidence.liveMappedFooksTmuxSessionCount, 0);
  assert.equal(staleSessionOnlyBoundary.adoptedLiveArtifactPresent, false);
  assert.equal(staleSessionOnlyBoundary.runCreatedArtifactRequirement.required, true);
  assert.equal(staleSessionOnlyBoundary.satisfiesHandoffRule, false);
  assert.equal(staleSessionOnlySnapshot.contextTrust.sourceOfTruth.current.find((entry) => entry.kind === "session")?.count, 1);
  const liveSessionCaveat = staleSessionOnlySnapshot.contextTrust.nonAuthorizing.find((entry) => entry.kind === "mapped-session-live-handoff-caveat");
  assert.equal(liveSessionCaveat?.count, 1);
  assert.equal(liveSessionCaveat?.live, false);
  assert.equal(liveSessionCaveat?.contractScope, "handoff-artifact-boundary");
  assert.match(liveSessionCaveat?.reason ?? "", /top-level active-artifact\/session-count evidence/);
  const staleSessionPreflight = buildPreflightPacket(staleSessionOnlySnapshot);
  assert.equal(staleSessionPreflight.summary.authorityStatus, "present");
  assert.equal(staleSessionPreflight.guidance.riskLevel, "medium");
  assert.equal(staleSessionPreflight.guidance.recommendedAction, "continue-with-current-authority");
  assert.equal(staleSessionPreflight.currentAuthority.find((entry) => entry.kind === "session")?.contractScope, "top-level-active-artifact");

  const activeSnapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-16T06:25:00.000Z",
    runner: () => " M docs/dogfood/fooks-check-handoff-artifact-evidence-885.md\0",
    gitRunner: /** @param {string} _cwd @param {string[]} args */ (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "dogfood/issue-885-fooks-check-artifact-evidence\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "1\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: /** @param {string} command @param {string[]} args */ (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return `fooks-dogfood-issue-885-fooks-check-artifact-evidence\t${tempDir}\tnode\n`;
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[{\"number\":885}]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") return "[]";
      if (command === "gh" && args[0] === "run") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "https://github.com/minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD issue-885-active-head", "branch refs/heads/dogfood/issue-885-fooks-check-artifact-evidence", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-head\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\ndogfood/issue-885-fooks-check-artifact-evidence\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return " M docs/dogfood/fooks-check-handoff-artifact-evidence-885.md\0";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return " 1 file changed, 20 insertions(+)\n";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "1 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: /** @param {string} targetPath */ (targetPath) => targetPath === tempDir,
  });

  const activeBoundary = activeSnapshot.activeWorkReceipts.handoffArtifactEvidence;
  assert.equal(activeBoundary.adoptedLiveArtifactPresent, true);
  assert.equal(activeBoundary.runCreatedArtifactRequirement.required, false);
  assert.equal(activeBoundary.satisfiesHandoffRule, true);
  assert.equal(activeBoundary.currentEvidence.openIssueCount, 1);
  assert.equal(activeBoundary.currentEvidence.mappedFooksTmuxSessionCount, 1);
  assert.equal(activeBoundary.currentEvidence.liveMappedFooksTmuxSessionCount, 1);
  assert.equal(activeBoundary.currentEvidence.liveNonMainWorktreePresent, true);
  assert.match(activeBoundary.nextReportRule, /Adopt the live issue, PR, mapped fooks tmux session, or live non-main worktree/);

  const receiptJson = JSON.stringify(activeSnapshot.activeWorkReceipts);
  assert.equal(/worktree remove|branch -d|deleteCommand|manualCleanupCommands|cleanupOrder|kill-session/.test(receiptJson), false);
});

test("operator activity keeps legacy worktree inference conservative when tmux is unavailable", () => {
  const tempDir = makeTempProject();
  fs.mkdirSync(path.join(tempDir, "docs"), { recursive: true });
  fs.writeFileSync(path.join(tempDir, "docs", "closed-artifact-branch-archive-685.md"), "Branch inspected: `origin/fooks-closed-artifact-685`\n");
  const staleWorktree = path.join(path.dirname(tempDir), "fooks.omx-worktrees", "fooks-closed-artifact-685");

  const snapshot = readOperatorActivitySnapshot(tempDir, {
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD 111", "branch refs/heads/main", "", `worktree ${staleWorktree}`, "HEAD 222", "branch refs/heads/fooks-closed-artifact-685", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\nfooks-closed-artifact-685\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "tmux") throw new Error("tmux missing");
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir || targetPath === staleWorktree,
  });

  assert.equal(snapshot.legacyWorktreeEvidence.available, true);
  assert.equal(snapshot.legacyWorktreeEvidence.staleClosedArtifactWorktreeCount, 0);
  assert.deepEqual(snapshot.legacyWorktreeEvidence.entries, []);
  assert.match(snapshot.legacyWorktreeEvidence.blockers.join("\n"), /tmux pane list unavailable: tmux missing/);
});

test("operator activity classifies stale deleted tmux worktree panes with manual cleanup guidance", () => {
  const tempDir = makeTempProject();
  const staleWorktree = path.join(tempDir, ".omx-worktrees", "fooks-issue-467-stale-worktree-cleanup");
  const snapshot = readOperatorActivitySnapshot(tempDir, {
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command) => {
      if (command === "tmux") return `fooks-issue-467\t${staleWorktree} (deleted)\tzsh\n`;
      throw new Error(`unexpected command ${command}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.tmux.sessions.length, 1);
  assert.equal(snapshot.tmux.sessions[0].session, "fooks-issue-467");
  assert.equal(snapshot.tmux.sessions[0].current, false);
  assert.equal(snapshot.tmux.sessions[0].status, "staleRuntimeCandidate");
  assert.deepEqual(snapshot.tmux.sessions[0].reasons, ["all panes point at missing or deleted paths"]);
  assert.deepEqual(snapshot.tmux.sessions[0].panes, [
    {
      path: `${staleWorktree} (deleted)`,
      exists: false,
      deleted: true,
      current: false,
      command: "zsh",
    },
  ]);
  assert.deepEqual(snapshot.tmux.sessions[0].manualCleanupCommands, ["tmux kill-session -t 'fooks-issue-467'"]);
  assert.deepEqual(snapshot.tmux.sessions[0].cleanupOrder, [
    "Verify the PR/worktree is no longer active",
    "Stop the stale tmux/OMX/Codex session manually",
    "Run any git worktree prune/remove follow-up only after the runtime is stopped",
  ]);
});

test("operator activity treats tmux and opt-in GitHub count failures as non-fatal blockers", () => {
  const tempDir = makeTempProject();
  const snapshot = readOperatorActivitySnapshot(tempDir, {
    includeRemoteCounts: true,
    runner: () => "",
    gitRunner: () => { throw new Error("no branch"); },
    commandRunner: (command, args) => {
      if (command === "tmux") throw new Error("tmux missing");
      if (command === "gh" && args[0] === "issue") return "[{\"number\":1},{\"number\":2}]";
      throw new Error("gh unavailable");
    },
  });

  assert.equal(snapshot.tmux.available, false);
  assert.match(snapshot.tmux.blockers.join("\n"), /tmux missing/);
  assert.equal(snapshot.optionalCounts.enabled, true);
  assert.equal(snapshot.optionalCounts.source, OPERATOR_ACTIVITY_REMOTE_SOURCE);
  assert.equal(snapshot.optionalCounts.openIssues, 2);
  assert.equal(snapshot.optionalCounts.openPullRequests, undefined);
  assert.match(snapshot.optionalCounts.blockers.join("\n"), /gh unavailable/);
  assert.match(snapshot.blockers.join("\n"), /tmux missing/);
  assert.match(snapshot.blockers.join("\n"), /gh unavailable/);
});

test("operator check receipt classifies stale session and legacy closed branch without unsafe cleanup details", () => {
  const tempDir = makeTempProject();
  fs.mkdirSync(path.join(tempDir, "docs"), { recursive: true });
  fs.writeFileSync(path.join(tempDir, "docs", "closed-artifact-branch-archive-714.md"), "Branch inspected: `origin/fooks-issue-714-old`\n");
  const staleWorktree = path.join(path.dirname(tempDir), "fooks.omx-worktrees", "fooks-issue-714-old");
  const deletedPanePath = path.join(path.dirname(tempDir), "fooks.omx-worktrees", "fooks-issue-714-deleted");
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-10T04:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [
          `worktree ${tempDir}`,
          "HEAD 111",
          "branch refs/heads/main",
          "",
          `worktree ${staleWorktree}`,
          "HEAD 222",
          "branch refs/heads/fooks-issue-714-old",
          "",
        ].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\nfooks-issue-714-old\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      if (command === "tmux") return `fooks-issue-714-deleted\t${deletedPanePath} (deleted)\tzsh\n`;
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir || targetPath === staleWorktree,
  });

  assert.equal(snapshot.activeWorkReceipts.classification, "closedOrStale");
  const staleSession = snapshot.activeWorkReceipts.receipts.find((receipt) => receipt.kind === "session");
  assert.equal(staleSession?.classification, "closedOrStale");
  assert.deepEqual(staleSession?.identifiers.session, { name: "fooks-issue-714-deleted", paneCount: 1 });
  const closedBranch = snapshot.activeWorkReceipts.receipts.find(
    (receipt) => receipt.kind === "branch" && receipt.identifiers.worktree.branch === "fooks-issue-714-old",
  );
  assert.equal(closedBranch?.classification, "closedOrStale");

  assert.equal(snapshot.activeWorkReceipts.legacyLocalResidueCleanupReview.rowCount, 1);
  assert.equal(snapshot.activeWorkReceipts.legacyLocalResidueCleanupReview.rows[0].path, staleWorktree);
  assert.equal(snapshot.activeWorkReceipts.legacyLocalResidueCleanupReview.rows[0].satisfiesActiveArtifactRequirement, false);

  const receiptJson = JSON.stringify(snapshot.activeWorkReceipts);
  assert.equal(receiptJson.includes(deletedPanePath), false);
  assert.equal(receiptJson.includes("tmux kill-session"), false);
  assert.equal(receiptJson.includes("manualCleanupCommands"), false);
  assert.equal(receiptJson.includes("cleanupOrder"), false);
  assert.equal(snapshot.activeWorkReceipts.reportLine.includes(staleWorktree), false);
  assert.equal(snapshot.activeWorkReceipts.reportLine.includes("kill-session"), false);
});

test("status activity CLI route preserves existing status contracts", () => {
  const tempDir = makeTempProject();
  const before = fs.readdirSync(tempDir).sort();

  const check = run(["check"], tempDir);
  assert.equal(check.command, OPERATOR_CHECK_COMMAND);
  assert.equal(check.readOnly, true);
  assert.equal(check.activity.optionalCounts.enabled, true);
  assert.equal(check.contextTrust.schemaVersion, 1);
  assert.equal(check.contextTrust.researchReference, OPERATOR_CONTEXT_TRUST_RESEARCH_REFERENCE);
  assert.equal(check.contextTrust.advisoryOnly.every((entry) => typeof entry.contractScope === "string"), true);
  assert.equal("preflight" in check, false);
  assert.deepEqual(fs.readdirSync(tempDir).sort(), before);

  const preflight = run(["preflight", "--json"], tempDir);
  assert.equal(preflight.command, PREFLIGHT_COMMAND);
  assert.equal(preflight.source, PREFLIGHT_SOURCE);
  assert.equal(preflight.derivedFrom.operatorCheckCommand, OPERATOR_CHECK_COMMAND);
  assert.equal(preflight.derivedFrom.operatorCheckSchemaVersion, 1);
  assert.equal(preflight.derivedFrom.contextTrustSchemaVersion, 1);
  assert.equal(typeof preflight.claimBoundary, "string");
  assert.equal(typeof preflight.summary.authorityStatus, "string");
  assert.equal(typeof preflight.guidance.riskLevel, "string");
  assert.equal(typeof preflight.guidance.recommendedAction, "string");
  assert.equal(Array.isArray(preflight.currentAuthority), true);
  assert.equal(Array.isArray(preflight.nonAuthorizing), true);
  assert.equal(preflight.advisoryOnly.every((entry) => typeof entry.contractScope === "string"), true);
  assert.deepEqual(fs.readdirSync(tempDir).sort(), before);

  const preflightText = runText(["preflight"], tempDir);
  assert.doesNotMatch(preflightText.trimStart(), /^\{/);
  assert.match(preflightText, /^Preflight: /);
  assert.match(preflightText, /Risk: /);
  assert.match(preflightText, /Action: /);
  assert.match(preflightText, /Authority: /);
  assert.match(preflightText, /no cleanup, authority creation, hook enforcement, or new evidence collection was performed/);
  assert.deepEqual(fs.readdirSync(tempDir).sort(), before);

  const activity = run(["status", "activity"], tempDir);
  assert.equal(activity.command, OPERATOR_ACTIVITY_COMMAND);
  assert.equal(activity.optionalCounts.enabled, false);
  assert.equal(activity.readOnly, true);
  assert.equal(activity.runtimeProvenance.schemaVersion, 1);
  assert.notEqual(activity.runtimeProvenance, null);
  assert.equal(activity.runtimeProvenance.artifacts.executionKind, "built-dist");
  assert.match(activity.runtimeProvenance.artifacts.operatorActivityModulePath, /dist[\\/]ops[\\/]operator-activity\.js$/);
  assert.deepEqual(fs.readdirSync(tempDir).sort(), before);

  const bare = run(["status"], tempDir);
  assert.equal(bare.schemaVersion, 1);
  assert.equal(bare.metricTier, "estimated");
  assert.equal("worktree" in bare, false);
  assert.equal("tmux" in bare, false);
  assert.equal("optionalCounts" in bare, false);

  const worktree = run(["status", "worktree"], tempDir);
  assert.equal(worktree.schemaVersion, 1);
  assert.equal("tmux" in worktree, false);
  assert.equal("optionalCounts" in worktree, false);

  const artifacts = run(["status", "artifacts"], tempDir);
  assert.equal(artifacts.command, "status artifacts");
  assert.ok(Array.isArray(artifacts.manualCleanupCommands));
  assert.equal("optionalCounts" in artifacts, false);

  const help = runText(["--help"], tempDir);
  assert.match(help, /fooks check \[--json\]/);
  assert.match(help, /fooks preflight \[--json\]/);
  assert.match(help, /fooks status activity \[--include-remote-counts\]/);

  let output = "";
  try {
    runText(["check", "--unexpected"], tempDir);
  } catch (error) {
    output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  assert.match(output, /Unexpected check argument/);

  output = "";
  try {
    runText(["preflight", "--unexpected"], tempDir);
  } catch (error) {
    output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  assert.match(output, /Unexpected preflight argument/);

  output = "";
  try {
    runText(["status", "activity", "--unexpected"], tempDir);
  } catch (error) {
    output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  assert.match(output, /Unexpected status activity argument/);
  assert.match(OPERATOR_ACTIVITY_REMOTE_COUNTS_FLAG, /--include-remote-counts/);
});

test("source checkout npm operator aliases route to built CLI behavior", () => {
  const check = runNpmScript("check", ["--json"]);
  assert.equal(check.command, OPERATOR_CHECK_COMMAND);
  assert.equal(check.readOnly, true);
  assert.equal(check.activity.optionalCounts.enabled, true);
  assert.equal(check.runtimeProvenance.artifacts.executionKind, "built-dist");
  assert.match(check.runtimeProvenance.artifacts.cliEntrypointPath, /dist[\\/]cli[\\/]index\.js$/);
  assert.match(check.runtimeProvenance.artifacts.operatorCheckModulePath, /dist[\\/]ops[\\/]operator-check\.js$/);

  const activity = runNpmScript("status:activity", ["--json"]);
  assert.equal(activity.command, OPERATOR_ACTIVITY_COMMAND);
  assert.equal(activity.readOnly, true);
  assert.equal(activity.optionalCounts.enabled, false);
  assert.equal(activity.runtimeProvenance.artifacts.executionKind, "built-dist");
  assert.match(activity.runtimeProvenance.artifacts.cliEntrypointPath, /dist[\\/]cli[\\/]index\.js$/);
  assert.match(activity.runtimeProvenance.artifacts.operatorActivityModulePath, /dist[\\/]ops[\\/]operator-activity\.js$/);
});

test("operator check JSON includes narrow issue #960 runtime/token-cost planning advisory", () => {
  const tempDir = makeTempProject();
  const branch = "fooks-issue-960-runtime-token-cost-plan";
  const head = "issue-960-head";
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-19T02:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return `${branch}\n`;
      if (args[0] === "rev-parse") return `${head}\n`;
      if (args[0] === "rev-list") return "1\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return "";
      if (command === "gh" && joined === "issue list --state open --json number,title,url --limit 20") {
        return JSON.stringify([{ number: 960, title: "runtime token cost planning", url: "https://github.com/minislively/fooks/issues/960" }]);
      }
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "gh" && args[0] === "run") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, `HEAD ${head}`, `branch refs/heads/${branch}`, ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-head\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return `${branch}\nmain\n`;
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 1\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.planningWarnings.length, 1);
  assert.equal(snapshot.planningWarnings[0].issue, "#960");
  assert.equal(snapshot.planningWarnings[0].trigger, "branch-issue-960");
  assert.match(snapshot.planningWarnings[0].message, /#961 preflight, #962 stale-context, and #963 handoff contracts/);
  assert.match(snapshot.planningWarnings[0].claimBoundary, /Advisory planning warning only/);
  assert.equal(snapshot.reliabilityWarningVisibility.source, OPERATOR_CHECK_RELIABILITY_WARNING_VISIBILITY_SOURCE);
  assert.equal(snapshot.reliabilityWarningVisibility.status, "advisory");
  assert.equal(snapshot.reliabilityWarningVisibility.summary.planningWarningCount, 1);
  assert.equal(snapshot.reliabilityWarningVisibility.summary.existingWarningCount, snapshot.planningWarnings.length + snapshot.combinedReliabilityWarnings.length + snapshot.longRunBudgetWarnings.length + snapshot.resetCompactHandoffRecommendations.length);
  assert.equal(snapshot.reliabilityWarningVisibility.derivedFrom.contextTrustSource, snapshot.contextTrust.source);
  assert.equal(snapshot.reliabilityWarningVisibility.warnings.some((warning) => warning.kind === "runtime-planning" && warning.issue === "#960"), true);
  assert.match(snapshot.reliabilityWarningVisibility.claimBoundary, /existing contextTrust\/source-of-truth, runtime planning advisory, sequentialPlanningHints, combinedReliabilityWarnings, longRunBudgetWarnings, and resetCompactHandoffRecommendations fields only/);
  assert.deepEqual(snapshot.sequentialPlanningHints, []);
});

test("operator check JSON includes compact issue #992 resume handoff projection", () => {
  const tempDir = makeTempProject();
  const branch = "fooks-issue-992-operator-check-resume-projection";
  const head = "issue-992-head";
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-20T14:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return `${branch}\n`;
      if (args[0] === "rev-parse") return `${head}\n`;
      if (args[0] === "rev-list") return "1\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return "";
      if (command === "gh" && joined === "issue list --state open --json number,title,url --limit 20") {
        return JSON.stringify([{ number: 992, title: "resume projection", url: "https://github.com/minislively/fooks/issues/992" }]);
      }
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "gh" && args[0] === "run") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, `HEAD ${head}`, `branch refs/heads/${branch}`, ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-head\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return `${branch}\nmain\n`;
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 1\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  const projection = snapshot.resumeHandoffProjection;
  assert.equal(projection.schemaVersion, 1);
  assert.equal(projection.issue, "#992");
  assert.equal(projection.status, "advisory");
  assert.equal(projection.compact, true);
  assert.equal(projection.readOnly, true);
  assert.equal(projection.source, OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_SOURCE);
  assert.equal(projection.derivedFrom.operatorCheckCommand, OPERATOR_CHECK_COMMAND);
  assert.deepEqual(projection.derivedFrom.fields, [
    "contextTrust.sourceOfTruth.current",
    "contextTrust.nonAuthorizing",
    "contextTrust.historicalOnly",
    "planningWarnings",
    "combinedReliabilityWarnings",
    "sequentialPlanningHints",
    "planBeforeExecuteGuards",
    "longRunBudgetWarnings",
    "resetCompactHandoffRecommendations",
    "reliabilityWarningVisibility",
  ]);
  assert.equal(projection.summary.currentAuthorityCount, snapshot.contextTrust.sourceOfTruth.current.length);
  assert.equal(projection.summary.staleOrHistoricalBoundaryCount, snapshot.contextTrust.nonAuthorizing.length + snapshot.contextTrust.historicalOnly.length);
  assert.equal(projection.summary.planningWarningCount, snapshot.planningWarnings.length);
  assert.equal(projection.summary.combinedReliabilityWarningCount, snapshot.combinedReliabilityWarnings.length);
  assert.equal(projection.summary.reliabilityWarningCount, snapshot.reliabilityWarningVisibility.summary.existingWarningCount);
  assert.equal(projection.currentAuthority.status, snapshot.contextTrust.sourceOfTruth.current.length > 0 ? "present" : "missing");
  assert.match(projection.claimBoundary, /derived only from existing operator-check contextTrust\/source-of-truth/);
  assert.match(projection.claimBoundary, /adds no provider\/runtime telemetry, CI\/merge authority, product claims, or frontend behavior/);
  assert.match(projection.forbiddenClaims.join("\n"), /provider\/runtime telemetry/);
  assert.match(projection.forbiddenClaims.join("\n"), /autonomous CI\/merge authority/);
});

test("operator check reliability warning visibility surfaces existing advisory warnings", () => {
  const planningWarnings = buildRuntimeTokenCostPlanningWarnings({ branch: "fooks-issue-960-runtime-token-cost-plan" });
  const contextTrust = syntheticPreflightSnapshot({
    nonAuthorizing: [
      {
        kind: "stale-residue-active-boundary",
        source: "synthetic stale residue",
        reason: "synthetic stale residue risk",
        referenceField: "staleResidueActiveBoundary",
        contractScope: "stale-residue-boundary",
        authority: "insufficient",
      },
    ],
  }).contextTrust;
  const combinedReliabilityWarnings = buildCombinedReliabilityWarnings({ contextTrust, planningWarnings });

  const visibility = buildOperatorCheckReliabilityWarningVisibility({
    contextTrust,
    planningWarnings,
    combinedReliabilityWarnings,
    longRunBudgetWarnings: [],
  });

  assert.equal(visibility.schemaVersion, 1);
  assert.equal(visibility.source, OPERATOR_CHECK_RELIABILITY_WARNING_VISIBILITY_SOURCE);
  assert.equal(visibility.status, "advisory");
  assert.deepEqual(visibility.summary, {
    existingWarningCount: 2,
    planningWarningCount: 1,
    combinedReliabilityWarningCount: 1,
    sequentialPlanningHintCount: 0,
    longRunBudgetWarningCount: 0,
    resetCompactHandoffRecommendationCount: 0,
    contextTrustCurrentAuthorityCount: 0,
    contextTrustNonAuthorizingCount: 1,
    contextTrustHistoricalOnlyCount: 0,
  });
  assert.equal(visibility.warnings[0].kind, "runtime-planning");
  assert.equal(visibility.warnings[0].issue, "#960");
  assert.equal(visibility.warnings[1].kind, "combined-reliability");
  assert.equal(visibility.warnings[1].trigger, "context-risk-and-runtime-planning-overlap");
  assert.deepEqual(visibility.derivedFrom, {
    contextTrustSource: OPERATOR_CONTEXT_TRUST_SOURCE,
    planningWarningsField: "planningWarnings",
    sequentialPlanningHintsField: "sequentialPlanningHints",
    combinedReliabilityWarningsField: "combinedReliabilityWarnings",
    longRunBudgetWarningsField: "longRunBudgetWarnings",
    resetCompactHandoffRecommendationsField: "resetCompactHandoffRecommendations",
  });
  assert.equal(visibility.claimBoundary, OPERATOR_CHECK_RELIABILITY_WARNING_VISIBILITY_CLAIM_BOUNDARY);
  assert.match(visibility.claimBoundary, /adds no telemetry, provider\/runtime hooks, token\/cost accounting, merge-gate policy, product claims, or frontend behavior/);
});

test("operator check resume handoff projection is bounded and derived from existing reliability fields", () => {
  const planningWarnings = buildRuntimeTokenCostPlanningWarnings({ branch: "fooks-issue-976-runtime-planning-warning" });
  const contextTrust = syntheticPreflightSnapshot({
    current: [
      {
        kind: "issue",
        source: "synthetic active artifact",
        reason: "synthetic current issue",
        referenceField: "activeArtifacts",
        count: 1,
        authority: "current-work",
        contractScope: "top-level-active-artifact",
      },
    ],
    nonAuthorizing: Array.from({ length: 10 }, (_value, index) => ({
      kind: `synthetic-stale-${index}`,
      source: "synthetic stale residue",
      reason: "synthetic stale residue risk",
      referenceField: "staleResidueActiveBoundary",
      contractScope: "stale-residue-boundary",
      authority: "insufficient",
    })),
  }).contextTrust;
  const combinedReliabilityWarnings = buildCombinedReliabilityWarnings({ contextTrust, planningWarnings });
  const sequentialPlanningHints = buildSequentialPlanningHints({
    branch: "fooks-issue-982-sequential-planning-hint",
    planningWarnings,
    combinedReliabilityWarnings,
  });
  const planBeforeExecuteGuards = [
    {
      schemaVersion: 1,
      issue: "#983",
      status: "advisory",
      trigger: "synthetic",
      stopBeforeMoreExecution: true,
      message: "synthetic guard",
      recommendedActions: ["write-plan-before-execute"],
      requiredRechecks: ["synthetic recheck"],
      forbiddenClaims: ["synthetic merge authority"],
      claimBoundary: "synthetic claim boundary",
    },
  ];
  const longRunBudgetWarnings = [];
  const reliabilityWarningVisibility = buildOperatorCheckReliabilityWarningVisibility({
    contextTrust,
    planningWarnings,
    combinedReliabilityWarnings,
    longRunBudgetWarnings,
  });

  const projection = buildOperatorCheckResumeHandoffProjection({
    contextTrust,
    planningWarnings,
    combinedReliabilityWarnings,
    sequentialPlanningHints,
    planBeforeExecuteGuards,
    longRunBudgetWarnings,
    reliabilityWarningVisibility,
  });

  assert.equal(projection.source, OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_SOURCE);
  assert.equal(projection.claimBoundary, OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_CLAIM_BOUNDARY);
  assert.equal(projection.summary.stopBeforeMoreExecution, true);
  assert.equal(projection.summary.reliabilityWarningCount, reliabilityWarningVisibility.summary.existingWarningCount);
  assert.equal(projection.summary.staleOrHistoricalBoundaryCount, 10);
  assert.equal(projection.staleHistoricalBoundary.entries.length, 8);
  assert.equal(projection.staleHistoricalBoundary.entryLimit, 8);
  assert.equal(projection.staleHistoricalBoundary.omittedCount, 2);
  assert.equal(projection.nextSessionAdvisory.action, "stop-before-more-execution");
  assert.ok(projection.nextSessionAdvisory.requiredRechecks.includes("synthetic recheck"));
  assert.ok(projection.nextSessionAdvisory.requiredRechecks.includes("Run fooks check --json in the new session before treating this projection as current authority."));
  assert.ok(projection.forbiddenClaims.includes("provider/runtime telemetry"));
  assert.ok(projection.forbiddenClaims.includes("frontend behavior or product-support change"));
});

test("operator check JSON includes narrow issue #976 long-run planning advisory", () => {
  const tempDir = makeTempProject();
  const branch = "fooks-issue-976-runtime-planning-warning";
  const head = "issue-976-head";
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-19T22:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return `${branch}\n`;
      if (args[0] === "rev-parse") return `${head}\n`;
      if (args[0] === "rev-list") return "1\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return "";
      if (command === "gh" && joined === "issue list --state open --json number,title,url --limit 20") {
        return JSON.stringify([{ number: 976, title: "runtime planning warning", url: "https://github.com/minislively/fooks/issues/976" }]);
      }
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "gh" && args[0] === "run") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, `HEAD ${head}`, `branch refs/heads/${branch}`, ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-head\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return `${branch}\nmain\n`;
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 1\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.planningWarnings.length, 1);
  assert.equal(snapshot.planningWarnings[0].issue, "#976");
  assert.equal(snapshot.planningWarnings[0].trigger, "branch-issue-976");
  assert.match(snapshot.planningWarnings[0].message, /plan\/checkpoint\/compression or handoff review/);
  assert.match(snapshot.planningWarnings[0].claimBoundary, /issues #960\/#976/);
  assert.deepEqual(snapshot.sequentialPlanningHints, []);
  assert.equal(snapshot.planBeforeExecuteGuards.length, 1);
  assert.equal(snapshot.longRunBudgetWarnings.length, 1);
  assert.equal(snapshot.longRunBudgetWarnings[0].issue, "#988");
  assert.equal(snapshot.longRunBudgetWarnings[0].riskLevel, "high");
  assert.equal(snapshot.reliabilityWarningVisibility.summary.longRunBudgetWarningCount, 1);
  assert.equal(snapshot.reliabilityWarningVisibility.summary.resetCompactHandoffRecommendationCount, 0);
  assert.ok(snapshot.reliabilityWarningVisibility.warnings.some((warning) => warning.kind === "long-run-budget"));
});

test("operator check JSON includes narrow issue #982 sequential planning hint", () => {
  const tempDir = makeTempProject();
  const branch = "fooks-issue-982-sequential-planning-hint";
  const head = "issue-982-head";
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-20T04:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return `${branch}\n`;
      if (args[0] === "rev-parse") return `${head}\n`;
      if (args[0] === "rev-list") return "1\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return "";
      if (command === "gh" && joined === "issue list --state open --json number,title,url --limit 20") {
        return JSON.stringify([{ number: 982, title: "sequential planning hint", url: "https://github.com/minislively/fooks/issues/982" }]);
      }
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "gh" && args[0] === "run") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, `HEAD ${head}`, `branch refs/heads/${branch}`, ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-head\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return `${branch}\nmain\n`;
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 1\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.deepEqual(snapshot.planningWarnings, []);
  assert.deepEqual(snapshot.combinedReliabilityWarnings, []);
  assert.equal(snapshot.sequentialPlanningHints.length, 1);
  assert.equal(snapshot.sequentialPlanningHints[0].issue, "#982");
  assert.equal(snapshot.sequentialPlanningHints[0].trigger, "branch-issue-982");
  assert.deepEqual(snapshot.sequentialPlanningHints[0].recommendations, [
    "write-plan-before-execute",
    "split-long-work-into-bounded-steps",
    "checkpoint-or-compress-current-source-of-truth",
    "handoff-before-burning-another-context-window",
  ]);
  assert.match(snapshot.sequentialPlanningHints[0].claimBoundary, /does not prove provider billing\/runtime token usage/);
  assert.match(snapshot.sequentialPlanningHints[0].forbiddenClaims.join("\n"), /autonomous execution authority/);
});

test("operator check JSON includes prompt-derived issue #1006 sequential planning hint without blocking execution", () => {
  const tempDir = makeTempProject();
  fs.writeFileSync(
    path.join(tempDir, ".fooks-session-task.txt"),
    "Implement this in multiple phases: first inspect, then patch, then test, before PR verify build.",
  );
  const branch = "feature-normal";
  const head = "prompt-sequential-head";
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-21T04:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return `${branch}\n`;
      if (args[0] === "rev-parse") return `${head}\n`;
      if (args[0] === "rev-list") return "1\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return "";
      if (command === "gh" && joined === "issue list --state open --json number,title,url --limit 20") return "[]";
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "gh" && args[0] === "run") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, `HEAD ${head}`, `branch refs/heads/${branch}`, ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-head\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return `${branch}\nmain\n`;
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 1\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.sequentialPlanningHints.length, 1);
  assert.equal(snapshot.sequentialPlanningHints[0].issue, "#1006");
  assert.equal(snapshot.sequentialPlanningHints[0].trigger, "prompt-implies-sequential-execution");
  assert.equal(snapshot.sequentialPlanningHints[0].derivedFrom.promptEvidence, "sequential-intent");
  assert.deepEqual(snapshot.planBeforeExecuteGuards, []);
  assert.ok(snapshot.reliabilityWarningVisibility.warnings.some((warning) => warning.kind === "sequential-planning" && warning.issue === "#1006"));
  assert.equal(snapshot.reliabilityWarningVisibility.summary.sequentialPlanningHintCount, 1);
});

test("sequential planning hint builder is deterministic, bounded, and trigger-gated", () => {
  const planningWarnings = buildRuntimeTokenCostPlanningWarnings({ branch: "fooks-issue-976-runtime-planning-warning" });
  const contextTrust = syntheticPreflightSnapshot({
    nonAuthorizing: [
      {
        kind: "stale-residue-active-boundary",
        source: "synthetic stale residue",
        reason: "synthetic stale residue risk",
        referenceField: "staleResidueActiveBoundary",
        contractScope: "stale-residue-boundary",
        authority: "insufficient",
      },
    ],
  }).contextTrust;
  const combinedReliabilityWarnings = buildCombinedReliabilityWarnings({ contextTrust, planningWarnings });

  const hints = buildSequentialPlanningHints({
    branch: "feature-without-issue",
    planningWarnings,
    combinedReliabilityWarnings,
  });

  assert.equal(hints.length, 1);
  assert.equal(hints[0].schemaVersion, 1);
  assert.equal(hints[0].issue, "#982");
  assert.equal(hints[0].status, "advisory");
  assert.equal(hints[0].trigger, "combined-reliability-warning-present");
  assert.deepEqual(hints[0].recommendations, [
    "write-plan-before-execute",
    "split-long-work-into-bounded-steps",
    "checkpoint-or-compress-current-source-of-truth",
    "handoff-before-burning-another-context-window",
  ]);
  assert.match(hints[0].message, /Sequential or multi-phase coding run detected/);
  assert.deepEqual(hints[0].derivedFrom, {
    planningWarningCount: 1,
    combinedReliabilityWarningCount: 1,
    planningWarningsField: "planningWarnings",
    combinedReliabilityWarningsField: "combinedReliabilityWarnings",
    promptEvidence: "not-provided",
    runLabelEvidence: "no-sequential-intent",
  });
  assert.equal(hints[0].claimBoundary, SEQUENTIAL_PLANNING_HINT_CLAIM_BOUNDARY);
  assert.match(hints[0].claimBoundary, /does not prove provider billing\/runtime token usage/);
  assert.match(hints[0].claimBoundary, /grant autonomous execution or merge authority/);
  assert.match(hints[0].forbiddenClaims.join("\n"), /runtime-token savings proof/);
  assert.match(hints[0].forbiddenClaims.join("\n"), /runtime\/provider support expansion/);

  assert.deepEqual(buildSequentialPlanningHints({ branch: "feature-without-issue", planningWarnings: [], combinedReliabilityWarnings: [] }), []);

  const issueHints = buildSequentialPlanningHints({
    branch: "fooks-issue-982-sequential-planning-hint",
    planningWarnings: [],
    combinedReliabilityWarnings: [],
  });
  assert.equal(issueHints.length, 1);
  assert.equal(issueHints[0].trigger, "branch-issue-982");

  const promptHints = buildSequentialPlanningHints({
    prompt: "Implement Issue #1006 in multiple phases: first inspect, then patch, then test, before PR verify build.",
    planningWarnings: [],
    combinedReliabilityWarnings: [],
  });
  assert.equal(promptHints.length, 1);
  assert.equal(promptHints[0].issue, "#1006");
  assert.equal(promptHints[0].trigger, "prompt-implies-sequential-execution");
  assert.equal(promptHints[0].derivedFrom.promptEvidence, "sequential-intent");
  assert.equal(promptHints[0].derivedFrom.runLabelEvidence, "not-provided");
  assert.match(promptHints[0].claimBoundary, /block execution/);

  const runHints = buildSequentialPlanningHints({
    runLabel: "fooks-issue-1006-sequential-planning-hints",
    planningWarnings: [],
    combinedReliabilityWarnings: [],
  });
  assert.equal(runHints.length, 1);
  assert.equal(runHints[0].trigger, "run-label-implies-sequential-execution");

  assert.deepEqual(buildSequentialPlanningHints({
    prompt: "Explain what a sequence diagram means.",
    runLabel: "feature-normal-cleanup",
    planningWarnings: [],
    combinedReliabilityWarnings: [],
  }), []);
});
