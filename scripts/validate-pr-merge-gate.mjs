#!/usr/bin/env node
// @ts-check
/// <reference types="node" />

import fs from "node:fs";
import { pathToFileURL } from "node:url";

const CLOSING_ISSUE_PATTERN = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+(?:(?:[\w.-]+\/[\w.-]+)?#\d+|https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+)/i;

function normalizeLogin(value) {
  return String(value || "").trim().toLowerCase();
}

function parseAllowedMaintainers(value) {
  return String(value || "")
    .split(",")
    .map(normalizeLogin)
    .filter(Boolean);
}

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

function latestReviewStateByUser(reviews) {
  const latest = new Map();
  for (const review of reviews || []) {
    const login = normalizeLogin(review?.user?.login);
    if (!login) continue;
    const submittedAt = Date.parse(review.submitted_at || review.submittedAt || "") || 0;
    const previous = latest.get(login);
    if (!previous || submittedAt >= previous.submittedAt) {
      latest.set(login, {
        state: String(review.state || "").toUpperCase(),
        submittedAt,
        commitId: review.commit_id || review.commitId,
      });
    }
  }
  return latest;
}

export function pullRequestHasLinkedClosingIssue(pullRequest) {
  const title = pullRequest?.title || "";
  const body = pullRequest?.body || "";
  return CLOSING_ISSUE_PATTERN.test(`${title}\n${body}`);
}

export function evaluatePullRequestMergeGate({
  pullRequest,
  reviews = [],
  changedFiles = [],
  allowedMaintainers,
  requireLinkedIssue = true,
  approvalMode = "strict",
}) {
  const allowed = new Set((allowedMaintainers || []).map(normalizeLogin).filter(Boolean));
  const blockers = [];
  const author = normalizeLogin(pullRequest?.user?.login);
  const pathClassification = classifyDocsTestsOnlyChange(changedFiles);
  const allowDocsTestsSelfApproval =
    approvalMode === "docs-tests-self-ok" &&
    pathClassification.docsTestsOnly &&
    author &&
    allowed.has(author);

  if (allowed.size === 0) {
    blockers.push("Configure MERGE_GATE_ALLOWED_MAINTAINERS with at least one GitHub login.");
  }

  if (requireLinkedIssue && !pullRequestHasLinkedClosingIssue(pullRequest)) {
    blockers.push("PR body or title must link a closing issue with Fixes/Closes/Resolves #123.");
  }

  const latestByUser = latestReviewStateByUser(reviews);
  const headSha = pullRequest?.head?.sha;
  const approvingMaintainers = [...allowed].filter((login) => {
    const latest = latestByUser.get(login);
    return latest?.state === "APPROVED" && (!headSha || latest.commitId === headSha);
  });
  if (approvingMaintainers.length === 0 && !allowDocsTestsSelfApproval) {
    blockers.push(`PR must have an active approval on the current head commit from one of: ${[...allowed].join(", ") || "<none>"}.`);
  }

  return {
    ok: blockers.length === 0,
    blockers,
    approvingMaintainers,
    approvalBypassReason: allowDocsTestsSelfApproval ? "docs-tests-only-self-maintainer" : undefined,
    pathClassification,
  };
}

async function fetchPullRequestReviews({ repository, pullNumber, token }) {
  const url = `https://api.github.com/repos/${repository}/pulls/${pullNumber}/reviews?per_page=100`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "fooks-merge-gate",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch PR reviews: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchPullRequestChangedFiles({ repository, pullNumber, token }) {
  const files = [];
  for (let page = 1; ; page += 1) {
    const url = `https://api.github.com/repos/${repository}/pulls/${pullNumber}/files?per_page=100&page=${page}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "fooks-merge-gate",
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch PR files: ${response.status} ${response.statusText}`);
    }
    const pageFiles = await response.json();
    files.push(...pageFiles.map((file) => file.filename).filter(Boolean));
    if (pageFiles.length < 100) break;
  }
  return files;
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

  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!repository || !token) {
    throw new Error("GITHUB_REPOSITORY and GITHUB_TOKEN are required in GitHub Actions.");
  }

  const reviews = await fetchPullRequestReviews({
    repository,
    pullNumber: pullRequest.number,
    token,
  });
  const changedFiles = await fetchPullRequestChangedFiles({
    repository,
    pullNumber: pullRequest.number,
    token,
  });

  const result = evaluatePullRequestMergeGate({
    pullRequest,
    reviews,
    changedFiles,
    allowedMaintainers: parseAllowedMaintainers(process.env.MERGE_GATE_ALLOWED_MAINTAINERS),
    requireLinkedIssue: process.env.MERGE_GATE_REQUIRE_LINKED_ISSUE !== "false",
    approvalMode: process.env.MERGE_GATE_APPROVAL_MODE || "strict",
  });

  if (!result.ok) {
    console.error("Merge gate failed:");
    for (const blocker of result.blockers) console.error(`- ${blocker}`);
    process.exitCode = 1;
    return;
  }

  const approvalSummary = result.approvingMaintainers.length > 0
    ? `Approving maintainer(s): ${result.approvingMaintainers.join(", ")}`
    : `Approval bypass: ${result.approvalBypassReason}`;
  console.log(`Merge gate passed. ${approvalSummary}`);
}

function isMainModule() {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint) && import.meta.url === pathToFileURL(entrypoint).href;
}

if (isMainModule()) {
  await main();
}
