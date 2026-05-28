#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_LIMIT = 100;
const DEFAULT_ALERT_EVIDENCE_LIMIT = 12;
const STALE_ALERT_SAMPLE_LIMIT = 3;
const OMITTED_ALERT_RUN_EVIDENCE_LIMIT = 12;
const STALE_CONCLUSIONS = new Set(["cancelled", "skipped"]);
const ACTIONABLE_CONCLUSIONS = new Set(["failure", "timed_out", "action_required", "startup_failure"]);
const ACTIVE_STATUSES = new Set(["queued", "in_progress", "waiting", "pending", "requested"]);
const TMUX_BLOCKER_PATTERN = /\b(TS\d{4}|error|errors|failed|failure|exception)\b/i;
const TMUX_NON_BLOCKER_PATTERN = /\b(?:0|zero|no)\s+errors?\b/i;
const CLAIM_BOUNDARY = "read-only alert triage only; PR CI, push CI, and pull_request_target/pull_request_review Merge Gate evidence are reporting lanes, not authorization or merge authority";
const TMUX_RECOVERY_PATTERNS = [
  /\bnpm\s+(?:run\s+)?test\b.*\bpass(?:ed|ing)?\b/i,
  /\btests?\s+pass(?:ed|ing)?\b/i,
  /\bPR\s+#?\d+\s+(?:opened|created|ready|merged)\b/i,
  /\bralplan\s+terminal\b/i,
  /\btmux\s+session\s+(?:killed|terminated|closed|exited)\b/i,
  /\b(?:process\s+)?exited\s+(?:with\s+)?code\s+0\b/i,
];

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
  console.log(`Usage: node scripts/triage-ci-alerts.mjs [options]\n\nClassifies recent GitHub Actions CI runs so replayed alert buffers can be skimmed\nfor only the latest actionable failures. Cancelled/skipped runs and older runs\nsuperseded by newer runs on the same workflow+branch are marked stale.\n\nOptions:\n  --input <path>     Read gh run list JSON from a file instead of invoking gh\n  --alerts <path>    Read pasted alert text / run URLs from a file, or - for stdin\n  --limit <n>        Number of runs to fetch when using gh (default: ${DEFAULT_LIMIT})\n  --branch <name>    Restrict to a branch/head branch\n  --workflow <name>  Restrict to a workflow display name\n  --json             Emit machine-readable JSON instead of markdown\n  --markdown         Emit markdown (default)\n  --output <path>    Write output to a file instead of stdout\n  -h, --help         Show this help\n\nLive usage:\n  npm run --silent ci:alerts -- --branch main\n\nOffline/replay usage:\n  gh run list --limit 100 --json attempt,databaseId,status,conclusion,createdAt,updatedAt,headBranch,headSha,event,name,workflowName,url > /tmp/runs.json\n  npm run --silent ci:alerts -- --input /tmp/runs.json --json

Pasted alert URL usage:
  pbpaste > /tmp/discord-alerts.txt
  npm run --silent ci:alerts -- --alerts /tmp/discord-alerts.txt --branch main

Bulk replay behavior:
  When pasted alerts exceed --alert-evidence-limit, ci:alerts keeps current main/
  selected-branch runs plus actionable/watch/missing evidence and a small cancelled
  stale sample, then summarizes omitted historical success/cancelled replay rows.`);
}

function readRuns(options, spawn = spawnSync) {
  if (options.input) {
    return JSON.parse(fs.readFileSync(path.resolve(repoRoot, options.input), "utf8"));
  }

  const args = [
    "run",
    "list",
    "--limit",
    String(options.limit),
    "--json",
    "attempt,databaseId,status,conclusion,createdAt,updatedAt,headBranch,headSha,event,name,workflowName,url",
  ];
  if (options.branch) args.push("--branch", options.branch);
  if (options.workflow) args.push("--workflow", options.workflow);

  const result = spawn("gh", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || `gh run list exited with status ${result.status}`);
  }
  return JSON.parse(result.stdout);
}

function repoSlugFromOrigin(spawn = spawnSync) {
  const result = spawn("git", ["config", "--get", "remote.origin.url"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const remoteUrl = result.stdout.trim();
  const match = remoteUrl.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/.]+)(?:\.git)?$/);
  return match?.groups ? `${match.groups.owner}/${match.groups.repo}` : "";
}

function fetchRunJobs(repoSlug, runId, spawn = spawnSync) {
  const result = spawn("gh", [
    "api",
    `repos/${repoSlug}/actions/runs/${runId}/jobs?filter=all&per_page=100`,
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) return [];
  try {
    const payload = JSON.parse(result.stdout);
    return Array.isArray(payload.jobs) ? payload.jobs : [];
  } catch {
    return [];
  }
}

function isMergeGateRun(run) {
  return String(run.event || "") === "pull_request_target"
    && String(run.workflowName || run.name || "") === "Merge Gate";
}

function enrichRunsWithAlertJobs(rawRuns, alertRefs, options, spawn = spawnSync) {
  if (options.input || alertRefs.every((ref) => ref.alertedJobId === null)) return rawRuns;
  const repoSlug = repoSlugFromOrigin(spawn);
  if (!repoSlug) return rawRuns;

  const alertedJobRunIds = new Set(alertRefs
    .filter((ref) => ref.alertedJobId !== null)
    .map((ref) => String(ref.id)));

  return rawRuns.map((run) => {
    const runId = run.databaseId ?? run.id ?? null;
    if (!alertedJobRunIds.has(String(runId)) || !isMergeGateRun(run)) return run;
    if (Array.isArray(run.jobs) || Array.isArray(run.checkRuns)) return run;
    const jobs = fetchRunJobs(repoSlug, runId, spawn);
    return jobs.length > 0 ? { ...run, jobs } : run;
  });
}

function readAlertText(alertsInput) {
  if (!alertsInput) return "";
  if (alertsInput === "-") return fs.readFileSync(0, "utf8");
  return fs.readFileSync(path.resolve(repoRoot, alertsInput), "utf8");
}

function matchedTmuxKeyword(line) {
  const withoutBenignErrorCounts = line.replace(TMUX_NON_BLOCKER_PATTERN, "");
  return withoutBenignErrorCounts.match(TMUX_BLOCKER_PATTERN)?.[1] ?? "";
}

function isTmuxRecoveryLine(line) {
  return TMUX_RECOVERY_PATTERNS.some((pattern) => pattern.test(line));
}

function buildTmuxHistoryEvidence(alertText) {
  const rawLines = String(alertText || "").split(/\r?\n/);
  const lines = rawLines.map((text, index) => ({
    line: index + 1,
    text,
    marker: isTmuxRecoveryLine(text),
    matchedKeyword: matchedTmuxKeyword(text),
  }));
  const markerLines = lines.filter((line) => line.marker);
  const lastRecoveryLine = markerLines.length ? markerLines.at(-1).line : null;
  const rows = lines
    .filter((line) => line.matchedKeyword)
    .map((line) => {
      const staleHistory = lastRecoveryLine !== null && line.line <= lastRecoveryLine;
      return {
        lineNumber: line.line,
        excerpt: line.text.trim(),
        matchedKeyword: line.matchedKeyword,
        lastRecoveryMarkerLine: lastRecoveryLine,
        evidence: staleHistory ? "stale-history" : "current",
        verdict: staleHistory ? "tmux-history-replay" : "fresh-blocker",
        disposition: staleHistory ? "suppress-replay" : "inspect",
        reason: staleHistory
          ? `blocker keyword appears before recovery/terminal marker on line ${lastRecoveryLine}`
          : lastRecoveryLine === null
            ? "blocker keyword has no later recovery/terminal marker in pasted pane history"
            : `blocker keyword appears after recovery/terminal marker on line ${lastRecoveryLine}`,
      };
    });
  const staleHistoryCount = rows.filter((row) => row.evidence === "stale-history").length;
  const freshBlockerCount = rows.filter((row) => row.disposition === "inspect").length;

  return {
    rows,
    summary: {
      mode: alertText ? "scanned" : "empty",
      totalLines: rawLines.length === 1 && rawLines[0] === "" ? 0 : rawLines.length,
      recoveryMarkerCount: markerLines.length,
      lastMarkerLine: lastRecoveryLine,
      totalKeywordLines: rows.length,
      staleKeywordLines: staleHistoryCount,
      currentKeywordLines: freshBlockerCount,
      disposition: freshBlockerCount > 0 ? "inspect" : staleHistoryCount > 0 ? "suppress-replay" : "none",
      verdict: freshBlockerCount > 0 ? "fresh-blocker" : staleHistoryCount > 0 ? "stale-history-replay" : "no-keyword-evidence",
    },
  };
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
    const alertedJobId = (match[2] === "job" || match[2] === "jobs") ? normalizePositiveInteger(match[3]) : null;
    const key = alertedJobId !== null
      ? `${id}:job:${alertedJobId}`
      : alertedAttempt === null ? id : `${id}:attempt:${alertedAttempt}`;
    const existing = refsByKey.get(key);
    if (existing) {
      existing.appearances += 1;
      if (existing.alertedJobId === null && alertedJobId !== null) existing.alertedJobId = alertedJobId;
    } else {
      refsByKey.set(key, {
        id,
        alertedAttempt,
        alertedJobId,
        url: match[0].replace(/[.,;:!?]+$/, ""),
        appearances: 1,
      });
    }
  }

  return [...refsByKey.values()];
}

function normalizeRunJobs(run) {
  const jobs = Array.isArray(run.jobs) ? run.jobs : Array.isArray(run.checkRuns) ? run.checkRuns : [];
  return jobs
    .map((job) => ({
      id: normalizePositiveInteger(job?.databaseId ?? job?.id ?? job?.jobId ?? job?.checkRunId),
      name: job?.name ?? job?.checkName ?? "",
      status: job?.status ?? "",
      conclusion: job?.conclusion ?? "",
      completedAt: job?.completedAt ?? job?.completed_at ?? job?.updatedAt ?? job?.updated_at ?? "",
      url: job?.url ?? job?.htmlUrl ?? job?.html_url ?? "",
    }))
    .filter((job) => job.id !== null)
    .sort((left, right) => (Date.parse(right.completedAt || "") || 0) - (Date.parse(left.completedAt || "") || 0) || Number(right.id) - Number(left.id));
}

function ciLaneForRun(run) {
  const event = String(run.event || "");
  const workflow = String(run.workflowName || run.name || "");
  if (event === "pull_request_target" && workflow === "Merge Gate") return "pull_request_target:merge-gate";
  if (event === "pull_request_target") return "pull_request_target";
  if (event === "pull_request") return "pull_request";
  if (event === "push") return "push";
  return event || "unknown-event";
}

function normalizeRun(run) {
  const jobs = normalizeRunJobs(run);
  const latestJob = jobs[0] ?? null;
  return {
    id: run.databaseId ?? run.id ?? null,
    workflow: run.workflowName || run.name || "unknown-workflow",
    name: run.name || run.workflowName || "unknown-run",
    branch: run.headBranch || "unknown-branch",
    event: run.event || "unknown-event",
    headSha: run.headSha || "",
    status: run.status || "unknown-status",
    conclusion: run.conclusion || "",
    attempt: normalizePositiveInteger(run.attempt),
    latestJobId: normalizePositiveInteger(run.latestJobId ?? run.currentJobId ?? run.jobId ?? latestJob?.id),
    latestJobName: run.latestJobName ?? run.currentJobName ?? latestJob?.name ?? "",
    latestJobConclusion: run.latestJobConclusion ?? run.currentJobConclusion ?? latestJob?.conclusion ?? "",
    latestJobUrl: run.latestJobUrl ?? run.currentJobUrl ?? latestJob?.url ?? "",
    jobs,
    ciLane: ciLaneForRun(run),
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

function isLaterSuccessfulRunEvidence(row) {
  return row
    && row.latestRunId !== null
    && row.id !== null
    && String(row.latestRunId) !== String(row.id)
    && row.latestStatus === "completed"
    && row.latestConclusion === "success"
    && row.latestUpdatedAt
    && runTime({ updatedAt: row.latestUpdatedAt }) > runTime(row);
}

function isSupersededMainCancellationEcho(row, focusBranch) {
  return row
    && row.bucket === "stale"
    && row.branch === focusBranch
    && row.status === "completed"
    && row.conclusion === "cancelled"
    && isLaterSuccessfulRunEvidence(row);
}

function needsMainCancellationSuccessEvidence(row, focusBranch) {
  return row
    && row.bucket === "stale"
    && row.branch === focusBranch
    && row.status === "completed"
    && row.conclusion === "cancelled"
    && !isLaterSuccessfulRunEvidence(row);
}

function isHistoricalReplayEvidence(row, isStaleAttempt, focusBranch) {
  if (isStaleAttempt) return true;
  if (!row || row.bucket !== "stale") return false;
  if (row.branch === focusBranch && row.conclusion === "cancelled") {
    return isLaterSuccessfulRunEvidence(row);
  }
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

function supersedingSuccessfulRerunJob(row, alertedJobId) {
  if (!row
    || alertedJobId === null
    || row.ciLane !== "pull_request_target:merge-gate"
    || row.status !== "completed") {
    return null;
  }

  const alertedJob = Array.isArray(row.jobs)
    ? row.jobs.find((job) => String(job.id) === String(alertedJobId))
    : null;
  if (alertedJob) {
    if (!ACTIONABLE_CONCLUSIONS.has(alertedJob.conclusion)) return null;
    const alertedTime = Date.parse(alertedJob.completedAt || "");
    if (!Number.isFinite(alertedTime)) return null;
    return row.jobs.find((job) => {
      const completedAt = Date.parse(job.completedAt || "");
      const completedLater = Number.isFinite(completedAt) && completedAt > alertedTime;
      return String(job.id) !== String(alertedJobId)
        && job.name === alertedJob.name
        && job.status === "completed"
        && job.conclusion === "success"
        && completedLater;
    }) ?? null;
  }

  return null;
}

function needsMergeGateJobEvidence(row, alertedJobId) {
  return row
    && alertedJobId !== null
    && row.ciLane === "pull_request_target:merge-gate"
    && (!Array.isArray(row.jobs) || row.jobs.length === 0);
}

function hasMergeGateJobEvidence(row, alertedJobId) {
  return row
    && alertedJobId !== null
    && row.ciLane === "pull_request_target:merge-gate"
    && Array.isArray(row.jobs)
    && row.jobs.length > 0;
}

function alertDisposition(evidence, replay, echo = false, review = false) {
  if (evidence === "actionable" || evidence === "watch") return "inspect";
  if (review) return "review";
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
    const supersedingJob = !isStaleAttempt ? supersedingSuccessfulRerunJob(row, ref.alertedJobId) : null;
    const supersededSuccessfulRerunJobEcho = supersedingJob !== null;
    const mergeGateJobEvidenceMissing = !isStaleAttempt && !supersededSuccessfulRerunJobEcho && needsMergeGateJobEvidence(row, ref.alertedJobId);
    const mergeGateJobNotSuperseded = !isStaleAttempt && !supersededSuccessfulRerunJobEcho && hasMergeGateJobEvidence(row, ref.alertedJobId);
    const requiresMergeGateJobReview = mergeGateJobEvidenceMissing || mergeGateJobNotSuperseded;
    const replay = isHistoricalReplayEvidence(row, isStaleAttempt, focusBranch) || supersededSuccessfulRerunJobEcho;
    const echo = !isStaleAttempt && !supersededSuccessfulRerunJobEcho && !mergeGateJobEvidenceMissing && !mergeGateJobNotSuperseded && isCurrentMainSuccessEcho(row, focusBranch);
    const supersededMainCancellationEcho = !isStaleAttempt && !supersededSuccessfulRerunJobEcho && isSupersededMainCancellationEcho(row, focusBranch);
    const cancellationNeedsSuccessEvidence = !isStaleAttempt && needsMainCancellationSuccessEvidence(row, focusBranch);
    const evidence = (mergeGateJobEvidenceMissing || mergeGateJobNotSuperseded) ? "review" : (isStaleAttempt || supersededSuccessfulRerunJobEcho) ? "stale" : alertEvidenceState(row);
    const verdict = echo
      ? "current-main-echo"
      : supersededSuccessfulRerunJobEcho
        ? "superseded-successful-rerun-job-echo"
        : mergeGateJobEvidenceMissing
          ? "merge-gate-job-evidence-unavailable"
          : mergeGateJobNotSuperseded
            ? "merge-gate-job-not-superseded"
            : supersededMainCancellationEcho
              ? "superseded-main-ci-cancel-echo"
              : evidence;
    const reason = isStaleAttempt
      ? `superseded by attempt ${currentAttempt}`
      : supersededSuccessfulRerunJobEcho
        ? `${row.ciLane} job ${ref.alertedJobId} superseded by newer successful job ${supersedingJob.id} in run ${row.id}`
        : mergeGateJobEvidenceMissing
          ? `${row.ciLane} job ${ref.alertedJobId} needs job-list evidence before suppressing as a rerun echo`
          : mergeGateJobNotSuperseded
            ? `${row.ciLane} job ${ref.alertedJobId} has no newer successful same-name job evidence`
            : echo
              ? `verification-only current ${focusBranch} success echo`
              : supersededMainCancellationEcho
                ? `cancelled ${focusBranch} run superseded by successful run ${row.latestRunId}`
                : cancellationNeedsSuccessEvidence
                  ? `cancelled ${focusBranch} run has no later success evidence`
                  : row?.reason ?? "run URL was not present in the inspected gh run list window";
    return {
      alertedRunId: ref.id,
      alertedAttempt: ref.alertedAttempt,
      alertedJobId: ref.alertedJobId,
      alertedUrl: ref.url,
      appearances: ref.appearances,
      evidence,
      verdict,
      echo,
      supersededMainCancellationEcho,
      supersededSuccessfulRerunJobEcho,
      mergeGateJobEvidenceMissing,
      mergeGateJobNotSuperseded,
      replay,
      disposition: alertDisposition(evidence, replay, echo, cancellationNeedsSuccessEvidence || requiresMergeGateJobReview),
      reason,
      replayReason: replay ? `historical replay of ${reason}` : "",
      currentRunId: row?.latestRunId ?? null,
      currentAttempt,
      currentJobId: supersedingJob?.id ?? row?.latestJobId ?? null,
      ciLane: row?.ciLane ?? "",
      workflow: row?.workflow ?? "",
      branch: row?.branch ?? "",
      status: row?.status ?? "",
      conclusion: row?.conclusion ?? "",
      updatedAt: row?.updatedAt ?? "",
      headSha: row?.headSha ?? "",
      latestStatus: row?.latestStatus ?? "",
      latestConclusion: row?.latestConclusion ?? "",
      latestHeadSha: row?.latestHeadSha ?? "",
      latestUpdatedAt: row?.latestUpdatedAt ?? "",
      claimBoundary: CLAIM_BOUNDARY,
      runUrl: ref.url,
    };
  });
}

function shouldKeepCompactAlert(alert, focusBranch) {
  if (alert.disposition === "review") return true;
  if (alert.evidence === "actionable" || alert.evidence === "watch" || alert.evidence === "missing") return true;
  if (alert.evidence === "current" && alert.branch === focusBranch) return true;
  if (alert.evidence === "stale" && alert.conclusion && !["success", "cancelled", "skipped"].includes(alert.conclusion)) return true;
  return false;
}

function summarizeOmittedAlerts(omitted) {
  const byEvidence = {};
  const byConclusion = {};
  const omittedRunEvidence = [];
  for (const alert of omitted) {
    const evidence = alert.evidence || "unknown";
    const conclusion = alert.conclusion || "unknown";
    byEvidence[evidence] = (byEvidence[evidence] ?? 0) + 1;
    byConclusion[conclusion] = (byConclusion[conclusion] ?? 0) + 1;
    if (omittedRunEvidence.length < OMITTED_ALERT_RUN_EVIDENCE_LIMIT) {
      omittedRunEvidence.push({
        runId: alert.alertedRunId,
        attempt: alert.alertedAttempt,
        currentRunId: alert.currentRunId,
        conclusion: alert.conclusion || "unknown",
        evidence: alert.evidence || "unknown",
        disposition: alert.disposition || "review",
        replay: Boolean(alert.replay),
        supersededMainCancellationEcho: Boolean(alert.supersededMainCancellationEcho),
        supersededSuccessfulRerunJobEcho: Boolean(alert.supersededSuccessfulRerunJobEcho),
      });
    }
  }
  return {
    byEvidence,
    byConclusion,
    omittedRunEvidenceLimit: OMITTED_ALERT_RUN_EVIDENCE_LIMIT,
    omittedRunEvidence,
  };
}

function alertKey(alert) {
  return `${alert.alertedRunId}:${alert.alertedAttempt ?? "current"}:${alert.alertedJobId ?? "run"}`;
}

function coalesceGenericRunJobAlerts(allEvidence) {
  const byRunAttempt = new Map();
  for (const alert of allEvidence) {
    const key = `${alert.alertedRunId}:${alert.alertedAttempt ?? "current"}`;
    const alerts = byRunAttempt.get(key) ?? [];
    alerts.push(alert);
    byRunAttempt.set(key, alerts);
  }

  return [...byRunAttempt.values()].flatMap((alerts) => {
    const hasMergeGateJobAlert = alerts.some((alert) => alert.alertedJobId !== null && alert.ciLane === "pull_request_target:merge-gate");
    if (hasMergeGateJobAlert) return alerts;
    const runAlert = alerts.find((alert) => alert.alertedJobId === null);
    if (!runAlert) return alerts;
    const appearances = alerts.reduce((total, alert) => total + alert.appearances, 0);
    return [{ ...runAlert, appearances }];
  });
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
    supersededMainCancellationEchoCount: allEvidence.filter((alert) => alert.supersededMainCancellationEcho).length,
    supersededSuccessfulRerunJobEchoCount: allEvidence.filter((alert) => alert.supersededSuccessfulRerunJobEcho).length,
    verificationOnlyCount: allEvidence.filter((alert) => alert.disposition === "verification-only").length,
    actionableAlertCount: allEvidence.filter((alert) => alert.disposition === "inspect").length,
    reviewAlertCount: allEvidence.filter((alert) => alert.disposition === "review").length,
    staleReplayCount: allEvidence.filter((alert) => alert.replay).length,
    staleSuccessReplayCount: allEvidence.filter((alert) => alert.replay && alert.conclusion === "success").length,
  };
}

function historicalReplayBatchGuard(allEvidence, focusBranch, summaryFields) {
  if (allEvidence.length === 0) {
    return {
      batchVerdict: "no-pasted-ci-run-urls",
      batchDisposition: "none",
      batchReason: "no GitHub Actions run URLs were present in the pasted alert buffer",
    };
  }

  const inspectable = allEvidence.filter((alert) => alert.disposition === "inspect" || alert.disposition === "review");
  const nonReplayNoise = allEvidence.filter((alert) => !alert.replay && !alert.echo && !alert.supersededMainCancellationEcho);
  if (inspectable.length === 0 && summaryFields.staleReplayCount > 0 && nonReplayNoise.length === 0) {
    return {
      batchVerdict: "historical-ci-replay-batch",
      batchDisposition: "suppress-historical-replay-before-current-main-echo",
      batchReason: `current GitHub Actions reporting state for ${focusBranch} is the freshest alert-triage evidence; all non-current pasted run URLs are stale replay noise before ${summaryFields.currentHeadCount} current-head echo${summaryFields.currentHeadCount === 1 ? "" : "es"}`,
    };
  }

  return {
    batchVerdict: "mixed-ci-alert-buffer",
    batchDisposition: inspectable.length > 0 ? "inspect-before-suppressing" : "review-before-suppressing",
    batchReason: inspectable.length > 0
      ? `${inspectable.length} pasted CI alert row${inspectable.length === 1 ? "" : "s"} still need inspection before suppressing historical replay noise`
      : "pasted CI alert rows are not a pure historical replay batch",
  };
}

function buildAlertEvidence(alertRefs, rows, options = {}) {
  const focusBranch = options.branch || "main";
  const allEvidence = coalesceGenericRunJobAlerts(buildRawAlertEvidence(alertRefs, rows, { branch: focusBranch }));
  const limit = options.alertEvidenceLimit || DEFAULT_ALERT_EVIDENCE_LIMIT;
  const summaryFields = alertSummaryFields(allEvidence, focusBranch);
  const batchGuard = historicalReplayBatchGuard(allEvidence, focusBranch, summaryFields);

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
        ...batchGuard,
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
      ...batchGuard,
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

    return {
      ...run,
      bucket,
      reason,
      latestRunId: latest?.id ?? null,
      latestStatus: latest?.status ?? "",
      latestConclusion: latest?.conclusion ?? "",
      latestHeadSha: latest?.headSha ?? "",
      latestUpdatedAt: latest?.updatedAt ?? latest?.createdAt ?? "",
      latestJobId: latest?.latestJobId ?? null,
    };
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
  const batchGuard = summary?.batchVerdict
    ? ` Batch guard: \`${escapeMarkdown(summary.batchVerdict)}\` / \`${escapeMarkdown(summary.batchDisposition)}\` — ${escapeMarkdown(summary.batchReason)}.`
    : "";
  const currentHeadVerdict = summary?.currentHeadRunIds?.length
    ? ` Current-head verdict${summary.currentHeadRunIds.length === 1 ? "" : "s"}: ${summary.currentHeadRunIds.map((id) => `\`${escapeMarkdown(id)}\``).join(", ")}. Current-main echo count: ${summary.currentMainEchoCount ?? 0}. Stale historical replay count: ${summary.staleReplayCount ?? 0}.`
    : "";
  const omittedEvidence = summary?.omittedRunEvidence?.length
    ? ` Bounded omitted run evidence: ${summary.omittedRunEvidence.map((evidence) => `\`${escapeMarkdown(evidence.runId)}:${escapeMarkdown(evidence.conclusion)}:${escapeMarkdown(evidence.disposition)}\``).join(", ")}${summary.omitted > summary.omittedRunEvidence.length ? ` (+${summary.omitted - summary.omittedRunEvidence.length} more)` : ""}.`
    : "";
  const compactNote = summary?.mode === "compact"
    ? `Compact mode: showing ${summary.shown}/${summary.total} pasted alert URLs for focus branch \`${escapeMarkdown(summary.focusBranch)}\`; omitted ${summary.omitted} low-signal historical replay rows (${escapeMarkdown(formatCountMap(summary.byConclusion))}).${batchGuard}${currentHeadVerdict}${omittedEvidence}`
    : `Full mode: showing all ${summary?.shown ?? alerts.length} pasted alert URLs.${batchGuard}${currentHeadVerdict}`;
  const lines = [
    "## Pasted alert URL evidence",
    "",
    `Claim boundary: ${escapeMarkdown(CLAIM_BOUNDARY)}.`,
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

function tmuxHistoryTable(rows, summary) {
  if (!summary || summary.totalKeywordLines === 0) return "";
  const lines = [
    "## Tmux pane history keyword evidence",
    "",
    `Verdict: \`${escapeMarkdown(summary.verdict)}\`; disposition: \`${escapeMarkdown(summary.disposition)}\`. Recovery/terminal markers: ${summary.recoveryMarkerCount}; last marker line: ${summary.lastMarkerLine ?? "-"}. Fresh blocker lines needing inspection: ${summary.currentKeywordLines}; stale history replay lines: ${summary.staleKeywordLines}.`,
    "",
    "Use `disposition=suppress-replay` only when the blocker keyword is older than the recovery/terminal marker. Lines after the marker remain `inspect` so fresh errors are not suppressed.",
    "",
    "| Disposition | Evidence | Line | Reason | Text |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const row of rows) {
    lines.push(`| ${row.disposition} | ${row.evidence} | ${row.lineNumber} | ${escapeMarkdown(row.reason)} | ${escapeMarkdown(row.excerpt)} |`);
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
- Pasted alert evidence needing inspection: ${(result.alertSummary?.actionableAlertCount ?? 0) + (result.alertSummary?.reviewAlertCount ?? 0)}
- Pasted alert evidence requiring review: ${result.alertSummary?.reviewAlertCount ?? 0}
- Verification-only current-main echoes: ${result.alertSummary?.verificationOnlyCount ?? 0}
- Superseded main cancellation echoes: ${result.alertSummary?.supersededMainCancellationEchoCount ?? 0}
- Superseded successful rerun job echoes: ${result.alertSummary?.supersededSuccessfulRerunJobEchoCount ?? 0}
- Stale success replay evidence: ${result.alertSummary?.staleSuccessReplayCount ?? 0}
- Tmux pane history fresh blockers: ${result.tmuxHistorySummary?.currentKeywordLines ?? 0}
- Tmux pane history stale replay lines: ${result.tmuxHistorySummary?.staleKeywordLines ?? 0}

${alertEvidenceTable(result.alerts, result.alertSummary)}${tmuxHistoryTable(result.tmuxHistory, result.tmuxHistorySummary)}## Actionable / watch

${markdownTable(actionable)}
## Stale replay rows

${markdownTable(stale)}`;
}

function runCli(argv = process.argv.slice(2), io = {}) {
  const options = parseArgs(argv);
  const alertText = readAlertText(options.alertsInput);
  const alertRefs = extractAlertRunRefs(alertText);
  const spawn = io.spawn ?? spawnSync;
  const baseRuns = readRuns(options, spawn);
  if (!Array.isArray(baseRuns)) throw new Error("Expected an array of GitHub Actions runs");
  const rawRuns = enrichRunsWithAlertJobs(baseRuns, alertRefs, options, spawn);
  if (!Array.isArray(rawRuns)) throw new Error("Expected an array of GitHub Actions runs");
  const result = classifyRuns(rawRuns);
  const alertEvidence = buildAlertEvidence(alertRefs, result.rows, options);
  const tmuxHistoryEvidence = buildTmuxHistoryEvidence(alertText);
  result.alerts = alertEvidence.alerts;
  result.alertSummary = alertEvidence.summary;
  result.tmuxHistory = tmuxHistoryEvidence.rows;
  result.tmuxHistorySummary = tmuxHistoryEvidence.summary;
  const output = options.format === "json" ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result);

  if (options.output) fs.writeFileSync(path.resolve(repoRoot, options.output), output);
  else (io.stdout ?? process.stdout).write(output);
  return { result, output };
}

function main() {
  runCli();
}

const isDirectCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectCli) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export { runCli };
