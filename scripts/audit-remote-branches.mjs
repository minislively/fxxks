#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const NEXT_ACTION_SHORTLIST_LIMIT = 10;
const DEFAULT_ARCHIVE_DOCS_DIR = "docs";

function isDocsBranch(row) {
  return /(^|[\/-])docs?([\/-]|$)|documentation|readme/i.test(`${row.branch} ${row.lastSubject}`);
}

function isTestBranch(row) {
  return /(^|[\/-])tests?([\/-]|$)|coverage|fixture|smoke/i.test(`${row.branch} ${row.lastSubject}`);
}

function candidateReviewFocus(row) {
  if (row.currentTreeImpact.destructiveStaleTree) {
    return "inspect deleted current-file paths before any cleanup decision";
  }
  if (isTestBranch(row)) {
    return "check whether test or fixture coverage still needs a tracked follow-up";
  }
  if (isDocsBranch(row)) {
    return "check whether documentation evidence still needs a tracked follow-up";
  }
  return "inspect the diff and record owner plus keep/follow-up/no-op outcome";
}

function buildDiscordNextActionShortlist(branches, summary) {
  return branches
    .filter((row) => row.classification === "valid-candidate")
    .slice(0, NEXT_ACTION_SHORTLIST_LIMIT)
    .map((row) => ({
      branch: row.branch,
      ref: row.ref,
      action: "Read-only triage: inspect the branch diff and record an owner plus outcome; this artifact does not recommend deleting branches or merging code.",
      reviewFocus: candidateReviewFocus(row),
      evidence: `${row.uniquePatchCommits} unique patch commit${row.uniquePatchCommits === 1 ? "" : "s"}; ${formatCurrentTreeRisk(row.currentTreeImpact)}; last commit ${row.lastCommitDate} (${row.lastSha})`,
      diffCommand: `git diff --stat ${summary.base}...${row.ref}`,
    }));
}

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  return output === null ? "" : output.trimEnd();
}

function tryRun(command, args, fallback = "") {
  try {
    return run(command, args);
  } catch {
    return fallback;
  }
}

function parseArgs(argv) {
  const options = {
    base: "origin/main",
    remote: "origin",
    fetch: true,
    format: "markdown",
    output: "",
    archiveDocsDir: process.env.FOOKS_BRANCH_AUDIT_ARCHIVE_DOCS_DIR || DEFAULT_ARCHIVE_DOCS_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base") options.base = argv[++index];
    else if (arg === "--remote") options.remote = argv[++index];
    else if (arg === "--output") options.output = argv[++index];
    else if (arg === "--archive-docs-dir") options.archiveDocsDir = argv[++index];
    else if (arg === "--json") options.format = "json";
    else if (arg === "--markdown") options.format = "markdown";
    else if (arg === "--no-fetch") options.fetch = false;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.base || !options.remote || !options.archiveDocsDir) {
    throw new Error("--base, --remote, and --archive-docs-dir must be non-empty");
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/audit-remote-branches.mjs [options]\n\nAudits remote branches against a base ref and classifies branches that can add\nstale-branch noise after main has absorbed equivalent work.\n\nOptions:\n  --base <ref>      Base ref to compare against (default: origin/main)\n  --remote <name>   Remote namespace to audit (default: origin)\n  --no-fetch        Use local remote-tracking refs without fetching first\n  --json            Emit machine-readable JSON instead of markdown\n  --markdown        Emit markdown (default)\n  --output <path>   Write output to a file instead of stdout\n  --archive-docs-dir <path>\n                   Directory containing branch archive docs (default: docs)\n  -h, --help        Show this help\n\nClassification:\n  redundant-merged            branch has no commits ahead of base\n  redundant-patch-equivalent  branch commits are patch-equivalent to base\n  valid-candidate             branch has unique patch commits and no open PR\n  open-pr                     branch has an open PR and is not stale-branch noise
  archived                    otherwise-valid branch has an exact archive doc match

Next-action shortlist:
  Markdown and JSON include a read-only Discord-friendly valid-candidate
  shortlist for operator triage. Archived branches are suppressed from that
  shortlist and reported with archive evidence. This audit does not recommend
  deleting branches or merging code.`);
}


function normalizeArchivedBranchRef(ref, remote) {
  const trimmed = ref.trim();
  if (!trimmed) return "";
  const refsRemotePrefix = `refs/remotes/${remote}/`;
  const remotePrefix = `${remote}/`;
  if (trimmed.startsWith(refsRemotePrefix)) return trimmed.slice(refsRemotePrefix.length);
  if (trimmed.startsWith(remotePrefix)) return trimmed.slice(remotePrefix.length);
  if (trimmed.startsWith("refs/remotes/")) return "";
  return trimmed;
}

function archiveEvidenceForRef(ref, evidence, remote) {
  const branch = normalizeArchivedBranchRef(ref, remote);
  if (!branch) return null;
  return { branch, evidence };
}

function findArchiveDocs(archiveDocsDir) {
  const docsRoot = path.resolve(repoRoot, archiveDocsDir);
  if (!fs.existsSync(docsRoot)) return [];
  return fs.readdirSync(docsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /branch-archive.*\.md$|branch.*archive.*\.md$/i.test(name))
    .sort()
    .map((name) => path.join(docsRoot, name));
}

function addArchiveEvidence(index, branch, evidence) {
  if (!branch || index.has(branch)) return;
  index.set(branch, evidence);
}

function buildArchiveIndex(options) {
  const index = new Map();
  for (const archiveDoc of findArchiveDocs(options.archiveDocsDir)) {
    const relativePath = path.relative(repoRoot, archiveDoc);
    const content = fs.readFileSync(archiveDoc, "utf8");
    const lines = content.split(/\r?\n/);

    for (const [lineIndex, line] of lines.entries()) {
      const inspectedMatch = line.match(/^\s*Branch inspected:\s*`([^`]+)`/i);
      if (!inspectedMatch) continue;
      const parsed = archiveEvidenceForRef(inspectedMatch[1], {
        sourcePath: relativePath,
        matchType: "branch-inspected",
        matchedRef: inspectedMatch[1],
        lineNumber: lineIndex + 1,
      }, options.remote);
      if (parsed) addArchiveEvidence(index, parsed.branch, parsed.evidence);
    }

    const titleIndex = lines.findIndex((line) => /^#\s+/.test(line));
    const title = titleIndex >= 0 ? lines[titleIndex] : "";
    if (!/archive/i.test(title)) continue;
    const titleRefs = [...title.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
    for (const titleRef of titleRefs) {
      const parsed = archiveEvidenceForRef(titleRef, {
        sourcePath: relativePath,
        matchType: "title",
        matchedRef: titleRef,
        lineNumber: titleIndex + 1,
      }, options.remote);
      if (parsed) addArchiveEvidence(index, parsed.branch, parsed.evidence);
    }
  }
  return index;
}

function getOpenPullRequestHeads(remote) {
  const repoUrl = tryRun("git", ["remote", "get-url", remote]);
  const repoMatch = repoUrl.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/.]+)(?:\.git)?$/);
  const repo = repoMatch?.groups ? `${repoMatch.groups.owner}/${repoMatch.groups.repo}` : "";
  if (!repo) return { available: false, heads: new Set(), repo: "" };

  const stdout = tryRun("gh", [
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--json",
    "headRefName,headRepositoryOwner,number,title,url",
  ]);
  if (!stdout) return { available: false, heads: new Set(), repo };

  try {
    const prs = JSON.parse(stdout);
    return {
      available: true,
      repo,
      heads: new Set(prs
        .filter((pr) => pr.headRepositoryOwner?.login === repoMatch.groups.owner)
        .map((pr) => pr.headRefName)),
      prs,
    };
  } catch {
    return { available: false, heads: new Set(), repo };
  }
}

function listRemoteBranches(remote, base) {
  return run("git", ["branch", "-r", "--format=%(refname:short)"])
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((branch) => branch.startsWith(`${remote}/`))
    .filter((branch) => branch !== `${remote}/HEAD`)
    .filter((branch) => branch !== base)
    .sort((left, right) => left.localeCompare(right));
}

function parseCurrentTreeImpact(nameStatusOutput, shortstat) {
  const impact = {
    addedFiles: 0,
    modifiedFiles: 0,
    deletedFiles: 0,
    renamedFiles: 0,
    shortstat: shortstat.trim() || "0 files changed",
    destructiveStaleTree: false,
    deletedPathEvidence: [],
  };

  const deletedPaths = [];
  for (const line of nameStatusOutput.split(/\r?\n/).filter(Boolean)) {
    const [status, ...paths] = line.split(/\t/);
    const code = status[0];
    if (code === "A") impact.addedFiles += 1;
    else if (code === "D") {
      impact.deletedFiles += 1;
      deletedPaths.push(paths.at(-1) ?? "");
    } else if (code === "R") impact.renamedFiles += 1;
    else impact.modifiedFiles += 1;
  }

  const highSignalDeletedPaths = deletedPaths.filter((filePath) =>
    /(^|\/)(scripts\/audit-remote-branches\.mjs|docs\/remote-branch-audit\.md|test\/|tests\/|src\/core\/domain-|docs\/frontend-domain|fixtures\/)/.test(filePath),
  );
  const evidenceSource = highSignalDeletedPaths.length > 0 ? highSignalDeletedPaths : deletedPaths;

  impact.destructiveStaleTree = impact.deletedFiles > 0;
  impact.deletedPathEvidence = evidenceSource.filter(Boolean).slice(0, 5);
  return impact;
}

function formatCurrentTreeImpact(impact) {
  const counts = `A:${impact.addedFiles} M:${impact.modifiedFiles} D:${impact.deletedFiles}`;
  const renameSuffix = impact.renamedFiles > 0 ? ` R:${impact.renamedFiles}` : "";
  return `${counts}${renameSuffix}; ${impact.shortstat}`;
}

function formatCurrentTreeRisk(impact) {
  if (!impact.destructiveStaleTree) return "no current-file deletes";
  const evidence = impact.deletedPathEvidence.length > 0
    ? `; deletes ${impact.deletedPathEvidence.map((filePath) => `\`${filePath}\``).join(", ")}`
    : "";
  return `destructive-stale-tree (${impact.deletedFiles} current-file deletes${evidence})`;
}

function branchAudit(branch, options, openPrHeads, archiveIndex) {
  const branchName = branch.slice(`${options.remote}/`.length);
  const [baseOnly, branchOnly] = run("git", ["rev-list", "--left-right", "--count", `${options.base}...${branch}`])
    .split(/\s+/)
    .map((value) => Number.parseInt(value, 10));
  const cherryLines = tryRun("git", ["cherry", options.base, branch])
    .split(/\r?\n/)
    .filter(Boolean);
  const uniquePatchCommits = cherryLines.filter((line) => line.startsWith("+")).length;
  const patchEquivalentCommits = cherryLines.filter((line) => line.startsWith("-")).length;
  const hasOpenPr = openPrHeads.has(branchName);
  const archiveEvidence = archiveIndex.get(branchName) ?? null;
  const lastCommitDate = run("git", ["log", "-1", "--format=%cs", branch]);
  const lastSubject = run("git", ["log", "-1", "--format=%s", branch]);
  const lastSha = run("git", ["rev-parse", "--short=12", branch]);
  const currentTreeImpact = parseCurrentTreeImpact(
    tryRun("git", ["diff", "--name-status", options.base, branch]),
    tryRun("git", ["diff", "--shortstat", options.base, branch]),
  );

  let classification = "valid-candidate";
  if (hasOpenPr) classification = "open-pr";
  else if (branchOnly === 0) classification = "redundant-merged";
  else if (uniquePatchCommits === 0) classification = "redundant-patch-equivalent";
  else if (archiveEvidence) classification = "archived";

  return {
    branch: branchName,
    ref: branch,
    classification,
    behindBaseCommits: baseOnly,
    aheadOfBaseCommits: branchOnly,
    uniquePatchCommits,
    patchEquivalentCommits,
    lastCommitDate,
    lastSha,
    lastSubject,
    currentTreeImpact,
    ...(classification === "archived" ? { archiveEvidence } : {}),
  };
}

function summarize(rows, prInfo, options) {
  const counts = rows.reduce((acc, row) => {
    acc[row.classification] = (acc[row.classification] ?? 0) + 1;
    return acc;
  }, {});
  return {
    generatedAt: new Date().toISOString(),
    base: options.base,
    remote: options.remote,
    githubPullRequestsChecked: prInfo.available,
    githubRepository: prInfo.repo,
    openPullRequests: prInfo.prs?.length ?? null,
    totalBranches: rows.length,
    counts,
  };
}

function markdownTable(rows, classification) {
  const filtered = rows.filter((row) => row.classification === classification);
  if (filtered.length === 0) return `No ${classification} branches.\n`;

  const lines = [
    "| Branch | Ahead | Behind | Unique patches | Patch-equivalent | Current-tree impact | Current-tree risk | Archive evidence | Last commit | Tip | Subject |",
    "| --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of filtered) {
    const archiveEvidence = row.archiveEvidence
      ? `${row.archiveEvidence.sourcePath}:${row.archiveEvidence.lineNumber} (${row.archiveEvidence.matchType} \`${row.archiveEvidence.matchedRef}\`)`
      : "";
    lines.push(`| \`${row.branch}\` | ${row.aheadOfBaseCommits} | ${row.behindBaseCommits} | ${row.uniquePatchCommits} | ${row.patchEquivalentCommits} | ${escapeMarkdown(formatCurrentTreeImpact(row.currentTreeImpact))} | ${escapeMarkdown(formatCurrentTreeRisk(row.currentTreeImpact))} | ${escapeMarkdown(archiveEvidence)} | ${row.lastCommitDate} | \`${row.lastSha}\` | ${escapeMarkdown(row.lastSubject)} |`);
  }
  return `${lines.join("\n")}\n`;
}

function escapeMarkdown(value) {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function renderDiscordNextActionShortlist(shortlist) {
  if (shortlist.length === 0) {
    return "No valid-candidate next actions.\n";
  }

  const lines = [
    "Read-only operator shortlist for Discord handoff. It does not recommend deleting branches or merging code.",
    "",
  ];
  for (const item of shortlist) {
    lines.push(`- \`${item.branch}\` — ${escapeMarkdown(item.reviewFocus)}. Evidence: ${escapeMarkdown(item.evidence)}. Verify with \`${item.diffCommand}\`.`);
  }
  return `${lines.join("\n")}\n`;
}

function renderSafeCloseoutProcedure(summary) {
  const redundantTotal = (summary.counts["redundant-merged"] ?? 0) + (summary.counts["redundant-patch-equivalent"] ?? 0);
  return `## Safe closeout procedure\n\nThis branch audit is evidence, not authority. It supports operator review of redundant remote branch noise, but it does not approve remote deletion, merging branch tips, or replaying stale-tree deletes.\n\n- Preserve this generated report or the JSON artifact before any closeout decision.\n- Confirm the fresh audit still reports ${summary.counts["valid-candidate"] ?? 0} valid-candidate branches and ${summary.counts["open-pr"] ?? 0} open PR branches before treating the ${redundantTotal} redundant branches as noise.\n- Record an owner plus keep/follow-up/no-op outcome for any branch that is not redundant or archived.\n- Do not delete, merge, or replay changes from this artifact alone; remote pruning requires explicit operator approval outside this report.\n`;
}

function renderMarkdown(result) {
  const { summary, branches } = result;
  const redundantTotal = (summary.counts["redundant-merged"] ?? 0) + (summary.counts["redundant-patch-equivalent"] ?? 0);
  return `# Remote branch stale-work audit\n\nGenerated: ${summary.generatedAt}\n\nBase: \`${summary.base}\`\n\nRemote: \`${summary.remote}\`\nGitHub open PR check: ${summary.githubPullRequestsChecked ? `yes (${summary.openPullRequests} open PRs in ${summary.githubRepository})` : "unavailable"}\n\nRegenerate this report with \`npm run --silent branch:audit -- --output docs/remote-branch-audit.md\`. Use \`--json\` for automation.\n\n## Summary\n\n- Total remote branches audited: ${summary.totalBranches}\n- Redundant branches: ${redundantTotal}\n  - Fully merged by commit: ${summary.counts["redundant-merged"] ?? 0}\n  - Patch-equivalent to base: ${summary.counts["redundant-patch-equivalent"] ?? 0}\n- Valid candidates needing human review: ${summary.counts["valid-candidate"] ?? 0}\n- Archived valid candidates suppressed: ${summary.counts["archived"] ?? 0}\n- Branches with open PRs: ${summary.counts["open-pr"] ?? 0}\n\n${renderSafeCloseoutProcedure(summary)}\n## Discord-friendly valid-candidate next-action shortlist\n\n${renderDiscordNextActionShortlist(result.discordNextActionShortlist)}\n## Valid candidates without open PRs\n\nThese branches still have unique patch commits relative to \`${summary.base}\`. This audit is read-only and does not recommend deleting branches or merging code.\n\n${markdownTable(branches, "valid-candidate")}\n## Archived valid candidates\n\nThese branches still have unique patch commits, but current repository archive docs record a bounded stale-branch decision for the exact branch name. This read-only suppression is not a recommendation to delete remote branches, merge stale trees, or replay stale-tree deletes.\n\n${markdownTable(branches, "archived")}\n## Redundant: fully merged by commit\n\n${markdownTable(branches, "redundant-merged")}\n## Redundant: patch-equivalent to base\n\nThese branches still have commits ahead of the base ref, but \`git cherry\` reports their patches as already present in \`${summary.base}\`.\n\n${markdownTable(branches, "redundant-patch-equivalent")}\n## Open PR branches\n\n${markdownTable(branches, "open-pr")}`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.fetch) {
    run("git", ["fetch", "--prune", options.remote], { stdio: ["ignore", "ignore", "pipe"] });
  }

  run("git", ["rev-parse", "--verify", options.base]);
  const prInfo = getOpenPullRequestHeads(options.remote);
  const archiveIndex = buildArchiveIndex(options);
  const branches = listRemoteBranches(options.remote, options.base)
    .map((branch) => branchAudit(branch, options, prInfo.heads, archiveIndex))
    .sort((left, right) => {
      const classOrder = {
        "valid-candidate": 0,
        "archived": 1,
        "open-pr": 2,
        "redundant-merged": 3,
        "redundant-patch-equivalent": 4,
      };
      return classOrder[left.classification] - classOrder[right.classification]
        || right.lastCommitDate.localeCompare(left.lastCommitDate)
        || left.branch.localeCompare(right.branch);
    });
  const summary = summarize(branches, prInfo, options);
  const result = {
    summary,
    branches,
    discordNextActionShortlist: buildDiscordNextActionShortlist(branches, summary),
  };
  const output = options.format === "json" ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result);

  if (options.output) {
    fs.writeFileSync(path.resolve(repoRoot, options.output), output);
  } else {
    process.stdout.write(output);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
