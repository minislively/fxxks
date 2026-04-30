export function assertNoForbiddenPublicClaims(label, text) {
  const forbidden = [
    /provider usage\/billing-token reduction/i,
    /billing-token savings/i,
    /provider cost savings/i,
    /Claude Read interception is enabled/i,
    /Claude runtime-token savings are enabled/i,
    /automatic Claude runtime-token savings/i,
  ];
  const negatedClaimBoundary = /(?:not|no|without|nor|never|does not prove|do not claim|must not claim|cannot support|blocks?|excluded?|out of scope|is not|stayed false|claimability flags stayed false)[^\n]{0,160}$/i;
  const domainParallelLaunchReadiness = /\b(?:domain[-\s]parallel|parallel domain|domain lanes?|frontend domain lanes?)\b[^\n]{0,120}\b(?:worktree|team|multi-agent|launch|PR wave|wave)\b[^\n]{0,100}\b(?:ready|readiness|authorized|permitted|allowed|enabled|safe|available|may proceed|can proceed|may launch|can launch)\b|\b(?:worktree|team|multi-agent|launch|PR wave|wave)\b[^\n]{0,120}\b(?:ready|readiness|authorized|permitted|allowed|enabled|safe|available|may proceed|can proceed|may launch|can launch)\b[^\n]{0,100}\b(?:domain[-\s]parallel|parallel domain|domain lanes?|frontend domain lanes?)\b/i;
  const launchContractEvidence = /\b(?:named launch contract|launch contract)\b[^\n]{0,220}\b(?:Launch base|Lane table|Branch\/worktree name|Allowed write set|Forbidden write set|Shared-seam owner|PR order|Verification matrix|Stop rules|No-launch marker|planning-only|verifier-only|single-shared-owner|disjoint-domain-writers|required fields|lists the required fields)\b|\b(?:Launch base|Lane table|Branch\/worktree name|Allowed write set|Forbidden write set|Shared-seam owner|PR order|Verification matrix|Stop rules|No-launch marker|planning-only|verifier-only|single-shared-owner|disjoint-domain-writers|required fields|lists the required fields)\b[^\n]{0,220}\b(?:named launch contract|launch contract)\b/i;
  const domainParallelLaunchBoundary = /\b(?:does not authorize runtime source changes|docs\/tests-only by default|worktree launch needs a separate plan|separate approved launch plan|no domain implementation worktree is authorized|planning-only|must serialize|shared seams? must serialize)\b/i;

  let previousLine = "";
  for (const line of text.split(/\r?\n/)) {
    for (const pattern of forbidden) {
      const match = pattern.exec(line);
      if (match) {
        const beforeMatch = `${previousLine.trim()} ${line.slice(0, match.index)}`;
        assertClaimBoundary(negatedClaimBoundary.test(beforeMatch), `${label} contains forbidden positive claim ${pattern}: ${line}`);
      }
    }
    if (/ccusage replacement/i.test(line)) {
      assertClaimBoundary(/not (?:a )?ccusage replacement|not provider usage\/billing tokens[^.]*ccusage replacement/i.test(line), `${label} contains unbounded ccusage replacement wording: ${line}`);
    }
    if (/\.omx\//i.test(line) || /\.omx\/state/i.test(line)) {
      assertClaimBoundary(/internal|harness|planning/i.test(line), `${label} exposes .omx as product state: ${line}`);
    }
    if (domainParallelLaunchReadiness.test(line)) {
      assertClaimBoundary(
        launchContractEvidence.test(line) || domainParallelLaunchBoundary.test(line),
        `${label} contains domain-parallel launch readiness claim without launch-contract evidence: ${line}`,
      );
    }
    previousLine = line;
  }
}

const PR_BODY_CLOSING_KEYWORD_PATTERN = /\b(?:close[sd]?|fix(?:e[sd]|ed)?|resolve[sd]?)\s*:?\s+(?:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)?#\d+\b/i;
const STANDALONE_REFS_ISSUE_PATTERN = /^\s*(?:[-*]\s*)?(?:refs?|references?)\s*:?\s+(?:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)?#\d+(?:\s*,\s*(?:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)?#\d+)*\s*[.!]?\s*$/i;

export function assertPullRequestBodyUsesClosingIssueRefs(label, text) {
  for (const line of text.split(/\r?\n/)) {
    if (PR_BODY_CLOSING_KEYWORD_PATTERN.test(line)) continue;
    if (STANDALONE_REFS_ISSUE_PATTERN.test(line)) {
      assertClaimBoundary(
        false,
        `${label} uses a non-closing issue reference in a PR body: ${line.trim()}. Use Closes #N, Fixes #N, or Resolves #N when the PR should close the issue.`,
      );
    }
  }
}

export function assertPublicSurfaceClaimBoundaries(surfaces) {
  for (const [label, text] of Object.entries(surfaces)) {
    assertNoForbiddenPublicClaims(label, text);
  }
}

function assertClaimBoundary(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
