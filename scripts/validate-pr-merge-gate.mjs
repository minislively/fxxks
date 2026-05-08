#!/usr/bin/env node
// @ts-check
/// <reference types="node" />

import fs from "node:fs";
import { pathToFileURL } from "node:url";

const CLOSING_ISSUE_PATTERN = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+(?:(?:[\w.-]+\/[\w.-]+)?#\d+|https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+)/i;
const DEFAULT_ALLOWED_REVIEWERS = ["minislively", "yeachan-heo"];

function normalizeLogin(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePath(value) {
  return String(value || "").replace(/^\/+/, "");
}

function parseAllowedReviewers(value) {
  if (!value) return new Set(DEFAULT_ALLOWED_REVIEWERS);
  return new Set(
    String(value)
      .split(",")
      .map((item) => normalizeLogin(item))
      .filter(Boolean),
  );
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

function collectCommentAuthors(comments = []) {
  return new Set(
    (comments || [])
      .map((comment) => normalizeLogin(comment?.user?.login))
      .filter(Boolean),
  );
}

export function pullRequestHasLinkedClosingIssue(pullRequest) {
  const title = pullRequest?.title || "";
  const body = pullRequest?.body || "";
  return CLOSING_ISSUE_PATTERN.test(`${title}\n${body}`);
}

export function evaluatePullRequestMergeGate({
  pullRequest,
  reviews = [],
  issueComments = [],
  reviewComments = [],
  changedFiles = [],
  requireLinkedIssue = true,
  requireApproval = true,
  allowedReviewerLogins = DEFAULT_ALLOWED_REVIEWERS,
}) {
  const blockers = [];
  const docsTestsOnlyChange = classifyDocsTestsOnlyChange(changedFiles);
  const linkedIssueRequired = requireLinkedIssue && !docsTestsOnlyChange.docsTestsOnly;

  if (linkedIssueRequired && !pullRequestHasLinkedClosingIssue(pullRequest)) {
    blockers.push("PR body or title must link a closing issue with Fixes/Closes/Resolves #123.");
  }

  const latestByUser = latestReviewStateByUser(reviews);
  const headSha = pullRequest?.head?.sha;
  const allowedReviewers = new Set((allowedReviewerLogins || []).map((login) => normalizeLogin(login)).filter(Boolean));
  const qualifyingReviewers = [...latestByUser.entries()]
    .filter(([login, latest]) => {
      if (!allowedReviewers.has(login)) return false;
      if (!latest?.state || latest.state === "DISMISSED") return false;
      return !headSha || latest.commitId === headSha;
    })
    .map(([login]) => login)
    .sort();
  const qualifyingIssueCommenters = [...collectCommentAuthors(issueComments)]
    .filter((login) => allowedReviewers.has(login))
    .sort();
  const qualifyingReviewCommenters = [...collectCommentAuthors(reviewComments)]
    .filter((login) => allowedReviewers.has(login))
    .sort();
  const qualifyingParticipants = [...new Set([
    ...qualifyingReviewers,
    ...qualifyingIssueCommenters,
    ...qualifyingReviewCommenters,
  ])].sort();

  if (requireApproval && qualifyingParticipants.length === 0) {
    blockers.push(
      `PR must have at least one GitHub PR review, review comment, or PR/issue comment from an allowed reviewer (${[...allowedReviewers].join(", ")}). Self-review and self-comment by those accounts are allowed. Official PR reviews must be on the current head commit, and any new push/amend/rebase/force-push after review requires re-review unless a qualifying comment remains present.`,
    );
  }

  return {
    ok: blockers.length === 0,
    blockers,
    approvingReviewers: qualifyingReviewers,
    qualifyingParticipants,
    docsTestsOnly: docsTestsOnlyChange.docsTestsOnly,
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

async function fetchAllPages({ repository, pullNumber, token, resourcePath, errorLabel }) {
  const items = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/repos/${repository}/${resourcePath}/${pullNumber}/comments?per_page=100&page=${page}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "fooks-merge-gate",
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${errorLabel}: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    items.push(...payload);
    if (payload.length < 100) break;
    page += 1;
  }

  return items;
}

async function fetchPullRequestFiles({ repository, pullNumber, token }) {
  const files = [];
  let page = 1;

  while (true) {
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

    const payload = await response.json();
    files.push(...payload.map((item) => item?.filename).filter(Boolean));
    if (payload.length < 100) break;
    page += 1;
  }

  return files;
}

async function fetchPullRequestIssueComments({ repository, pullNumber, token }) {
  return fetchAllPages({
    repository,
    pullNumber,
    token,
    resourcePath: "issues",
    errorLabel: "PR issue comments",
  });
}

async function fetchPullRequestReviewComments({ repository, pullNumber, token }) {
  return fetchAllPages({
    repository,
    pullNumber,
    token,
    resourcePath: "pulls",
    errorLabel: "PR review comments",
  });
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

  const requireApproval = process.env.MERGE_GATE_REQUIRE_APPROVAL !== "false";
  const changedFiles = await fetchPullRequestFiles({
    repository,
    pullNumber: pullRequest.number,
    token,
  });
  const reviews = requireApproval
    ? await fetchPullRequestReviews({
      repository,
      pullNumber: pullRequest.number,
      token,
    })
    : [];
  const issueComments = requireApproval
    ? await fetchPullRequestIssueComments({
      repository,
      pullNumber: pullRequest.number,
      token,
    })
    : [];
  const reviewComments = requireApproval
    ? await fetchPullRequestReviewComments({
      repository,
      pullNumber: pullRequest.number,
      token,
    })
    : [];

  const result = evaluatePullRequestMergeGate({
    pullRequest,
    reviews,
    issueComments,
    reviewComments,
    changedFiles,
    requireLinkedIssue: process.env.MERGE_GATE_REQUIRE_LINKED_ISSUE !== "false",
    requireApproval,
    allowedReviewerLogins: [...parseAllowedReviewers(process.env.MERGE_GATE_ALLOWED_REVIEWERS)],
  });

  if (!result.ok) {
    console.error("Merge gate blockers:");
    for (const blocker of result.blockers) console.error(`- ${blocker}`);
    process.exitCode = 1;
    return;
  }

  const docsTestsOnlySummary = result.docsTestsOnly
    ? " Docs/test-only change detected; linked issue requirement skipped."
    : "";
  const approvalSummary = result.qualifyingParticipants.length > 0
    ? ` Qualifying participant(s): ${result.qualifyingParticipants.join(", ")}`
    : "";
  const linkedIssueSummary = result.docsTestsOnly
    ? ""
    : " Linked issue detected.";
  console.log(`Merge gate passed.${linkedIssueSummary}${docsTestsOnlySummary}${approvalSummary}`);
}

function isMainModule() {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint) && import.meta.url === pathToFileURL(entrypoint).href;
}

if (isMainModule()) {
  await main();
}
