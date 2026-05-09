#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const options = { input: "", output: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output") options.output = argv[++index] ?? "";
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (!options.input) options.input = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.input) throw new Error("Expected a branch-audit JSON path");
  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/render-branch-audit-closeout-review.mjs <audit-json> [--output <path>]\n\nRenders a read-only operator checklist from branch:audit JSON.\nIt never fetches, deletes, merges, prunes, or modifies remote branches.`);
}

function readAuditJson(inputPath) {
  const parsed = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (!parsed || typeof parsed !== "object" || !parsed.summary || !Array.isArray(parsed.branches)) {
    throw new Error("Input must be branch:audit JSON with summary and branches fields");
  }
  return parsed;
}

function compareByReviewPriority(a, b) {
  const deletedDelta = (b.currentTreeImpact?.deletedFiles ?? 0) - (a.currentTreeImpact?.deletedFiles ?? 0);
  if (deletedDelta !== 0) return deletedDelta;
  const uniqueDelta = (b.uniquePatchCommits ?? 0) - (a.uniquePatchCommits ?? 0);
  if (uniqueDelta !== 0) return uniqueDelta;
  return String(a.branch).localeCompare(String(b.branch));
}

function markdownEscape(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function inlineCode(value) {
  return `\`${String(value ?? "").replaceAll("`", "\\`")}\``;
}

function currentTreeRisk(row) {
  const impact = row.currentTreeImpact ?? {};
  const deletes = impact.deletedFiles ?? 0;
  if (impact.destructiveStaleTree) return `destructive-stale-tree; ${deletes} current-file deletes`;
  if (deletes > 0) return `${deletes} current-file deletes`;
  return impact.shortstat || "no current-tree risk recorded";
}

function deletedPathEvidence(row) {
  const paths = row.currentTreeImpact?.deletedPathEvidence ?? [];
  if (!paths.length) return "Not recorded in the audit JSON.";
  return paths.map((filePath) => `  - ${inlineCode(filePath)}`).join("\n");
}

function archiveEvidence(row) {
  const evidence = row.archiveEvidence;
  if (!evidence) return "no archive evidence in JSON";
  const line = evidence.lineNumber ? `:${evidence.lineNumber}` : "";
  return `${evidence.sourcePath}${line} (${evidence.matchType})`;
}

function renderValidCandidateTable(rows, base) {
  if (!rows.length) return "No valid-candidate branches remain in this audit JSON.";
  const header = "| Branch | Review reason | Patch shape | Last commit | Read-only command |\n| --- | --- | --- | --- | --- |";
  const body = rows.map((row) => [
    inlineCode(row.branch),
    markdownEscape(currentTreeRisk(row)),
    markdownEscape(`${row.uniquePatchCommits} unique / ${row.patchEquivalentCommits} patch-equivalent; ${row.aheadOfBaseCommits} ahead / ${row.behindBaseCommits} behind`),
    markdownEscape(`${row.lastCommitDate} ${row.lastSha} — ${row.lastSubject}`),
    inlineCode(`git diff --stat ${base}...${row.ref}`),
  ].join(" | ")).map((line) => `| ${line} |`).join("\n");
  return `${header}\n${body}`;
}

function renderValidCandidateDetails(rows) {
  if (!rows.length) return "";
  return rows.map((row) => `### ${inlineCode(row.branch)}\n\n- Operator check: inspect the branch diff, assign an owner, and record keep/follow-up/no-op.\n- Boundary: this checklist does not authorize deletion, merge, prune, or stale-tree replay.\n- Deleted current-file evidence:\n${deletedPathEvidence(row)}`).join("\n\n");
}

function renderArchivedTable(rows) {
  if (!rows.length) return "No archived valid candidates are recorded in this audit JSON.";
  const header = "| Branch | Archive evidence | Residual patch shape | Current-tree risk |\n| --- | --- | --- | --- |";
  const body = rows.map((row) => [
    inlineCode(row.branch),
    markdownEscape(archiveEvidence(row)),
    markdownEscape(`${row.uniquePatchCommits} unique; ${row.aheadOfBaseCommits} ahead / ${row.behindBaseCommits} behind`),
    markdownEscape(currentTreeRisk(row)),
  ].join(" | ")).map((line) => `| ${line} |`).join("\n");
  return `${header}\n${body}`;
}

export function renderCloseoutReview(audit, sourceLabel = "branch-audit JSON") {
  const summary = audit.summary;
  const counts = summary.counts ?? {};
  const validCandidates = audit.branches
    .filter((row) => row.classification === "valid-candidate")
    .sort(compareByReviewPriority);
  const archived = audit.branches
    .filter((row) => row.classification === "archived")
    .sort(compareByReviewPriority);
  const redundantTotal = (counts["redundant-merged"] ?? 0) + (counts["redundant-patch-equivalent"] ?? 0);

  return `# Branch audit closeout review checklist\n\nSource evidence: ${inlineCode(sourceLabel)}\n\nGenerated by audit: ${summary.generatedAt}\n\nBase: ${inlineCode(summary.base)}\nRemote: ${inlineCode(summary.remote)}\nGitHub open PR check: ${summary.githubPullRequestsChecked ? `yes (${summary.openPullRequests} open PRs in ${summary.githubRepository})` : "unavailable"}\n\n## Review boundary\n\nThis is a read-only operator review aid. It preserves and reshapes existing branch-audit evidence; it does not fetch remotes, delete branches, merge branch tips, prune refs, replay stale-tree deletes, or approve cleanup. Any deletion, merge, or remote-prune action requires a separate explicit operator decision outside this artifact.\n\n## Counts to confirm before closeout\n\n- Total remote branches audited: ${summary.totalBranches}\n- Remaining valid-candidate branches requiring owner review: ${counts["valid-candidate"] ?? 0}\n- Archived valid candidates with evidence: ${counts.archived ?? 0}\n- Redundant branches: ${redundantTotal}\n  - Fully merged by commit: ${counts["redundant-merged"] ?? 0}\n  - Patch-equivalent to base: ${counts["redundant-patch-equivalent"] ?? 0}\n- Open PR branches: ${counts["open-pr"] ?? 0}\n\n## Remaining valid-candidate review queue\n\n${renderValidCandidateTable(validCandidates, summary.base)}\n\n## Deleted current-file evidence to inspect first\n\n${renderValidCandidateDetails(validCandidates)}\n\n## Archived candidate spot-check queue\n\nArchived rows are suppressed from the valid-candidate queue only because an exact archive doc match was present in the audit JSON. Spot-check the archive evidence when closing the backlog; this still does not authorize remote deletion.\n\n${renderArchivedTable(archived)}\n\n## Operator closeout worksheet\n\nFor each remaining valid candidate, record:\n\n- Owner:\n- Outcome: keep / follow-up issue / no-op evidence accepted\n- Evidence reviewed: diff stat / deleted paths / last commit / archive doc if any\n- Non-action confirmation: no delete, merge, prune, or stale-tree replay was performed from this checklist alone\n`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const audit = readAuditJson(options.input);
  const rendered = renderCloseoutReview(audit, options.input);
  if (options.output) {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, rendered);
  } else {
    process.stdout.write(rendered);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
