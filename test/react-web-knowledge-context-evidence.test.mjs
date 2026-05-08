import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildReactWebKnowledgeContextEvidence,
  renderReactWebKnowledgeContextEvidenceMarkdown,
} from "../scripts/react-web-knowledge-context-evidence.mjs";

const repoRoot = process.cwd();

test("React Web knowledge-context evidence proves repeated-file injection and exclusion boundaries", async () => {
  const evidence = await buildReactWebKnowledgeContextEvidence({ runId: `unit-${Date.now()}-${Math.random()}` });

  assert.equal(evidence.schemaVersion, "react-web-knowledge-context-evidence.v1");
  assert.equal(evidence.measurement, "codex-runtime-hook-local-project-knowledge");
  assert.deepEqual(evidence.summary.matchedRules, ["claim-boundary.react-web-knowledge-boundary"]);
  assert.equal(evidence.summary.injectedOnRepeatedFile, true);
  assert.equal(evidence.summary.injectedOnFirstRun, false);
  assert.equal(evidence.summary.injectedOnNoTarget, false);
  assert.equal(evidence.summary.advisoryOnly, true);
  assert.equal(evidence.summary.genericRepeatedPromptInjectedKnowledge, false);
  assert.equal(evidence.summary.boundaryEvidenceOnlyClaimable, true);
  assert.deepEqual(evidence.summary.warnings, []);

  assert.equal(evidence.summary.contextReduction.claimable, false);
  assert.equal(evidence.summary.cachePerformance.claimable, false);
  assert.equal(evidence.summary.providerBillingSavings.claimable, false);

  assert.equal(evidence.checks.repeatedClaimBoundaryPrompt.firstAction, "record");
  assert.equal(evidence.checks.repeatedClaimBoundaryPrompt.secondAction, "inject");
  assert.equal(evidence.checks.repeatedClaimBoundaryPrompt.mode, "advisory");
  assert.ok(
    evidence.checks.repeatedClaimBoundaryPrompt.matchReasons.some((reason) => reason.startsWith("prompt-keyword:context reduction claim")),
  );
  assert.equal(evidence.checks.firstRunExclusion.projectKnowledgePresent, false);
  assert.equal(evidence.checks.noTargetExclusion.action, "noop");
  assert.equal(evidence.checks.noTargetExclusion.projectKnowledgePresent, false);
  assert.equal(evidence.checks.genericPromptNarrowness.projectKnowledgePresent, false);
});

test("React Web knowledge-context evidence markdown keeps the lane boundary-only", async () => {
  const evidence = await buildReactWebKnowledgeContextEvidence({ runId: `markdown-${Date.now()}-${Math.random()}` });
  const markdown = renderReactWebKnowledgeContextEvidenceMarkdown(evidence);

  assert.match(markdown, /React Web knowledge-context evidence/);
  assert.match(markdown, /Injected on repeated file: yes/);
  assert.match(markdown, /Injected on first run: no/);
  assert.match(markdown, /Injected on no-target prompt: no/);
  assert.match(markdown, /Generic repeated prompt injected knowledge: no/);
  assert.match(markdown, /Boundary evidence claimable: yes/);
  assert.match(markdown, /Context reduction claimable: no/);
  assert.match(markdown, /Cache performance claimable: no/);
  assert.match(markdown, /Provider billing savings claimable: no/);
  assert.match(markdown, /does not support actualInjectedContextReduction percentages/);
});

test("React Web knowledge-context evidence command writes bounded JSON report", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-knowledge-context-"));
  const outputPath = path.join(tempDir, "react-web-knowledge-context-evidence.json");

  const cli = spawnSync(
    process.execPath,
    [path.join(repoRoot, "scripts", "react-web-knowledge-context-evidence.mjs"), "--run-id=cli-test", `--output=${outputPath}`],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(fs.existsSync(outputPath), true);

  const stdoutEvidence = JSON.parse(cli.stdout);
  const fileEvidence = JSON.parse(fs.readFileSync(outputPath, "utf8"));

  assert.deepEqual(fileEvidence, stdoutEvidence);
  assert.equal(stdoutEvidence.runId, "cli-test");
  assert.deepEqual(stdoutEvidence.summary.matchedRules, ["claim-boundary.react-web-knowledge-boundary"]);
  assert.equal(stdoutEvidence.summary.injectedOnRepeatedFile, true);
  assert.equal(stdoutEvidence.summary.genericRepeatedPromptInjectedKnowledge, false);
});
