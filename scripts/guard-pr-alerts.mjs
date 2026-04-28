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
    output: "",
    repo: "",
    format: "markdown",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--alerts") options.alertsInput = argv[++index];
    else if (arg === "--events") options.eventsInput = argv[++index];
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
  console.log(`Usage: node scripts/guard-pr-alerts.mjs --repo <owner/repo> --alerts <path|-> [options]\n\nRead-only guard for alert buffers that mention issue/PR numbers before any PR-specific\nrecovery handling. It resolves refs through GitHub's issues API shape: pull requests\ninclude a pull_request field, while ordinary issues do not.\n\nOptions:\n  --alerts <path|->   Read alert text from a file or stdin\n  --events <path>     Use saved GitHub issue API JSON instead of invoking gh api\n  --repo <owner/repo> Repository to resolve shorthand refs against\n  --json              Emit machine-readable JSON\n  --markdown          Emit markdown (default)\n  --output <path>     Write output to a file instead of stdout\n  -h, --help          Show this help\n\nOffline usage:\n  gh api repos/minislively/fooks/issues/226 > /tmp/fooks-226.json\n  printf 'clawhip/relay: fooks#226 closed/commented' > /tmp/alerts.txt\n  node scripts/guard-pr-alerts.mjs --repo minislively/fooks --alerts /tmp/alerts.txt --events /tmp/fooks-226.json --json\n\nLive usage (read-only):\n  node scripts/guard-pr-alerts.mjs --repo minislively/fooks --alerts /tmp/alerts.txt`);
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

function fetchIssue(ref) {
  const stdout = execFileSync("gh", ["api", `repos/${ref.owner}/${ref.repo}/issues/${ref.number}`], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(stdout);
}

function classifyIssue(ref, issue) {
  const isPullRequest = Boolean(issue?.pull_request);
  return {
    repo: `${ref.owner}/${ref.repo}`,
    number: ref.number,
    source: ref.source,
    title: issue?.title ?? "",
    state: issue?.state ?? "unknown",
    htmlUrl: issue?.html_url ?? `https://github.com/${ref.owner}/${ref.repo}/issues/${ref.number}`,
    kind: isPullRequest ? "pull_request" : "issue",
    prHandling: isPullRequest ? "allow" : "skip",
    reason: isPullRequest ? "GitHub issue API response includes pull_request" : "GitHub issue API response has no pull_request field",
  };
}

function buildReport(options) {
  const alertText = readText(options.alertsInput);
  const refs = extractRefs(alertText, options.repo);
  const eventFixtures = readEvents(options.eventsInput);
  const rows = refs.map((ref) => {
    const issue = eventFixtures.get(String(ref.number)) ?? fetchIssue(ref);
    return classifyIssue(ref, issue);
  });

  const counts = rows.reduce((acc, row) => {
    acc[row.kind] = (acc[row.kind] ?? 0) + 1;
    acc[row.prHandling] = (acc[row.prHandling] ?? 0) + 1;
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
    "Use `prHandling=skip` rows as a hard stop for PR-specific recovery. The guard is read-only and classifies GitHub refs via the issues API `pull_request` field.",
    "",
    "## Summary",
    "",
    `- Refs inspected: ${result.totalRefs}`,
    `- Pull requests: ${result.counts.pull_request ?? 0}`,
    `- Issues: ${result.counts.issue ?? 0}`,
    `- PR handling allowed: ${result.counts.allow ?? 0}`,
    `- PR handling skipped: ${result.counts.skip ?? 0}`,
    "",
    "## Rows",
    "",
  ];

  if (result.rows.length === 0) {
    lines.push("No matching refs found.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("| PR handling | Kind | Ref | State | Title | Reason |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const row of result.rows) {
    const ref = row.htmlUrl ? `[${row.repo}#${row.number}](${row.htmlUrl})` : `\`${row.repo}#${row.number}\``;
    lines.push(`| ${row.prHandling} | ${row.kind} | ${ref} | ${escapeMarkdown(row.state)} | ${escapeMarkdown(row.title || "-")} | ${escapeMarkdown(row.reason)} |`);
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
