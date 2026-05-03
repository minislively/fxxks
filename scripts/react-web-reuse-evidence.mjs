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

export async function buildReactWebReuseEvidence({
  repoRoot = defaultRepoRoot,
  runId = new Date().toISOString().replace(/[:.]/g, "-"),
} = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-reuse-"));
  const sessionId = `react-web-reuse-evidence-${runId}`;
  const reactWebFile = "fixtures/compressed/HookEffectPanel.tsx";
  const webviewFile = "test/fixtures/frontend-domain-expectations/webview-boundary-basic.tsx";
  const rnFile = "test/fixtures/frontend-domain-expectations/rn-style-platform-navigation.tsx";

  try {
    fs.writeFileSync(
      path.join(tempRoot, "package.json"),
      JSON.stringify({ name: "react-web-reuse-evidence-temp", private: true }, null, 2),
    );
    copyFixture(repoRoot, tempRoot, reactWebFile);
    copyFixture(repoRoot, tempRoot, webviewFile);
    copyFixture(repoRoot, tempRoot, rnFile);

    const { handleCodexRuntimeHook } = await loadRuntimeHook(repoRoot);
    handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempRoot);

    const firstReactWeb = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: `Please inspect ${reactWebFile}`,
      },
      tempRoot,
    );
    const secondReactWeb = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: `Please inspect ${reactWebFile} again and keep same-file context compact if safe`,
      },
      tempRoot,
    );
    const beforeMutationFingerprint = payloadFingerprint(secondReactWeb);

    fs.appendFileSync(path.join(tempRoot, reactWebFile), "\n// fooks reuse evidence mutation\n");

    const afterMutationReactWeb = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: `Please inspect ${reactWebFile} again after the source changed`,
      },
      tempRoot,
    );
    const afterMutationFingerprint = payloadFingerprint(afterMutationReactWeb);

    const firstWebview = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: `Please inspect ${webviewFile}`,
      },
      tempRoot,
    );
    const secondWebview = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: `Please inspect ${webviewFile} again`,
      },
      tempRoot,
    );

    const firstReactNative = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: `Please inspect ${rnFile}`,
      },
      tempRoot,
    );
    const secondReactNative = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: `Please inspect ${rnFile} again`,
      },
      tempRoot,
    );

    const evidence = {
      schemaVersion: "react-web-reuse-evidence.v1",
      generatedAt: new Date().toISOString(),
      runId,
      measurement: "codex-runtime-hook-local-reuse-decisions",
      claimBoundary:
        "Local runtime-hook decision evidence only: proves same-file React Web reuse routing, source-change refresh detection, and unsupported-domain fallback boundaries; not wall-clock cache performance, runtime-token savings, provider tokenizer behavior, provider cost, billing, invoice, or charged-cost evidence.",
      checks: {
        sameFileReactWebReuse: {
          claimable: firstReactWeb.action === "record" && secondReactWeb.action === "inject",
          firstAction: firstReactWeb.action,
          secondAction: secondReactWeb.action,
          secondReasons: secondReactWeb.reasons,
          contextModeReason: secondReactWeb.contextModeReason,
          domain: secondReactWeb.debug?.decision?.payload?.domainPayload?.domain ?? null,
          claimBoundary: secondReactWeb.debug?.decision?.payload?.domainPayload?.claimBoundary ?? null,
        },
        sourceChangeRefresh: {
          claimable:
            afterMutationReactWeb.action === "inject" &&
            afterMutationReactWeb.reasons.includes("refreshed-before-attach") &&
            beforeMutationFingerprint?.fileHash !== afterMutationFingerprint?.fileHash &&
            beforeMutationFingerprint?.lineCount !== afterMutationFingerprint?.lineCount,
          action: afterMutationReactWeb.action,
          reasons: afterMutationReactWeb.reasons,
          beforeFingerprint: beforeMutationFingerprint,
          afterFingerprint: afterMutationFingerprint,
          stalePayloadReused: beforeMutationFingerprint?.fileHash === afterMutationFingerprint?.fileHash,
        },
        unsupportedDomainFallbacks: {
          claimable: secondWebview.action === "fallback" && secondReactNative.action === "fallback",
          webview: {
            firstAction: firstWebview.action,
            secondAction: secondWebview.action,
            fallbackReason: secondWebview.fallback?.reason ?? null,
            classification: secondWebview.debug?.decision?.debug?.domainDetection?.classification ?? null,
            payloadInjected: "payload" in (secondWebview.debug?.decision ?? {}),
          },
          reactNative: {
            firstAction: firstReactNative.action,
            secondAction: secondReactNative.action,
            fallbackReason: secondReactNative.fallback?.reason ?? null,
            classification: secondReactNative.debug?.decision?.debug?.domainDetection?.classification ?? null,
            payloadInjected: "payload" in (secondReactNative.debug?.decision ?? {}),
          },
        },
      },
      summary: {
        reuseCorrectnessClaimable: false,
        cachePerformanceImprovement: {
          claimable: false,
          blocker: "this artifact measures hook routing decisions, not wall-clock latency, cache hit rate, or end-to-end runtime performance",
        },
        providerBillingSavings: {
          claimable: false,
          blocker: "this artifact contains no provider usage, tokenizer, billing dashboard, invoice, or charged-cost data",
        },
      },
    };

    evidence.summary.reuseCorrectnessClaimable =
      evidence.checks.sameFileReactWebReuse.claimable &&
      evidence.checks.sourceChangeRefresh.claimable &&
      evidence.checks.unsupportedDomainFallbacks.claimable;

    return evidence;
  } finally {
    cleanupRuntimeState(tempRoot, sessionId);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function renderReactWebReuseEvidenceMarkdown(evidence) {
  return `# React Web reuse evidence

${evidence.claimBoundary}

## Summary

- Same-file React Web reuse routing claimable: ${evidence.checks.sameFileReactWebReuse.claimable ? "yes" : "no"}
- Source-change refresh detection claimable: ${evidence.checks.sourceChangeRefresh.claimable ? "yes" : "no"}
- Unsupported-domain fallback boundaries claimable: ${evidence.checks.unsupportedDomainFallbacks.claimable ? "yes" : "no"}
- Overall reuse correctness claimable: ${evidence.summary.reuseCorrectnessClaimable ? "yes" : "no"}
- Cache performance improvement claimable: no
- Provider billing savings claimable: no

## Decisions

- React Web first/second: ${evidence.checks.sameFileReactWebReuse.firstAction} -> ${evidence.checks.sameFileReactWebReuse.secondAction}
- React Web after source mutation: ${evidence.checks.sourceChangeRefresh.action}; reasons=${evidence.checks.sourceChangeRefresh.reasons.join(", ")}
- WebView first/second: ${evidence.checks.unsupportedDomainFallbacks.webview.firstAction} -> ${evidence.checks.unsupportedDomainFallbacks.webview.secondAction}; reason=${evidence.checks.unsupportedDomainFallbacks.webview.fallbackReason}
- React Native first/second: ${evidence.checks.unsupportedDomainFallbacks.reactNative.firstAction} -> ${evidence.checks.unsupportedDomainFallbacks.reactNative.secondAction}; reason=${evidence.checks.unsupportedDomainFallbacks.reactNative.fallbackReason}

## Claim boundary

This artifact supports bounded reuse-correctness wording for local Codex runtime-hook decisions. It does not support wall-clock cache-performance, runtime-token, provider-cost, billing, invoice, or charged-cost claims.
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runId = process.argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ?? "local";
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const evidence = await buildReactWebReuseEvidence({ repoRoot: defaultRepoRoot, runId });

  if (outputArg) {
    const outputPath = path.resolve(defaultRepoRoot, outputArg);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  if (markdownArg) {
    const markdownPath = path.resolve(defaultRepoRoot, markdownArg);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderReactWebReuseEvidenceMarkdown(evidence));
  }

  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}
