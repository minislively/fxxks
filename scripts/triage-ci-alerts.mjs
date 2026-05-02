#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_LIMIT = 100;
const DEFAULT_ALERT_EVIDENCE_LIMIT = 12;
const STALE_ALERT_SAMPLE_LIMIT = 3;
const STALE_CONCLUSIONS = new Set(["cancelled", "skipped"]);
const ACTIONABLE_CONCLUSIONS = new Set(["failure", "timed_out", "action_required", "startup_failure"]);
const ACTIVE_STATUSES = new Set(["queued", "in_progress", "waiting", "pending", "requested"]);

function parseArgs(argv) {
  const options = {
    input: "",
    output: "",
    alertsInput: "",
    limit: DEFAULT_LIMIT,
    branch: "",
    workflow: "",
    format: "markdown",
    alertEvidenceLimit: DEFAULT_ALERT_EVIDENCE_LIMIT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") options.input = argv[++index];
    else if (arg === "--alerts-input" || arg === "--alerts") options.alertsInput = argv[++index];
    else if (arg === "--output") options.output = argv[++index];
    else if (arg === "--limit") options.limit = Number.parseInt(argv[++index], 10);
    else if (arg === "--branch") options.branch = argv[++index];
    else if (arg === "--workflow") options.workflow = argv[++index];
    else if (arg === "--alert-evidence-limit") options.alertEvidenceLimit = Number.parseInt(argv[++index], 10);
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
  if (!Number.isInteger(options.alertEvidenceLimit) || options.alertEvidenceLimit <= 0) {
    throw new Error("--alert-evidence-limit must be a positive integer");
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/triage-ci-alerts.mjs [options]\n\nClassifies recent GitHub Actions CI runs so replayed alert buffers can be skimmed\nfor only the latest actionable failures. Cancelled/skipped runs and older runs\nsuperseded by newer runs on the same workflow+branch are marked stale.\n\nOptions:\n  --input <path>     Read gh run list JSON from a file instead of invoking gh\n  --alerts <path>    Read pasted alert text / run URLs from a file, or - for stdin\n  --limit <n>        Number of runs to fetch when using gh (default: ${DEFAULT_LIMIT})\n  --branch <name>    Restrict to a branch/head branch\n  --workflow <name>  Restrict to a workflow display name\n  --json             Emit machine-readable JSON instead of markdown\n  --markdown         Emit markdown (default)\n  --output <path>    Write output to a file instead of stdout\n  -h, --help         Show this help\n\nLive usage:\n  npm run --silent ci:alerts -- --branch main\n\nOffline/replay usage:\n  gh run list --limit 100 --json attempt,databaseId,status,conclusion,createdAt,updatedAt,headBranch,event,name,workflowName,url > /tmp/runs.json\n  npm run --silent ci:alerts -- --input /tmp/runs.json --json

Pasted alert URL usage:
  pbpaste > /tmp/discord-alerts.txt
  npm run --silent ci:alerts -- --alerts /tmp/discord-alerts.txt --branch main

Bulk replay behavior:
  When pasted alerts exceed --alert-evidence-limit, ci:alerts keeps current main/
  selected-branch runs plus actionable/watch/missing evidence and a small cancelled
  stale sample, then summarizes omitted historical success/cancelled replay rows.`);
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
    "attempt,databaseId,status,conclusion,createdAt,updatedAt,headBranch,event,name,workflowName,url",
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

function readAlertText(alertsInput) {
  if (!alertsInput) return "";
  if (alertsInput === "-") return fs.readFileSync(0, "utf8");
  return fs.readFileSync(path.resolve(repoRoot, alertsInput), "utf8");
}

function normalizePositiveInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function extractAlertRunRefs(alertText) {
  const refsByKey = new Map();
  const urlPattern = /https:\/\/github\.com\/[^\s<>)\]]+\/actions\/runs\/(\d+)(?:\/(attempts|job|jobs)\/(\d+))?(?:[?#][^\s<>)\]]*)?/gi;

  for (const match of alertText.matchAll(urlPattern)) {
    const id = match[1];
    const alertedAttempt = match[2] === "attempts" ? normalizePositiveInteger(match[3]) : null;
    const key = alertedAttempt === null ? id : `${id}:attempt:${alertedAttempt}`;
    const existing = refsByKey.get(key);
    if (existing) {
      existing.appearances += 1;
    } else {
      refsByKey.set(key, {
        id,
        alertedAttempt,
        url: match[0].replace(/[.,;:!?]+$/, ""),
        appearances: 1,
      });
    }
  }

  return [...refsByKey.values()];
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
    attempt: normalizePositiveInteger(run.attempt),
    createdAt: run.createdAt || "",
    updatedAt: run.updatedAt || run.createdAt || "",
    url: run.url || "",
  };
}

function alertEvidenceState(row) {
  if (!row) return "missing";
  if (row.bucket === "actionable") return "actionable";
  if (row.bucket === "watch") return "watch";
  if (row.bucket === "stale") return "stale";
  return "current";
}

function isHistoricalReplayEvidence(row, isStaleAttempt) {
  if (isStaleAttempt) return true;
  if (!row || row.bucket !== "stale") return false;
  return row.latestRunId !== null && row.id !== null && String(row.latestRunId) !== String(row.id);
}

function isCurrentMainSuccessEcho(row, focusBranch) {
  return row
    && row.bucket === "informational"
    && row.branch === focusBranch
    && row.status === "completed"
    && row.conclusion === "success"
    && row.latestRunId !== null
    && row.id !== null
    && String(row.latestRunId) === String(row.id);
}

function alertDisposition(evidence, replay, echo = false) {
  if (evidence === "actionable" || evidence === "watch") return "inspect";
  if (echo) return "verification-only";
  if (replay) return "suppress-replay";
  if (evidence === "stale") return "suppress-stale";
  return "review";
}

function buildRawAlertEvidence(alertRefs, rows, options = {}) {
  const rowsById = new Map(rows.map((row) => [String(row.id), row]));
  const focusBranch = options.branch || "main";
  return alertRefs.map((ref) => {
    const row = rowsById.get(ref.id);
    const currentAttempt = row?.attempt ?? null;
    const isStaleAttempt = ref.alertedAttempt !== null && currentAttempt !== null && ref.alertedAttempt < currentAttempt;
    const replay = isHistoricalReplayEvidence(row, isStaleAttempt);
    const echo = !isStaleAttempt && isCurrentMainSuccessEcho(row, focusBranch);
    const evidence = isStaleAttempt ? "stale" : alertEvidenceState(row);
    const verdict = echo ? "current-main-echo" : evidence;
    const reason = isStaleAttempt
      ? `superseded by attempt ${currentAttempt}`
      : echo
        ? `verification-only current ${focusBranch} success echo`
        : row?.reason ?? "run URL was not present in the inspected gh run list window";
    return {
      alertedRunId: ref.id,
      alertedAttempt: ref.alertedAttempt,
      alertedUrl: ref.url,
      appearances: ref.appearances,
      evidence,
      verdict,
      echo,
      replay,
      disposition: alertDisposition(evidence, replay, echo),
      reason,
      replayReason: replay ? `historical replay of ${reason}` : "",
      currentRunId: row?.latestRunId ?? null,
      currentAttempt,
      workflow: row?.workflow ?? "",
      branch: row?.branch ?? "",
      status: row?.status ?? "",
      conclusion: row?.conclusion ?? "",
      updatedAt: row?.updatedAt ?? "",
      runUrl: ref.url,
    };
  });
}

function shouldKeepCompactAlert(alert, focusBranch) {
  if (alert.evidence === "actionable" || alert.evidence === "watch" || alert.evidence === "missing") return true;
  if (alert.evidence === "current" && alert.branch === focusBranch) return true;
  if (alert.evidence === "stale" && alert.conclusion && !["success", "cancelled", "skipped"].includes(alert.conclusion)) return true;
  return false;
}

function summarizeOmittedAlerts(omitted) {
  const byEvidence = {};
  const byConclusion = {};
  for (const alert of omitted) {
    const evidence = alert.evidence || "unknown";
    const conclusion = alert.conclusion || "unknown";
    byEvidence[evidence] = (byEvidence[evidence] ?? 0) + 1;
    byConclusion[conclusion] = (byConclusion[conclusion] ?? 0) + 1;
  }
  return { byEvidence, byConclusion };
}

function alertKey(alert) {
  return `${alert.alertedRunId}:${alert.alertedAttempt ?? "current"}`;
}

function alertSummaryFields(allEvidence, focusBranch) {
  const currentHeadRunIds = [
    ...new Set(
      allEvidence
        .filter((alert) => alert.echo || (alert.evidence === "current" && alert.branch === focusBranch))
        .map((alert) => alert.alertedRunId),
    ),
  ];

  return {
    currentHeadCount: currentHeadRunIds.length,
    currentHeadRunIds,
    currentMainEchoCount: allEvidence.filter((alert) => alert.echo).length,
    staleReplayCount: allEvidence.filter((alert) => alert.replay).length,
  };
}

function buildAlertEvidence(alertRefs, rows, options = {}) {
  const focusBranch = options.branch || "main";
  const allEvidence = buildRawAlertEvidence(alertRefs, rows, { branch: focusBranch });
  const limit = options.alertEvidenceLimit || DEFAULT_ALERT_EVIDENCE_LIMIT;
  const summaryFields = alertSummaryFields(allEvidence, focusBranch);

  if (allEvidence.length <= limit) {
    return {
      alerts: allEvidence,
      summary: {
        mode: "full",
        total: allEvidence.length,
        shown: allEvidence.length,
        omitted: 0,
        focusBranch,
        ...summaryFields,
      },
    };
  }

  const kept = [];
  const keptKeys = new Set();
  const keep = (alert, sampled = false) => {
    const key = alertKey(alert);
    if (keptKeys.has(key)) return;
    keptKeys.add(key);
    kept.push(sampled ? { ...alert, sampled: true } : alert);
  };

  for (const alert of allEvidence) {
    if (shouldKeepCompactAlert(alert, focusBranch)) keep(alert);
  }

  let staleSampleCount = 0;
  for (const alert of allEvidence) {
    if (staleSampleCount >= STALE_ALERT_SAMPLE_LIMIT) break;
    if (alert.evidence === "stale" && (alert.conclusion === "cancelled" || alert.conclusion === "skipped")) {
      keep(alert, true);
      staleSampleCount += 1;
    }
  }

  kept.sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt || "") || 0;
    const rightTime = Date.parse(right.updatedAt || "") || 0;
    return rightTime - leftTime || Number(right.appearances) - Number(left.appearances);
  });

  const keptKeySet = new Set(kept.map(alertKey));
  const omitted = allEvidence.filter((alert) => !keptKeySet.has(alertKey(alert)));

  return {
    alerts: kept,
    summary: {
      mode: "compact",
      total: allEvidence.length,
      shown: kept.length,
      omitted: omitted.length,
      focusBranch,
      staleSampleLimit: STALE_ALERT_SAMPLE_LIMIT,
      ...summaryFields,
      ...summarizeOmittedAlerts(omitted),
    },
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

function formatCountMap(map) {
  if (!map || Object.keys(map).length === 0) return "none";
  return Object.entries(map)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => `${key}: ${count}`)
    .join(", ");
}

function alertEvidenceTable(alerts, summary) {
  if (!alerts || alerts.length === 0) return "";
  const currentHeadVerdict = summary?.currentHeadRunIds?.length
    ? ` Current-head verdict${summary.currentHeadRunIds.length === 1 ? "" : "s"}: ${summary.currentHeadRunIds.map((id) => `\`${escapeMarkdown(id)}\``).join(", ")}. Current-main echo count: ${summary.currentMainEchoCount ?? 0}. Stale historical replay count: ${summary.staleReplayCount ?? 0}.`
    : "";
  const compactNote = summary?.mode === "compact"
    ? `Compact mode: showing ${summary.shown}/${summary.total} pasted alert URLs for focus branch \`${escapeMarkdown(summary.focusBranch)}\`; omitted ${summary.omitted} low-signal historical replay rows (${escapeMarkdown(formatCountMap(summary.byConclusion))}).${currentHeadVerdict}`
    : `Full mode: showing all ${summary?.shown ?? alerts.length} pasted alert URLs.${currentHeadVerdict}`;
  const lines = [
    "## Pasted alert URL evidence",
    "",
    compactNote,
    "",
    "| Evidence | Verdict | Disposition | Replay | Alerted run | Alerted attempt | Current run | Current attempt | Workflow | Branch | Status | Conclusion | Reason | Seen |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const alert of alerts) {
    const alertedRun = alert.runUrl ? `[${alert.alertedRunId}](${alert.runUrl})` : `\`${alert.alertedRunId}\``;
    const currentRun = alert.currentRunId ? `\`${alert.currentRunId}\`` : "-";
    const alertedAttempt = alert.alertedAttempt ?? "-";
    const currentAttempt = alert.currentAttempt ?? "-";
    const evidence = alert.sampled ? `${alert.evidence} sample` : alert.evidence;
    const replay = alert.replay ? "historical replay" : "-";
    const reason = alert.replayReason || alert.reason;
    lines.push(`| ${evidence} | ${escapeMarkdown(alert.verdict || alert.evidence || "-")} | ${alert.disposition} | ${replay} | ${alertedRun} | ${alertedAttempt} | ${currentRun} | ${currentAttempt} | ${escapeMarkdown(alert.workflow || "-")} | \`${escapeMarkdown(alert.branch || "-")}\` | ${escapeMarkdown(alert.status || "-")} | ${escapeMarkdown(alert.conclusion || "-")} | ${escapeMarkdown(reason)} | ${alert.appearances} |`);
  }

  return `${lines.join("\n")}\n\n`;
}

function renderMarkdown(result) {
  const actionable = result.rows.filter((row) => row.bucket === "actionable" || row.bucket === "watch");
  const stale = result.rows.filter((row) => row.bucket === "stale");
  return `# CI alert replay triage

Generated: ${result.generatedAt}

Use this report to collapse replayed GitHub Actions alert buffers: inspect only \`actionable\` and \`watch\` rows, suppress alert evidence marked \`suppress-replay\`, and treat \`stale\` rows as already superseded/cancelled unless a new run appears.

## Summary

- Total runs inspected: ${result.totalRuns}
- Actionable latest failures: ${result.counts.actionable ?? 0}
- Latest runs still in flight: ${result.counts.watch ?? 0}
- Stale replay rows: ${result.counts.stale ?? 0}
- Informational successes/neutral rows: ${result.counts.informational ?? 0}
- Pasted alert URLs inspected: ${result.alertSummary?.total ?? result.alerts?.length ?? 0}
- Pasted alert evidence shown: ${result.alertSummary?.shown ?? result.alerts?.length ?? 0}
- Pasted alert evidence omitted: ${result.alertSummary?.omitted ?? 0}

${alertEvidenceTable(result.alerts, result.alertSummary)}## Actionable / watch

${markdownTable(actionable)}
## Stale replay rows

${markdownTable(stale)}`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const rawRuns = readRuns(options);
  if (!Array.isArray(rawRuns)) throw new Error("Expected an array of GitHub Actions runs");
  const result = classifyRuns(rawRuns);
  const alertRefs = extractAlertRunRefs(readAlertText(options.alertsInput));
  const alertEvidence = buildAlertEvidence(alertRefs, result.rows, options);
  result.alerts = alertEvidence.alerts;
  result.alertSummary = alertEvidence.summary;
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
