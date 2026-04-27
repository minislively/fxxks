#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_LIMIT = 100;
const STALE_CONCLUSIONS = new Set(["cancelled", "skipped"]);
const ACTIONABLE_CONCLUSIONS = new Set(["failure", "timed_out", "action_required", "startup_failure"]);
const ACTIVE_STATUSES = new Set(["queued", "in_progress", "waiting", "pending", "requested"]);

function parseArgs(argv) {
  const options = {
    input: "",
    output: "",
    limit: DEFAULT_LIMIT,
    branch: "",
    workflow: "",
    format: "markdown",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") options.input = argv[++index];
    else if (arg === "--output") options.output = argv[++index];
    else if (arg === "--limit") options.limit = Number.parseInt(argv[++index], 10);
    else if (arg === "--branch") options.branch = argv[++index];
    else if (arg === "--workflow") options.workflow = argv[++index];
    else if (arg === "--json") options.format = "json";
    else if (arg === "--markdown") options.format = "markdown";
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(options.limit) || options.limit <= 0) {
    throw new Error("--limit must be a positive integer");
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/triage-ci-alerts.mjs [options]\n\nClassifies recent GitHub Actions CI runs so replayed alert buffers can be skimmed\nfor only the latest actionable failures. Cancelled/skipped runs and older runs\nsuperseded by newer runs on the same workflow+branch are marked stale.\n\nOptions:\n  --input <path>     Read gh run list JSON from a file instead of invoking gh\n  --limit <n>        Number of runs to fetch when using gh (default: ${DEFAULT_LIMIT})\n  --branch <name>    Restrict to a branch/head branch\n  --workflow <name>  Restrict to a workflow display name\n  --json             Emit machine-readable JSON instead of markdown\n  --markdown         Emit markdown (default)\n  --output <path>    Write output to a file instead of stdout\n  -h, --help         Show this help\n\nLive usage:\n  npm run --silent ci:alerts -- --branch main\n\nOffline/replay usage:\n  gh run list --limit 100 --json databaseId,status,conclusion,createdAt,updatedAt,headBranch,event,name,workflowName,url > /tmp/runs.json\n  npm run --silent ci:alerts -- --input /tmp/runs.json --json`);
}

function readRuns(options) {
  if (options.input) {
    return JSON.parse(fs.readFileSync(path.resolve(repoRoot, options.input), "utf8"));
  }

  const args = [
    "run",
    "list",
    "--limit",
    String(options.limit),
    "--json",
    "databaseId,status,conclusion,createdAt,updatedAt,headBranch,event,name,workflowName,url",
  ];
  if (options.branch) args.push("--branch", options.branch);
  if (options.workflow) args.push("--workflow", options.workflow);

  const stdout = execFileSync("gh", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(stdout);
}

function normalizeRun(run) {
  return {
    id: run.databaseId ?? run.id ?? null,
    workflow: run.workflowName || run.name || "unknown-workflow",
    name: run.name || run.workflowName || "unknown-run",
    branch: run.headBranch || "unknown-branch",
    event: run.event || "unknown-event",
    status: run.status || "unknown-status",
    conclusion: run.conclusion || "",
    createdAt: run.createdAt || "",
    updatedAt: run.updatedAt || run.createdAt || "",
    url: run.url || "",
  };
}

function runKey(run) {
  return `${run.workflow}\u0000${run.branch}\u0000${run.event}`;
}

function runTime(run) {
  const timestamp = Date.parse(run.updatedAt || run.createdAt || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function classifyRuns(rawRuns) {
  const runs = rawRuns.map(normalizeRun).sort((left, right) => runTime(right) - runTime(left));
  const latestByKey = new Map();

  for (const run of runs) {
    const key = runKey(run);
    if (!latestByKey.has(key)) latestByKey.set(key, run);
  }

  const rows = runs.map((run) => {
    const latest = latestByKey.get(runKey(run));
    const isLatest = latest === run;
    let bucket = "informational";
    let reason = "not failing";

    if (STALE_CONCLUSIONS.has(run.conclusion)) {
      bucket = "stale";
      reason = `completed ${run.conclusion}`;
    } else if (!isLatest) {
      bucket = "stale";
      reason = `superseded by run ${latest.id ?? "unknown"}`;
    } else if (ACTIVE_STATUSES.has(run.status)) {
      bucket = "watch";
      reason = `latest run is ${run.status}`;
    } else if (ACTIONABLE_CONCLUSIONS.has(run.conclusion)) {
      bucket = "actionable";
      reason = `latest ${run.conclusion}`;
    }

    return { ...run, bucket, reason, latestRunId: latest?.id ?? null };
  });

  const counts = rows.reduce((acc, row) => {
    acc[row.bucket] = (acc[row.bucket] ?? 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    counts,
    totalRuns: rows.length,
    rows,
  };
}

function escapeMarkdown(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function markdownTable(rows) {
  if (rows.length === 0) return "None.\n";
  const lines = [
    "| Bucket | Workflow | Branch | Status | Conclusion | Updated | Reason | Run |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of rows) {
    const run = row.url ? `[${row.id ?? "run"}](${row.url})` : `\`${row.id ?? "unknown"}\``;
    lines.push(`| ${row.bucket} | ${escapeMarkdown(row.workflow)} | \`${escapeMarkdown(row.branch)}\` | ${escapeMarkdown(row.status)} | ${escapeMarkdown(row.conclusion || "-")} | ${escapeMarkdown(row.updatedAt || row.createdAt)} | ${escapeMarkdown(row.reason)} | ${run} |`);
  }
  return `${lines.join("\n")}\n`;
}

function renderMarkdown(result) {
  const actionable = result.rows.filter((row) => row.bucket === "actionable" || row.bucket === "watch");
  const stale = result.rows.filter((row) => row.bucket === "stale");
  return `# CI alert replay triage\n\nGenerated: ${result.generatedAt}\n\nUse this report to collapse replayed GitHub Actions alert buffers: inspect only \`actionable\` and \`watch\` rows, and treat \`stale\` rows as already superseded/cancelled unless a new run appears.\n\n## Summary\n\n- Total runs inspected: ${result.totalRuns}\n- Actionable latest failures: ${result.counts.actionable ?? 0}\n- Latest runs still in flight: ${result.counts.watch ?? 0}\n- Stale replay rows: ${result.counts.stale ?? 0}\n- Informational successes/neutral rows: ${result.counts.informational ?? 0}\n\n## Actionable / watch\n\n${markdownTable(actionable)}\n## Stale replay rows\n\n${markdownTable(stale)}`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const rawRuns = readRuns(options);
  if (!Array.isArray(rawRuns)) throw new Error("Expected an array of GitHub Actions runs");
  const result = classifyRuns(rawRuns);
  const output = options.format === "json" ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result);

  if (options.output) fs.writeFileSync(path.resolve(repoRoot, options.output), output);
  else process.stdout.write(output);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
