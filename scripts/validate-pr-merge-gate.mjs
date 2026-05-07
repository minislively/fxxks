#!/usr/bin/env node
// @ts-check
/// <reference types="node" />

import fs from "node:fs";
import { pathToFileURL } from "node:url";

const CLOSING_ISSUE_PATTERN = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+(?:(?:[\w.-]+\/[\w.-]+)?#\d+|https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+)/i;

function normalizeLogin(value) {
  return String(value || "").trim().toLowerCase();
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
  requireLinkedIssue = true,
  requireApproval = false,
}) {
  const blockers = [];

  if (requireLinkedIssue && !pullRequestHasLinkedClosingIssue(pullRequest)) {
    blockers.push("PR body or title must link a closing issue with Fixes/Closes/Resolves #123.");
  }

  const latestByUser = latestReviewStateByUser(reviews);
  const headSha = pullRequest?.head?.sha;
  const author = normalizeLogin(pullRequest?.user?.login);
  const approvingReviewers = [...latestByUser.entries()]
    .filter(([login, latest]) => login !== author && latest?.state === "APPROVED" && (!headSha || latest.commitId === headSha))
    .map(([login]) => login)
    .sort();

  if (requireApproval && approvingReviewers.length === 0) {
    blockers.push(
      "PR must have an active GitHub PR review approval on the current head commit from a reviewer other than the PR author. Issue comments and regular PR comments do not count, and any new push/amend/rebase/force-push after approval requires re-approval.",
    );
  }

  return {
    ok: blockers.length === 0,
    blockers,
    approvingReviewers,
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

  const requireApproval = process.env.MERGE_GATE_REQUIRE_APPROVAL === "true";
  const reviews = requireApproval
    ? await fetchPullRequestReviews({
      repository,
      pullNumber: pullRequest.number,
      token,
    })
    : [];

  const result = evaluatePullRequestMergeGate({
    pullRequest,
    reviews,
    requireLinkedIssue: process.env.MERGE_GATE_REQUIRE_LINKED_ISSUE !== "false",
    requireApproval,
  });

  if (!result.ok) {
    console.error("Merge gate blockers:");
    for (const blocker of result.blockers) console.error(`- ${blocker}`);
    process.exitCode = 1;
    return;
  }

  const approvalSummary = result.approvingReviewers.length > 0
    ? ` Approving reviewer(s): ${result.approvingReviewers.join(", ")}`
    : "";
  console.log(`Merge gate passed. Linked issue detected.${approvalSummary}`);
}

function isMainModule() {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint) && import.meta.url === pathToFileURL(entrypoint).href;
}

if (isMainModule()) {
  await main();
}
