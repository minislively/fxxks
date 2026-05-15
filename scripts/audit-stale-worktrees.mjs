#!/usr/bin/env node
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

function parseArgs(argv) {
  const options = { cwd: repoRoot, format: "markdown" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--cwd") options.cwd = path.resolve(argv[++index] ?? "");
    else if (arg === "--json") options.format = "json";
    else if (arg === "--markdown") options.format = "markdown";
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!options.cwd) throw new Error("--cwd must be non-empty");
  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/audit-stale-worktrees.mjs [options]\n\nRead-only stale worktree audit for fooks local worktree cleanup review.\nIt inspects local git worktrees, local remote-tracking refs, GitHub PR/issue\nevidence when gh is available, and tmux pane paths when tmux is available.\n\nOptions:\n  --cwd <path>      Project/worktree to audit (default: repository root)\n  --json            Emit machine-readable JSON\n  --markdown        Emit markdown (default)\n  -h, --help        Show this help\n\nBoundary:\n  This audit does not fetch, prune, remove worktrees, delete branches, push,\n  kill tmux sessions, write report files, or mutate runtime state. Any cleanup\n  command shown is a manual operator worksheet item only.`);
}

function inlineCode(value) {
  return `\`${String(value ?? "").replaceAll("`", "\\`")}\``;
}

function markdownEscape(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function categoryLabel(category) {
  if (category === "safe-cleanup") return "Safe cleanup candidates";
  if (category === "salvage-review") return "Salvage review required";
  if (category === "manual-review-noise") return "Manual review noise";
  return "Keep / active or unknown";
}

function renderOpenIssue(openIssue) {
  if (openIssue?.state === "open") return openIssue.issues.map((issue) => issue.number ? `#${issue.number}` : issue.url ?? "open").join(", ");
  if (openIssue?.state === "none" && openIssue.checkedIssueNumbers?.length) return `none (${openIssue.checkedIssueNumbers.map((issueNumber) => `#${issueNumber}`).join(", ")})`;
  return openIssue?.state ?? "unknown";
}

function renderEntryTable(entries) {
  if (!entries.length) return "No worktrees in this category.";
  const header = "| Path | Branch | Dirty | Ahead | Remote | Open PR | Open issue | Tmux panes | Decision |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |";
  const rows = entries.map((entry) => {
    const openPr = entry.openPullRequest?.state === "open"
      ? entry.openPullRequest.pullRequests.map((pullRequest) => pullRequest.number ? `#${pullRequest.number}` : pullRequest.url ?? "open").join(", ")
      : entry.openPullRequest?.state ?? "unknown";
    const candidateLabel = entry.staleReviewCandidate ? "stale-review-candidate" : entry.reasons[0] ?? "review evidence";
    return [
      inlineCode(entry.path),
      inlineCode(entry.branch ?? "<detached>"),
      markdownEscape(entry.dirty),
      markdownEscape(entry.aheadOfBase ?? "unknown"),
      markdownEscape(entry.remoteBranchExists),
      markdownEscape(openPr),
      markdownEscape(renderOpenIssue(entry.openIssue)),
      markdownEscape(entry.activeTmuxPaneCount),
      markdownEscape(candidateLabel),
    ].join(" | ");
  }).map((row) => `| ${row} |`);
  return `${header}\n${rows.join("\n")}`;
}

export function renderStaleWorktreeAuditMarkdown(result) {
  const counts = Object.fromEntries(Object.entries(result.triage.categories).map(([category, entries]) => [category, entries.length]));
  const lines = [
    "# Stale worktree audit",
    "",
    `Command: ${inlineCode("worktree:audit")}`,
    `Linked issue: ${inlineCode("#854")}`,
    `Generated: ${inlineCode(result.triage.generatedAt)}`,
    `Audited cwd: ${inlineCode(result.triage.cwd)}`,
    `Sibling root: ${inlineCode(result.triage.siblingRoot ?? "unknown")}`,
    `Base ref: ${inlineCode(result.triage.baseRef ?? "unknown")}`,
    `Stale review rule: ${inlineCode(result.staleReviewCandidateRule)}`,
    "",
    "## Read-only boundary",
    "",
    result.claimBoundary,
    "",
    "## Counts",
    "",
    `- Stale review candidates: ${result.staleReviewCandidates.length}`,
    `- Safe cleanup candidates: ${counts["safe-cleanup"] ?? 0}`,
    `- Salvage review required: ${counts["salvage-review"] ?? 0}`,
    `- Manual review noise: ${counts["manual-review-noise"] ?? 0}`,
    `- Keep / active or unknown: ${counts.keep ?? 0}`,
    "",
    "## Stale review candidates",
    "",
    renderEntryTable(result.entries.filter((entry) => entry.staleReviewCandidate)),
    "",
  ];

  for (const category of ["salvage-review", "safe-cleanup", "manual-review-noise", "keep"]) {
    lines.push(`## ${categoryLabel(category)}`, "", renderEntryTable(result.entries.filter((entry) => entry.category === category)), "");
  }

  lines.push("## Blockers", "");
  if (result.blockers.length) {
    for (const blocker of result.blockers) lines.push(`- ${blocker}`);
  } else {
    lines.push("No blockers recorded.");
  }

  return `${lines.join("\n")}\n`;
}

export function buildStaleWorktreeAudit(cwd, triageOrOptions = undefined) {
  const { buildStaleWorktreeAudit: buildAudit } = require(path.join(repoRoot, "dist", "ops", "stale-worktree-audit.js"));
  if (typeof triageOrOptions === "function") return buildAudit(cwd, { triage: triageOrOptions });
  return buildAudit(cwd, triageOrOptions ?? {});
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const audit = buildStaleWorktreeAudit(options.cwd);
  const output = options.format === "json" ? `${JSON.stringify(audit, null, 2)}\n` : renderStaleWorktreeAuditMarkdown(audit);
  process.stdout.write(output);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
