import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReactWebOverCachingAuditEvidence,
  renderReactWebOverCachingAuditMarkdown,
} from "../scripts/react-web-over-caching-audit.mjs";

test("React Web over-caching audit produces a named no-repro verdict on current main", async () => {
  const evidence = await buildReactWebOverCachingAuditEvidence({ runId: "test" });

  assert.equal(evidence.schemaVersion, "react-web-over-caching-audit.v1");
  assert.equal(evidence.measurement, "codex-runtime-hook-small-edit-refresh-audit");
  assert.match(evidence.claimBoundary, /Diagnostic audit evidence only/);
  assert.match(evidence.claimBoundary, /not performance\/token\/billing proof/);

  assert.equal(evidence.checks.baselineRepeatedReactWebReuse.claimable, true);
  assert.equal(evidence.checks.baselineRepeatedReactWebReuse.firstAction, "record");
  assert.equal(evidence.checks.baselineRepeatedReactWebReuse.secondAction, "inject");

  assert.equal(evidence.checks.smallEditRefreshAudit.claimable, true);
  assert.equal(evidence.checks.smallEditRefreshAudit.verdict, "no-repro");
  assert.equal(evidence.checks.smallEditRefreshAudit.verdictName, "react-web-small-edit-refresh-no-repro");
  assert.equal(evidence.checks.smallEditRefreshAudit.suspiciousStepCount, 0);
  assert.equal(evidence.checks.smallEditRefreshAudit.steps.length, 3);

  for (const step of evidence.checks.smallEditRefreshAudit.steps) {
    assert.equal(step.action, "inject");
    assert.equal(step.refreshedBeforeAttach, true);
    assert.equal(step.fingerprintChanged, true);
    assert.equal(step.suspicious, false);
    assert.equal(step.suspicionReason, null);
    assert.ok(step.reasons.includes("refreshed-before-attach"));
  }

  assert.equal(evidence.summary.verdict, "no-repro");
  assert.equal(evidence.summary.verdictName, "react-web-small-edit-refresh-no-repro");
  assert.equal(evidence.summary.namedVerdictWithEvidence, true);
  assert.equal(evidence.summary.bugReproduced, false);
});

test("React Web over-caching audit markdown keeps the diagnostic verdict explicit", async () => {
  const evidence = await buildReactWebOverCachingAuditEvidence({ runId: "markdown-test" });
  const markdown = renderReactWebOverCachingAuditMarkdown(evidence);

  assert.match(markdown, /Verdict: no-repro/);
  assert.match(markdown, /Verdict name: react-web-small-edit-refresh-no-repro/);
  assert.match(markdown, /Named verdict with evidence: yes/);
  assert.match(markdown, /Bug reproduced: no/);
  assert.match(markdown, /small-edit-comment-a: action=inject; refreshed=true; fingerprintChanged=true; suspicious=false/);
  assert.match(markdown, /does not prove performance, runtime-token, billing, or broad-support claims/);
});
