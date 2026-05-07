#!/usr/bin/env node
// @ts-check
/// <reference types="node" />

import fs from "node:fs";
import { pathToFileURL } from "node:url";

const CLOSING_ISSUE_PATTERN = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+(?:(?:[\w.-]+\/[\w.-]+)?#\d+|https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+)/i;

function normalizePath(value) {
  return String(value || "").replace(/^\/+/, "");
}

const DOCS_TESTS_ONLY_ALLOWED_PREFIXES = ["docs/", "test/"];
const DOCS_TESTS_ONLY_ALLOWED_FILES = ["README.md"];
const DOCS_TESTS_ONLY_FORBIDDEN_PATHS = new Set([
  "test/fixtures/frontend-domain-expectations/manifest.json",
]);

export function classifyDocsTestsOnlyChange(changedFiles = []) {
  const files = (changedFiles || []).map(normalizePath).filter(Boolean);
  const disallowedFiles = files.filter((file) => {
    if (DOCS_TESTS_ONLY_FORBIDDEN_PATHS.has(file)) return true;
    if (DOCS_TESTS_ONLY_ALLOWED_FILES.includes(file)) return false;
    return !DOCS_TESTS_ONLY_ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix));
  });

  return {
    docsTestsOnly: files.length > 0 && disallowedFiles.length === 0,
    changedFiles: files,
    disallowedFiles,
  };
}

export function pullRequestHasLinkedClosingIssue(pullRequest) {
  const title = pullRequest?.title || "";
  const body = pullRequest?.body || "";
  return CLOSING_ISSUE_PATTERN.test(`${title}\n${body}`);
}

export function evaluatePullRequestMergeGate({
  pullRequest,
  requireLinkedIssue = true,
}) {
  const blockers = [];

  if (requireLinkedIssue && !pullRequestHasLinkedClosingIssue(pullRequest)) {
    blockers.push("PR body or title must link a closing issue with Fixes/Closes/Resolves #123.");
  }

  return {
    ok: blockers.length === 0,
    blockers,
  };
}

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return;

  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  const pullRequest = event.pull_request;
  if (!pullRequest) {
    console.log("No pull_request payload found; skipping merge gate.");
    return;
  }

  const result = evaluatePullRequestMergeGate({
    pullRequest,
    requireLinkedIssue: process.env.MERGE_GATE_REQUIRE_LINKED_ISSUE !== "false",
  });

  if (!result.ok) {
    console.warn("Merge gate advisories:");
    for (const blocker of result.blockers) console.warn(`- ${blocker}`);
    return;
  }

  console.log("Merge gate passed. Linked issue detected.");
}

function isMainModule() {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint) && import.meta.url === pathToFileURL(entrypoint).href;
}

if (isMainModule()) {
  await main();
}
