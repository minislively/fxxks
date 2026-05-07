import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");

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

function payloadFingerprint(decision) {
  return decision.debug?.decision?.payload?.sourceFingerprint ?? null;
}

async function loadRuntimeHook(repoRoot) {
  return import(path.join(repoRoot, "dist", "adapters", "codex-runtime-hook.js"));
}

function runPrompt(handleCodexRuntimeHook, tempRoot, sessionId, prompt) {
  return handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt,
    },
    tempRoot,
  );
}

function auditStep(label, decision, previousFingerprint) {
  const currentFingerprint = payloadFingerprint(decision);
  const refreshedBeforeAttach = decision.reasons.includes("refreshed-before-attach");
  const fingerprintChanged = Boolean(
    previousFingerprint &&
      currentFingerprint &&
      (previousFingerprint.fileHash !== currentFingerprint.fileHash || previousFingerprint.lineCount !== currentFingerprint.lineCount),
  );
  const suspicious = decision.action !== "inject" || !refreshedBeforeAttach || !fingerprintChanged;

  return {
    label,
    promptShape: "same-file-react-web-after-small-edit",
    action: decision.action,
    reasons: decision.reasons,
    contextModeReason: decision.contextModeReason,
    refreshedBeforeAttach,
    fingerprintChanged,
    previousFingerprint,
    currentFingerprint,
    suspicious,
    suspicionReason:
      decision.action !== "inject"
        ? "expected-inject-missing"
        : !refreshedBeforeAttach
          ? "missing-refreshed-before-attach"
          : !fingerprintChanged
            ? "fingerprint-did-not-change-after-edit"
            : null,
  };
}

export async function buildReactWebOverCachingAuditEvidence({
  repoRoot = defaultRepoRoot,
  runId = new Date().toISOString().replace(/[:.]/g, "-"),
} = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-over-cache-audit-"));
  const sessionId = `react-web-over-caching-audit-${runId}`;
  const reactWebFile = "fixtures/compressed/HookEffectPanel.tsx";

  try {
    fs.writeFileSync(
      path.join(tempRoot, "package.json"),
      JSON.stringify({ name: "react-web-over-caching-audit-temp", private: true }, null, 2),
    );
    copyFixture(repoRoot, tempRoot, reactWebFile);

    const { handleCodexRuntimeHook } = await loadRuntimeHook(repoRoot);
    handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempRoot);

    const first = runPrompt(
      handleCodexRuntimeHook,
      tempRoot,
      sessionId,
      `Please inspect ${reactWebFile}`,
    );
    const second = runPrompt(
      handleCodexRuntimeHook,
      tempRoot,
      sessionId,
      `Please inspect ${reactWebFile} again and keep the same-file context compact if safe`,
    );

    let previousFingerprint = payloadFingerprint(second);
    const mutations = [
      "small-edit-comment-a",
      "small-edit-comment-b",
      "small-edit-comment-c",
    ];
    const steps = [];

    for (const label of mutations) {
      fs.appendFileSync(path.join(tempRoot, reactWebFile), `\n// react web over-caching audit: ${label}\n`);
      const decision = runPrompt(
        handleCodexRuntimeHook,
        tempRoot,
        sessionId,
        `Please inspect ${reactWebFile} again after a tiny iterative edit (${label})`,
      );
      const step = auditStep(label, decision, previousFingerprint);
      steps.push(step);
      previousFingerprint = step.currentFingerprint;
    }

    const suspiciousSteps = steps.filter((step) => step.suspicious);
    const reproduced = suspiciousSteps.length > 0;
    const verdictName = reproduced
      ? "stale-react-web-payload-after-small-edit"
      : "react-web-small-edit-refresh-no-repro";

    return {
      schemaVersion: "react-web-over-caching-audit.v1",
      generatedAt: new Date().toISOString(),
      runId,
      measurement: "codex-runtime-hook-small-edit-refresh-audit",
      claimBoundary:
        "Diagnostic audit evidence only: proves whether repeated same-file React Web inspection refreshes after tiny source edits on current main; not runtime hardening, not performance/token/billing proof, and not broader React support evidence.",
      checks: {
        baselineRepeatedReactWebReuse: {
          claimable: first.action === "record" && second.action === "inject",
          firstAction: first.action,
          secondAction: second.action,
          secondReasons: second.reasons,
          contextModeReason: second.contextModeReason,
          fingerprint: payloadFingerprint(second),
        },
        smallEditRefreshAudit: {
          claimable: !reproduced,
          verdict: reproduced ? "reproduced" : "no-repro",
          verdictName,
          suspiciousStepCount: suspiciousSteps.length,
          steps,
        },
      },
      summary: {
        verdict: reproduced ? "reproduced" : "no-repro",
        verdictName,
        namedVerdictWithEvidence: first.action === "record" && second.action === "inject",
        bugReproduced: reproduced,
      },
    };
  } finally {
    cleanupRuntimeState(tempRoot, sessionId);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function renderReactWebOverCachingAuditMarkdown(evidence) {
  const steps = evidence.checks.smallEditRefreshAudit.steps
    .map(
      (step) =>
        `- ${step.label}: action=${step.action}; refreshed=${step.refreshedBeforeAttach}; fingerprintChanged=${step.fingerprintChanged}; suspicious=${step.suspicious}${step.suspicionReason ? `; suspicion=${step.suspicionReason}` : ""}`,
    )
    .join("\n");

  return `# React Web over-caching audit\n\n${evidence.claimBoundary}\n\n## Verdict\n\n- Verdict: ${evidence.summary.verdict}\n- Verdict name: ${evidence.summary.verdictName}\n- Named verdict with evidence: ${evidence.summary.namedVerdictWithEvidence ? "yes" : "no"}\n- Bug reproduced: ${evidence.summary.bugReproduced ? "yes" : "no"}\n\n## Baseline repeated-file reuse\n\n- First/second: ${evidence.checks.baselineRepeatedReactWebReuse.firstAction} -> ${evidence.checks.baselineRepeatedReactWebReuse.secondAction}\n- Second reasons: ${evidence.checks.baselineRepeatedReactWebReuse.secondReasons.join(", ")}\n\n## Small-edit audit steps\n\n${steps}\n\n## Claim boundary\n\nThis audit is diagnostic only. It does not change runtime behavior and does not prove performance, runtime-token, billing, or broad-support claims.\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runId = process.argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ?? "local";
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const evidence = await buildReactWebOverCachingAuditEvidence({ repoRoot: defaultRepoRoot, runId });

  if (outputArg) {
    const outputPath = path.resolve(defaultRepoRoot, outputArg);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  if (markdownArg) {
    const markdownPath = path.resolve(defaultRepoRoot, markdownArg);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderReactWebOverCachingAuditMarkdown(evidence));
  }

  if (!outputArg && !markdownArg) {
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  }
}
