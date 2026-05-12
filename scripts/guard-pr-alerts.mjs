#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const options = {
    alertsInput: "",
    eventsInput: "",
    prEvidenceInput: "",
    output: "",
    repo: "",
    format: "markdown",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--alerts") options.alertsInput = argv[++index];
    else if (arg === "--events") options.eventsInput = argv[++index];
    else if (arg === "--pr-evidence") options.prEvidenceInput = argv[++index];
    else if (arg === "--repo") options.repo = normalizeRepo(argv[++index]);
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

  if (!options.alertsInput) throw new Error("--alerts is required");
  if (!options.repo) throw new Error("--repo owner/name is required");

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/guard-pr-alerts.mjs --repo <owner/repo> --alerts <path|-> [options]\n\nRead-only guard for alert buffers that mention issue/PR numbers before any PR-specific\nrecovery handling. It resolves refs through GitHub's issues API shape: pull requests\ninclude a pull_request field, while ordinary issues do not.\n\nOptions:\n  --alerts <path|->   Read alert text from a file or stdin\n  --events <path>     Use saved GitHub issue API JSON instead of invoking gh api\n  --pr-evidence <path>\n                     Use saved PR-ish duplicate evidence keyed by PR number\n  --repo <owner/repo> Repository to resolve shorthand refs against\n  --json              Emit machine-readable JSON\n  --markdown          Emit markdown (default)\n  --output <path>     Write output to a file instead of stdout\n  -h, --help          Show this help\n\nOffline usage:\n  gh api repos/minislively/fooks/issues/226 > /tmp/fooks-226.json\n  printf 'clawhip/relay: fooks#226 closed/commented' > /tmp/alerts.txt\n  node scripts/guard-pr-alerts.mjs --repo minislively/fooks --alerts /tmp/alerts.txt --events /tmp/fooks-226.json --json\n\nLive usage (read-only):\n  node scripts/guard-pr-alerts.mjs --repo minislively/fooks --alerts /tmp/alerts.txt`);
}

function normalizeRepo(value) {
  const trimmed = String(value ?? "").trim();
  const match = trimmed.match(/(?:github\.com[/:])?([^/\s]+)\/([^/\s#]+?)(?:\.git)?$/i);
  return match ? `${match[1]}/${match[2]}` : trimmed;
}

function readText(input) {
  if (input === "-") return fs.readFileSync(0, "utf8");
  return fs.readFileSync(path.resolve(repoRoot, input), "utf8");
}

function uniqueRefs(refs) {
  const seen = new Set();
  return refs.filter((ref) => {
    const key = `${ref.owner}/${ref.repo}#${ref.number}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractRefs(alertText, defaultRepo) {
  const [defaultOwner, defaultName] = defaultRepo.split("/");
  const refs = [];

  const urlPattern = /https:\/\/github\.com\/([^\s/]+)\/([^\s/]+)\/(?:issues|pull)\/(\d+)(?:[^\s<>)\]]*)?/gi;
  for (const match of alertText.matchAll(urlPattern)) {
    refs.push({ owner: match[1], repo: match[2].replace(/\.git$/i, ""), number: Number.parseInt(match[3], 10), source: match[0].replace(/[.,;:!?]+$/, "") });
  }

  const fullShorthand = /\b([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#(\d+)\b/g;
  for (const match of alertText.matchAll(fullShorthand)) {
    refs.push({ owner: match[1], repo: match[2], number: Number.parseInt(match[3], 10), source: match[0] });
  }

  const repoNamePattern = new RegExp(`\\b${escapeRegExp(defaultName)}#(\\d+)\\b`, "gi");
  for (const match of alertText.matchAll(repoNamePattern)) {
    refs.push({ owner: defaultOwner, repo: defaultName, number: Number.parseInt(match[1], 10), source: match[0] });
  }

  return uniqueRefs(refs).filter((ref) => `${ref.owner}/${ref.repo}`.toLowerCase() === defaultRepo.toLowerCase());
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readEvents(eventsInput) {
  if (!eventsInput) return new Map();
  const raw = JSON.parse(fs.readFileSync(path.resolve(repoRoot, eventsInput), "utf8"));
  const items = Array.isArray(raw) ? raw : [raw];
  return new Map(items.map((item) => [String(item.number), item]));
}


function readPrEvidence(prEvidenceInput) {
  if (!prEvidenceInput) return new Map();
  const raw = JSON.parse(fs.readFileSync(path.resolve(repoRoot, prEvidenceInput), "utf8"));
  const items = Array.isArray(raw) ? raw : raw?.pullRequests ?? raw?.prs ?? [raw];
  return new Map(items.filter(Boolean).map((item) => [String(item.number), item]));
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/#\d+/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeFiles(files) {
  if (!Array.isArray(files)) return [];
  return files
    .map((file) => typeof file === "string" ? file : file?.filename ?? file?.path ?? file?.file)
    .filter((file) => typeof file === "string" && file.trim())
    .map((file) => file.trim());
}

function linkedIssueIsClosed(evidence) {
  const linkedIssue = evidence?.linkedIssue ?? evidence?.linked_issue;
  return linkedIssue?.state === "closed" || Boolean(linkedIssue?.closedAt ?? linkedIssue?.closed_at);
}

function closingPullNumber(evidence) {
  const linkedIssue = evidence?.linkedIssue ?? evidence?.linked_issue;
  const closer = linkedIssue?.closedByPullRequest ?? linkedIssue?.closed_by_pull_request;
  const number = closer?.number ?? linkedIssue?.closedByPullRequestNumber ?? linkedIssue?.closed_by_pull_request_number;
  return Number.isInteger(number) ? number : Number.parseInt(String(number ?? ""), 10);
}

function linkedIssueNumber(evidence) {
  const linkedIssue = evidence?.linkedIssue ?? evidence?.linked_issue;
  const number = linkedIssue?.number ?? linkedIssue?.issueNumber ?? linkedIssue?.issue_number;
  return Number.isInteger(number) ? number : Number.parseInt(String(number ?? ""), 10);
}

function headIsDirty(evidence) {
  const head = evidence?.head ?? {};
  const dirtyState = head.mergeableState ?? head.mergeable_state ?? evidence?.mergeableState ?? evidence?.mergeable_state;
  if (["dirty", "conflicting"].includes(String(dirtyState ?? "").toLowerCase())) return true;
  if (head.isDirty === true || head.dirty === true || evidence?.dirtyHead === true || evidence?.dirty_head === true) return true;
  if (evidence?.mergeable === false || head.mergeable === false) return true;
  return false;
}

function titleDuplicateSignal(evidence, relatedPulls) {
  const title = normalizeText(evidence?.title);
  if (!title) return null;
  return relatedPulls.find((candidate) => normalizeText(candidate?.title) === title) ?? null;
}

function fileOverlapSignal(evidence, relatedPulls) {
  const currentFiles = new Set(normalizeFiles(evidence?.files));
  if (currentFiles.size === 0) return { candidate: null, files: [] };
  for (const candidate of relatedPulls) {
    const overlap = normalizeFiles(candidate?.files).filter((file) => currentFiles.has(file));
    if (overlap.length > 0) return { candidate, files: overlap };
  }
  return { candidate: null, files: [] };
}

function classifyPostMergeDuplicatePr(evidence) {
  if (!evidence || typeof evidence !== "object") {
    return { classification: "not-evaluated", recommendation: "no-duplicate-evidence", reasons: ["No PR duplicate evidence was supplied."] };
  }

  const relatedPulls = Array.isArray(evidence.relatedPullRequests) ? evidence.relatedPullRequests
    : Array.isArray(evidence.related_pull_requests) ? evidence.related_pull_requests
      : [];
  const closingNumber = closingPullNumber(evidence);
  const closingCandidate = Number.isInteger(closingNumber)
    ? relatedPulls.find((candidate) => Number(candidate?.number) === closingNumber)
    : null;
  const closingCandidateIsMerged = Boolean(closingCandidate?.mergedAt || closingCandidate?.merged_at || closingCandidate?.merged === true);
  const duplicateCandidates = closingCandidate ? [closingCandidate] : [];
  const titleMatch = titleDuplicateSignal(evidence, duplicateCandidates);
  const fileOverlap = fileOverlapSignal(evidence, duplicateCandidates);
  const duplicateSignals = [];
  if (titleMatch) duplicateSignals.push(`title matches closing PR #${titleMatch.number}`);
  if (fileOverlap.files.length > 0) duplicateSignals.push(`files overlap closing PR #${fileOverlap.candidate?.number ?? "unknown"}: ${fileOverlap.files.join(", ")}`);

  const reasons = [];
  if (linkedIssueIsClosed(evidence)) reasons.push("linked issue is already closed");
  else reasons.push("linked issue is not known closed");

  if (Number.isInteger(closingNumber)) reasons.push(`linked issue was closed by PR #${closingNumber}`);
  else reasons.push("linked issue closer PR is unknown");

  if (closingCandidateIsMerged) reasons.push(`closing PR #${closingCandidate.number} is merged`);
  else if (closingCandidate) reasons.push(`closing PR #${closingCandidate.number} is related but not known merged`);
  else if (Number.isInteger(closingNumber)) reasons.push(`closing PR #${closingNumber} evidence was not supplied`);

  if (duplicateSignals.length > 0) reasons.push(...duplicateSignals);
  else reasons.push("no same-title or overlapping-file duplicate signal supplied");

  if (headIsDirty(evidence)) reasons.push("current PR head is dirty or not mergeable");
  else reasons.push("current PR head is not known dirty");

  const isPostMergeDuplicate = linkedIssueIsClosed(evidence) && closingCandidateIsMerged && Number.isInteger(closingNumber) && duplicateSignals.length > 0 && headIsDirty(evidence);
  const linkedNumber = linkedIssueNumber(evidence);
  const evidenceLines = [
    Number.isInteger(linkedNumber)
      ? `linked issue #${linkedNumber}: ${linkedIssueIsClosed(evidence) ? "closed" : "not known closed"}`
      : `linked issue: ${linkedIssueIsClosed(evidence) ? "closed" : "not known closed"}`,
    Number.isInteger(closingNumber)
      ? `closing PR #${closingNumber}: ${closingCandidateIsMerged ? "merged" : closingCandidate ? "not known merged" : "evidence missing"}`
      : "closing PR: unknown",
    duplicateSignals.length > 0
      ? `duplicate signals: ${duplicateSignals.join("; ")}`
      : "duplicate signals: no same-title or overlapping-file signal supplied",
    `current PR head: ${headIsDirty(evidence) ? "dirty/not mergeable" : "not known dirty"}`,
    "action boundary: read-only evidence only; no close/comment/delete/branch cleanup performed",
  ];

  return {
    classification: isPostMergeDuplicate ? "duplicate-post-merge" : "insufficient-duplicate-post-merge-evidence",
    recommendation: isPostMergeDuplicate ? "operator-close-candidate" : "continue-normal-pr-triage",
    cutRecommendation: isPostMergeDuplicate ? "cut-duplicate-pr" : "do-not-cut",
    mergeRecovery: isPostMergeDuplicate ? "do-not-start-merge-recovery" : "not-ruled-out",
    destructiveAction: "none-read-only",
    evidenceLines,
    reasons,
  };
}

function fetchIssue(ref) {
  const stdout = execFileSync("gh", ["api", `repos/${ref.owner}/${ref.repo}/issues/${ref.number}`], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(stdout);
}

function alertMentionsRef(alertText, ref) {
  const refPatterns = [
    new RegExp(`\\b${escapeRegExp(ref.repo)}#${ref.number}\\b`, "i"),
    new RegExp(`\\b${escapeRegExp(ref.owner)}/${escapeRegExp(ref.repo)}#${ref.number}\\b`, "i"),
    new RegExp(`github\\.com/${escapeRegExp(ref.owner)}/${escapeRegExp(ref.repo)}/(?:issues|pull)/${ref.number}\\b`, "i"),
  ];
  return refPatterns.some((pattern) => pattern.test(alertText));
}

function alertLooksLikeNewToMergedEcho(alertText, ref) {
  return /<new>\s*->\s*merged/i.test(alertText) && alertMentionsRef(alertText, ref);
}

function alertLooksLikePrunedDogfoodRuntimeCleanupEcho(alertText, ref) {
  return (
    alertMentionsRef(alertText, ref) &&
    /\bmerged\b/i.test(alertText) &&
    /\bdogfood\b/i.test(alertText) &&
    /\b(?:stale|runtime|zombie|pruned|prune|cleanup)\b/i.test(alertText)
  );
}

function githubStateIsMerged(issue) {
  return Boolean(issue?.pull_request) && (
    Boolean(issue.pull_request.merged_at) ||
    Boolean(issue.merged_at) ||
    issue.pull_request.merged === true ||
    issue.merged === true
  );
}

function classifyIssue(ref, issue, alertText, duplicateEvidence = null) {
  const isPullRequest = Boolean(issue?.pull_request);
  const isMerged = isPullRequest && githubStateIsMerged(issue);
  const isNewToMergedEcho = isMerged && alertLooksLikeNewToMergedEcho(alertText, ref);
  const isPrunedDogfoodRuntimeCleanupEcho = isMerged && alertLooksLikePrunedDogfoodRuntimeCleanupEcho(alertText, ref);
  const postMergeDuplicate = isPullRequest && duplicateEvidence ? classifyPostMergeDuplicatePr(duplicateEvidence) : null;
  const prHandling = postMergeDuplicate?.classification === "duplicate-post-merge"
    ? "cut"
    : isNewToMergedEcho || isPrunedDogfoodRuntimeCleanupEcho ? "echo" : isPullRequest ? "allow" : "skip";
  return {
    repo: `${ref.owner}/${ref.repo}`,
    number: ref.number,
    source: ref.source,
    title: issue?.title ?? "",
    state: issue?.state ?? "unknown",
    htmlUrl: issue?.html_url ?? `https://github.com/${ref.owner}/${ref.repo}/issues/${ref.number}`,
    kind: isPullRequest ? "pull_request" : "issue",
    prHandling,
    reason: isNewToMergedEcho
      ? "Alert reports <new> -> merged and GitHub state is already merged; verification-only echo"
      : isPrunedDogfoodRuntimeCleanupEcho
        ? "Alert reports merged dogfood stale runtime cleanup and GitHub state is already merged; no-action echo"
        : isPullRequest ? "GitHub issue API response includes pull_request" : "GitHub issue API response has no pull_request field",
    ...(postMergeDuplicate ? { postMergeDuplicate } : {}),
  };
}

function buildReport(options) {
  const alertText = readText(options.alertsInput);
  const refs = extractRefs(alertText, options.repo);
  const eventFixtures = readEvents(options.eventsInput);
  const prEvidence = readPrEvidence(options.prEvidenceInput);
  const rows = refs.map((ref) => {
    const issue = eventFixtures.get(String(ref.number)) ?? fetchIssue(ref);
    return classifyIssue(ref, issue, alertText, prEvidence.get(String(ref.number)));
  });

  const counts = rows.reduce((acc, row) => {
    acc[row.kind] = (acc[row.kind] ?? 0) + 1;
    acc[row.prHandling] = (acc[row.prHandling] ?? 0) + 1;
    const duplicateClass = row.postMergeDuplicate?.classification;
    if (duplicateClass) acc[duplicateClass] = (acc[duplicateClass] ?? 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    repository: options.repo,
    totalRefs: refs.length,
    counts,
    rows,
  };
}

function escapeMarkdown(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function renderMarkdown(result) {
  const lines = [
    "# Issue vs PR alert guard",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `Repository: \`${result.repository}\``,
    "",
    "Use `prHandling=skip` rows as a hard stop for PR-specific recovery. Use `postMergeDuplicate.classification=duplicate-post-merge` as read-only cut/close guidance, not merge recovery. The guard is read-only and classifies GitHub refs via the issues API `pull_request` field.",
    "",
    "## Summary",
    "",
    `- Refs inspected: ${result.totalRefs}`,
    `- Pull requests: ${result.counts.pull_request ?? 0}`,
    `- Issues: ${result.counts.issue ?? 0}`,
    `- PR handling allowed: ${result.counts.allow ?? 0}`,
    `- PR handling skipped: ${result.counts.skip ?? 0}`,
    `- PR handling cut/close candidates: ${result.counts.cut ?? 0}`,
    `- Verification-only echoes: ${result.counts.echo ?? 0}`,
    `- Duplicate post-merge close candidates: ${result.counts["duplicate-post-merge"] ?? 0}`,
    "",
    "## Rows",
    "",
  ];

  if (result.rows.length === 0) {
    lines.push("No matching refs found.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("| PR handling | Duplicate guard | Kind | Ref | State | Title | Reason |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const row of result.rows) {
    const ref = row.htmlUrl ? `[${row.repo}#${row.number}](${row.htmlUrl})` : `\`${row.repo}#${row.number}\``;
    const duplicateGuard = row.postMergeDuplicate ? `${row.postMergeDuplicate.classification}/${row.postMergeDuplicate.recommendation}` : "-";
    lines.push(`| ${row.prHandling} | ${escapeMarkdown(duplicateGuard)} | ${row.kind} | ${ref} | ${escapeMarkdown(row.state)} | ${escapeMarkdown(row.title || "-")} | ${escapeMarkdown(row.reason)} |`);
  }

  const duplicateRows = result.rows.filter((row) => row.postMergeDuplicate?.evidenceLines?.length > 0);
  if (duplicateRows.length > 0) {
    lines.push("", "## Operator duplicate PR cut evidence", "");
    lines.push("Read-only recommendation lines for operator review; the script does not mutate GitHub state.", "");
    for (const row of duplicateRows) {
      lines.push(`### ${escapeMarkdown(row.repo)}#${row.number}: ${escapeMarkdown(row.postMergeDuplicate.cutRecommendation)}`);
      lines.push(`- classification: ${escapeMarkdown(row.postMergeDuplicate.classification)}`);
      lines.push(`- recommendation: ${escapeMarkdown(row.postMergeDuplicate.recommendation)}`);
      for (const evidenceLine of row.postMergeDuplicate.evidenceLines) {
        lines.push(`- evidence: ${escapeMarkdown(evidenceLine)}`);
      }
      lines.push("");
    }
  }

  return `${lines.join("\n")}\n`;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const result = buildReport(options);
  const output = options.format === "json" ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result);
  if (options.output) fs.writeFileSync(path.resolve(repoRoot, options.output), output);
  else process.stdout.write(output);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
