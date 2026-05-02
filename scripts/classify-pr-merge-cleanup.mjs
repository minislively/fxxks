#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const options = { input: "", output: "", format: "markdown" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") options.input = argv[++index];
    else if (arg === "--output") options.output = argv[++index];
    else if (arg === "--json") options.format = "json";
    else if (arg === "--markdown") options.format = "markdown";
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/classify-pr-merge-cleanup.mjs [options]\n\nRead-only classifier for gh pr merge --delete-branch transcripts. It separates\npost-merge local branch/worktree cleanup fallout from actual merge failure.\n\nOptions:\n  --input <path|->  Read transcript from a file or stdin (default: stdin)\n  --json            Emit machine-readable JSON\n  --markdown        Emit markdown (default)\n  --output <path>   Write output to a file instead of stdout\n  -h, --help        Show this help\n\nExample:\n  gh pr merge 351 --delete-branch 2>&1 | tee /tmp/pr-351-merge.txt\n  npm run --silent pr:merge-cleanup -- --input /tmp/pr-351-merge.txt --json`);
}

function readTranscript(input) {
  if (!input || input === "-") return fs.readFileSync(0, "utf8");
  return fs.readFileSync(path.resolve(repoRoot, input), "utf8");
}

function extractFirst(pattern, text) {
  const match = text.match(pattern);
  return match ? match[1] : "";
}

function classifyTranscript(transcript) {
  const text = String(transcript ?? "");
  const mergedEvidence = /(?:✓|\bMerged\b).*\b[Mm]erged pull request\b|\bPull request\b.*\bwas merged\b|\bSuccessfully merged\b/i.test(text);
  const localDeleteFailure = /(?:failed to delete local branch|cannot delete branch|branch .* is currently checked out|checked out at )/i.test(text);
  const worktreeCheckout = /checked out at\s+'?([^'\n\r]+)'?/i.test(text);
  const remoteDeleteEvidence = /(?:Deleted remote branch|remote branch .* deleted)/i.test(text);
  const mergeFailureEvidence = /(?:merge conflict|failed to merge|pull request .* was not merged|not possible to fast-forward|requires status checks|merge queue failed)/i.test(text);
  const branch = extractFirst(/(?:failed to delete local branch|cannot delete branch)\s+'?([^'\n\r:]+)'?/i, text)
    || extractFirst(/branch\s+'([^']+)'\s+is currently checked out/i, text);
  const worktreePath = worktreeCheckout ? extractFirst(/checked out at\s+'?([^'\n\r]+)'?/i, text).replace(/[.,;:!?]+$/, "") : "";

  let classification = "needs-review";
  let disposition = "inspect-transcript";
  let reason = "Transcript does not contain enough merge-success and local-cleanup evidence for automatic classification.";

  if (mergedEvidence && localDeleteFailure && !mergeFailureEvidence) {
    classification = "recoverable-post-merge-cleanup-fallout";
    disposition = "do-not-retry-merge";
    reason = "Merge success evidence is present; the remaining failure is local branch deletion cleanup, commonly caused by the branch being checked out in another worktree.";
  } else if (mergeFailureEvidence && !mergedEvidence) {
    classification = "possible-merge-failure";
    disposition = "inspect-merge-before-cleanup";
    reason = "Merge failure wording appears without merge-success evidence.";
  } else if (mergedEvidence && !localDeleteFailure) {
    classification = "merged-no-local-cleanup-fallout-detected";
    disposition = "no-cleanup-fallout";
    reason = "Merge success evidence is present and no local branch deletion failure was detected.";
  }

  return {
    schemaVersion: 1,
    command: "classify-pr-merge-cleanup",
    claimBoundary: "Read-only transcript classifier; it does not call gh/git or delete branches/worktrees.",
    classification,
    disposition,
    reason,
    evidence: {
      merged: mergedEvidence,
      localBranchDeleteFailed: localDeleteFailure,
      remoteBranchDeleted: remoteDeleteEvidence,
      mergeFailure: mergeFailureEvidence,
      checkedOutInWorktree: Boolean(worktreeCheckout),
      branch,
      worktreePath,
    },
    operatorGuidance: classification === "recoverable-post-merge-cleanup-fallout"
      ? [
        "Treat the PR merge as already complete; do not retry the merge solely because local branch deletion failed.",
        "Finish cleanup from the worktree that has the branch checked out, or switch that worktree to another branch before deleting the local branch.",
        "If needed, verify the PR/merge state read-only with gh pr view or git log before cleanup.",
      ]
      : ["Inspect the transcript and verify PR state before taking merge or cleanup action."],
  };
}

function escapeMarkdown(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function renderMarkdown(result) {
  const lines = [
    "# PR merge cleanup classifier",
    "",
    `Classification: \`${result.classification}\``,
    `Disposition: \`${result.disposition}\``,
    "",
    result.reason,
    "",
    "## Evidence",
    "",
    "| Signal | Value |",
    "| --- | --- |",
  ];

  for (const [key, value] of Object.entries(result.evidence)) {
    lines.push(`| ${key} | ${escapeMarkdown(value || false)} |`);
  }

  lines.push("", "## Operator guidance", "");
  for (const item of result.operatorGuidance) lines.push(`- ${item}`);
  return `${lines.join("\n")}\n`;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const result = classifyTranscript(readTranscript(options.input));
  const output = options.format === "json" ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result);
  if (options.output) fs.writeFileSync(path.resolve(repoRoot, options.output), output);
  else process.stdout.write(output);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
