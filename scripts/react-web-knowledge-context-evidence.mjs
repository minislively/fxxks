import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");

const REACT_WEB_RULE_ID = "claim-boundary.react-web-knowledge-boundary";

function copyFixture(repoRoot, tempRoot, relativeFile) {
  const target = path.join(tempRoot, relativeFile);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, relativeFile), target);
}

function cleanupRuntimeState(projectRoot, prefix) {
  const runtimeRoot = path.join(projectRoot, ".fooks", "state", "codex-runtime");
  if (!fs.existsSync(runtimeRoot)) return;
  for (const entry of fs.readdirSync(runtimeRoot, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.startsWith(prefix)) {
      fs.rmSync(path.join(runtimeRoot, entry.name), { force: true });
    }
  }
}

function hasProjectKnowledgeBlock(text) {
  return typeof text === "string" && text.includes("PROJECT KNOWLEDGE CONTEXT");
}

function claimBoundaryWarnings(evidence) {
  const warnings = [];
  if (!evidence.summary.injectedOnRepeatedFile) warnings.push("repeated same-file React Web prompt did not inject tracked project knowledge");
  if (evidence.summary.injectedOnFirstRun) warnings.push("first-run React Web prompt unexpectedly injected project knowledge");
  if (evidence.summary.injectedOnNoTarget) warnings.push("no-target React Web prompt unexpectedly injected project knowledge");
  if (!evidence.summary.advisoryOnly) warnings.push("project knowledge was not proven advisory-only");
  if (evidence.summary.genericRepeatedPromptInjectedKnowledge) {
    warnings.push("generic repeated same-file React Web prompt injected claim-boundary project knowledge without explicit boundary wording");
  }
  return warnings;
}

async function loadRuntimeHook(repoRoot) {
  return import(path.join(repoRoot, "dist", "adapters", "codex-runtime-hook.js"));
}

export async function buildReactWebKnowledgeContextEvidence({
  repoRoot = defaultRepoRoot,
  runId = new Date().toISOString().replace(/[:.]/g, "-"),
} = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-knowledge-"));
  const repeatedSessionId = `react-web-knowledge-context-${runId}`;
  const genericSessionId = `react-web-knowledge-generic-${runId}`;
  const noTargetSessionId = `react-web-knowledge-no-target-${runId}`;
  const reactWebFile = "fixtures/compressed/HookEffectPanel.tsx";
  const rulesFile = "docs/project-knowledge/claim-boundary-rules.json";

  try {
    fs.writeFileSync(
      path.join(tempRoot, "package.json"),
      JSON.stringify({ name: "react-web-knowledge-context-evidence-temp", private: true }, null, 2),
    );
    copyFixture(repoRoot, tempRoot, reactWebFile);
    copyFixture(repoRoot, tempRoot, rulesFile);

    const { handleCodexRuntimeHook } = await loadRuntimeHook(repoRoot);

    handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: repeatedSessionId }, tempRoot);
    const firstClaimBoundaryPrompt = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId: repeatedSessionId,
        prompt: `Review ${reactWebFile} and keep the React Web context reduction claim narrow`,
      },
      tempRoot,
    );
    const repeatedClaimBoundaryPrompt = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId: repeatedSessionId,
        prompt: `Review ${reactWebFile} again and keep the React Web context reduction claim narrow`,
      },
      tempRoot,
    );

    handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: genericSessionId }, tempRoot);
    handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId: genericSessionId,
        prompt: `Review ${reactWebFile}`,
      },
      tempRoot,
    );
    const repeatedGenericPrompt = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId: genericSessionId,
        prompt: `Review ${reactWebFile} again`,
      },
      tempRoot,
    );

    handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: noTargetSessionId }, tempRoot);
    const noTargetPrompt = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId: noTargetSessionId,
        prompt: "Tighten the React Web context reduction claim wording without widening support claims",
      },
      tempRoot,
    );

    const matchedRules = repeatedClaimBoundaryPrompt.projectKnowledge?.appliedRuleIds ?? [];
    const evidence = {
      schemaVersion: "react-web-knowledge-context-evidence.v1",
      generatedAt: new Date().toISOString(),
      runId,
      measurement: "codex-runtime-hook-local-project-knowledge",
      claimBoundary:
        "Local runtime-hook/project-knowledge evidence only: proves React Web claim-boundary knowledge matching and advisory repeated same-file injection behavior; not actual context-reduction percentages, wall-clock performance, runtime-token savings, provider billing, or charged-cost evidence.",
      summary: {
        matchedRules,
        injectedOnRepeatedFile:
          repeatedClaimBoundaryPrompt.action === "inject" &&
          hasProjectKnowledgeBlock(repeatedClaimBoundaryPrompt.additionalContext) &&
          matchedRules.includes(REACT_WEB_RULE_ID),
        injectedOnFirstRun:
          hasProjectKnowledgeBlock(firstClaimBoundaryPrompt.additionalContext) || firstClaimBoundaryPrompt.projectKnowledge !== undefined,
        injectedOnNoTarget: hasProjectKnowledgeBlock(noTargetPrompt.additionalContext) || noTargetPrompt.projectKnowledge !== undefined,
        advisoryOnly:
          repeatedClaimBoundaryPrompt.projectKnowledge?.mode === "advisory" &&
          repeatedClaimBoundaryPrompt.projectKnowledge?.family === "claim-boundary" &&
          hasProjectKnowledgeBlock(repeatedClaimBoundaryPrompt.additionalContext) &&
          !/remembered|enforced|validated|guaranteed/i.test(repeatedClaimBoundaryPrompt.additionalContext),
        genericRepeatedPromptInjectedKnowledge:
          repeatedGenericPrompt.projectKnowledge !== undefined || hasProjectKnowledgeBlock(repeatedGenericPrompt.additionalContext),
        boundaryEvidenceOnlyClaimable: false,
        contextReduction: {
          claimable: false,
          blocker: "this artifact proves project-knowledge injection boundaries only; it does not measure actualInjectedContextReduction or any byte-reduction percentage",
        },
        cachePerformance: {
          claimable: false,
          blocker: "this artifact measures runtime-hook knowledge injection behavior, not wall-clock latency, cache hit rate, or end-to-end runtime performance",
        },
        providerBillingSavings: {
          claimable: false,
          blocker: "this artifact contains no provider usage, tokenizer, billing dashboard, invoice, or charged-cost data",
        },
        warnings: [],
      },
      checks: {
        repeatedClaimBoundaryPrompt: {
          firstAction: firstClaimBoundaryPrompt.action,
          secondAction: repeatedClaimBoundaryPrompt.action,
          secondReasons: repeatedClaimBoundaryPrompt.reasons,
          matchedRules,
          matchReasons: repeatedClaimBoundaryPrompt.projectKnowledge?.matchReasons ?? [],
          authority: repeatedClaimBoundaryPrompt.projectKnowledge?.authority ?? null,
          rulesPath: repeatedClaimBoundaryPrompt.projectKnowledge?.rulesPath ?? null,
          mode: repeatedClaimBoundaryPrompt.projectKnowledge?.mode ?? null,
        },
        firstRunExclusion: {
          action: firstClaimBoundaryPrompt.action,
          projectKnowledgePresent: firstClaimBoundaryPrompt.projectKnowledge !== undefined,
          hasProjectKnowledgeBlock: hasProjectKnowledgeBlock(firstClaimBoundaryPrompt.additionalContext),
        },
        noTargetExclusion: {
          action: noTargetPrompt.action,
          projectKnowledgePresent: noTargetPrompt.projectKnowledge !== undefined,
          hasProjectKnowledgeBlock: hasProjectKnowledgeBlock(noTargetPrompt.additionalContext),
        },
        genericPromptNarrowness: {
          action: repeatedGenericPrompt.action,
          projectKnowledgePresent: repeatedGenericPrompt.projectKnowledge !== undefined,
          hasProjectKnowledgeBlock: hasProjectKnowledgeBlock(repeatedGenericPrompt.additionalContext),
        },
      },
    };

    evidence.summary.warnings = claimBoundaryWarnings(evidence);
    evidence.summary.boundaryEvidenceOnlyClaimable = evidence.summary.warnings.length === 0;
    return evidence;
  } finally {
    cleanupRuntimeState(tempRoot, repeatedSessionId);
    cleanupRuntimeState(tempRoot, genericSessionId);
    cleanupRuntimeState(tempRoot, noTargetSessionId);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function renderReactWebKnowledgeContextEvidenceMarkdown(evidence) {
  return `# React Web knowledge-context evidence

${evidence.claimBoundary}

## Summary

- Matched rules: ${evidence.summary.matchedRules.join(", ") || "none"}
- Injected on repeated file: ${evidence.summary.injectedOnRepeatedFile ? "yes" : "no"}
- Injected on first run: ${evidence.summary.injectedOnFirstRun ? "yes" : "no"}
- Injected on no-target prompt: ${evidence.summary.injectedOnNoTarget ? "yes" : "no"}
- Advisory only: ${evidence.summary.advisoryOnly ? "yes" : "no"}
- Generic repeated prompt injected knowledge: ${evidence.summary.genericRepeatedPromptInjectedKnowledge ? "yes" : "no"}
- Boundary evidence claimable: ${evidence.summary.boundaryEvidenceOnlyClaimable ? "yes" : "no"}
- Context reduction claimable: no
- Cache performance claimable: no
- Provider billing savings claimable: no

## Decisions

- React Web claim-boundary repeated prompt: ${evidence.checks.repeatedClaimBoundaryPrompt.firstAction} -> ${evidence.checks.repeatedClaimBoundaryPrompt.secondAction}
- First-run exclusion: action=${evidence.checks.firstRunExclusion.action}; projectKnowledge=${evidence.checks.firstRunExclusion.projectKnowledgePresent ? "present" : "absent"}
- No-target exclusion: action=${evidence.checks.noTargetExclusion.action}; projectKnowledge=${evidence.checks.noTargetExclusion.projectKnowledgePresent ? "present" : "absent"}
- Generic repeated prompt narrowness: action=${evidence.checks.genericPromptNarrowness.action}; projectKnowledge=${evidence.checks.genericPromptNarrowness.projectKnowledgePresent ? "present" : "absent"}

## Claim boundary

This artifact supports bounded knowledge-injection wording for local Codex runtime-hook behavior only. It does not support actualInjectedContextReduction percentages, wall-clock performance, runtime-token, provider-cost, billing, invoice, or charged-cost claims.
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runId = process.argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ?? "local";
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const evidence = await buildReactWebKnowledgeContextEvidence({ repoRoot: defaultRepoRoot, runId });

  if (outputArg) {
    const outputPath = path.resolve(defaultRepoRoot, outputArg);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  if (markdownArg) {
    const markdownPath = path.resolve(defaultRepoRoot, markdownArg);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderReactWebKnowledgeContextEvidenceMarkdown(evidence));
  }

  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}
