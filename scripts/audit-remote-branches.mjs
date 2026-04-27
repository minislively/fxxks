#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base") options.base = argv[++index];
    else if (arg === "--remote") options.remote = argv[++index];
    else if (arg === "--output") options.output = argv[++index];
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

  if (!options.base || !options.remote) {
    throw new Error("--base and --remote must be non-empty");
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/audit-remote-branches.mjs [options]\n\nAudits remote branches against a base ref and classifies branches that can add\nstale-branch noise after main has absorbed equivalent work.\n\nOptions:\n  --base <ref>      Base ref to compare against (default: origin/main)\n  --remote <name>   Remote namespace to audit (default: origin)\n  --no-fetch        Use local remote-tracking refs without fetching first\n  --json            Emit machine-readable JSON instead of markdown\n  --markdown        Emit markdown (default)\n  --output <path>   Write output to a file instead of stdout\n  -h, --help        Show this help\n\nClassification:\n  redundant-merged            branch has no commits ahead of base\n  redundant-patch-equivalent  branch commits are patch-equivalent to base\n  valid-candidate             branch has unique patch commits and no open PR\n  open-pr                     branch has an open PR and is not stale-branch noise`);
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

function branchAudit(branch, options, openPrHeads) {
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
    "| Branch | Ahead | Behind | Unique patches | Patch-equivalent | Current-tree impact | Current-tree risk | Last commit | Tip | Subject |",
    "| --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |",
  ];
  for (const row of filtered) {
    lines.push(`| \`${row.branch}\` | ${row.aheadOfBaseCommits} | ${row.behindBaseCommits} | ${row.uniquePatchCommits} | ${row.patchEquivalentCommits} | ${escapeMarkdown(formatCurrentTreeImpact(row.currentTreeImpact))} | ${escapeMarkdown(formatCurrentTreeRisk(row.currentTreeImpact))} | ${row.lastCommitDate} | \`${row.lastSha}\` | ${escapeMarkdown(row.lastSubject)} |`);
  }
  return `${lines.join("\n")}\n`;
}

function escapeMarkdown(value) {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function renderMarkdown(result) {
  const { summary, branches } = result;
  const redundantTotal = (summary.counts["redundant-merged"] ?? 0) + (summary.counts["redundant-patch-equivalent"] ?? 0);
  return `# Remote branch stale-work audit\n\nGenerated: ${summary.generatedAt}\n\nBase: \`${summary.base}\`\n\nRemote: \`${summary.remote}\`\nGitHub open PR check: ${summary.githubPullRequestsChecked ? `yes (${summary.openPullRequests} open PRs in ${summary.githubRepository})` : "unavailable"}\n\nRegenerate this report with \`npm run --silent branch:audit -- --output docs/remote-branch-audit.md\`. Use \`--json\` for automation.\n\n## Summary\n\n- Total remote branches audited: ${summary.totalBranches}\n- Redundant branches: ${redundantTotal}\n  - Fully merged by commit: ${summary.counts["redundant-merged"] ?? 0}\n  - Patch-equivalent to base: ${summary.counts["redundant-patch-equivalent"] ?? 0}\n- Valid candidates needing human review: ${summary.counts["valid-candidate"] ?? 0}\n- Branches with open PRs: ${summary.counts["open-pr"] ?? 0}\n\n## Valid candidates without open PRs\n\nThese branches still have unique patch commits relative to \`${summary.base}\`. Review before deleting or recreating PRs.\n\n${markdownTable(branches, "valid-candidate")}\n## Redundant: fully merged by commit\n\n${markdownTable(branches, "redundant-merged")}\n## Redundant: patch-equivalent to base\n\nThese branches still have commits ahead of the base ref, but \`git cherry\` reports their patches as already present in \`${summary.base}\`.\n\n${markdownTable(branches, "redundant-patch-equivalent")}\n## Open PR branches\n\n${markdownTable(branches, "open-pr")}`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.fetch) {
    run("git", ["fetch", "--prune", options.remote], { stdio: ["ignore", "ignore", "pipe"] });
  }

  run("git", ["rev-parse", "--verify", options.base]);
  const prInfo = getOpenPullRequestHeads(options.remote);
  const branches = listRemoteBranches(options.remote, options.base)
    .map((branch) => branchAudit(branch, options, prInfo.heads))
    .sort((left, right) => {
      const classOrder = {
        "valid-candidate": 0,
        "open-pr": 1,
        "redundant-merged": 2,
        "redundant-patch-equivalent": 3,
      };
      return classOrder[left.classification] - classOrder[right.classification]
        || right.lastCommitDate.localeCompare(left.lastCommitDate)
        || left.branch.localeCompare(right.branch);
    });
  const result = { summary: summarize(branches, prInfo, options), branches };
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
