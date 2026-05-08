import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");

export const DEFAULT_REACT_WEB_MIXED_ROUTING_FIXTURES = {
  reactWeb: "fixtures/compressed/HookEffectPanel.tsx",
  reactNative: "test/fixtures/frontend-domain-expectations/rn-style-platform-navigation.tsx",
  webview: "test/fixtures/frontend-domain-expectations/webview-boundary-basic.tsx",
  tui: "test/fixtures/frontend-domain-expectations/tui-ink-basic.tsx",
  mixed: "test/fixtures/frontend-domain-expectations/negative-rn-webview-boundary.tsx",
};

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

async function loadRuntimeHook(repoRoot) {
  return import(path.join(repoRoot, "dist", "adapters", "codex-runtime-hook.js"));
}

function inspectPromptDecision(decision) {
  const payload = decision?.debug?.decision?.payload;
  const fallback = decision?.debug?.decision?.fallback;
  const domainDetection = decision?.debug?.decision?.debug?.domainDetection;
  const policy = decision?.debug?.decision?.debug?.frontendPayloadPolicy;
  return {
    action: decision?.action ?? null,
    reasons: decision?.reasons ?? [],
    classification: domainDetection?.classification ?? null,
    claimStatus: domainDetection?.profile?.claimStatus ?? null,
    domainClaimBoundary: payload?.domainPayload?.claimBoundary ?? domainDetection?.profile?.claimBoundary ?? null,
    fallbackReason: fallback?.reason ?? null,
    frontendPayloadPolicy: policy?.name ?? null,
    payloadInjected: Boolean(decision?.debug?.decision && "payload" in decision.debug.decision),
  };
}

function warningForCheck(label, check) {
  if (check.claimable) return null;
  return `${label} failed: expected ${check.expectedOutcome}; got ${check.actualOutcome}`;
}

function summarizeWarnings(checks) {
  return Object.entries(checks)
    .map(([label, check]) => warningForCheck(label, check))
    .filter(Boolean);
}

export async function buildReactWebMixedRoutingEvidence({
  repoRoot = defaultRepoRoot,
  fixtures = DEFAULT_REACT_WEB_MIXED_ROUTING_FIXTURES,
  runId = new Date().toISOString().replace(/[:.]/g, "-"),
} = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-mixed-routing-"));
  const sessionId = `react-web-mixed-routing-${runId}`;

  try {
    fs.writeFileSync(
      path.join(tempRoot, "package.json"),
      JSON.stringify({ name: "react-web-mixed-routing-evidence-temp", private: true }, null, 2),
    );

    for (const relativeFile of Object.values(fixtures)) {
      copyFixture(repoRoot, tempRoot, relativeFile);
    }

    const { handleCodexRuntimeHook } = await loadRuntimeHook(repoRoot);
    handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempRoot);

    const inspectTwice = (relativeFile) => {
      const first = handleCodexRuntimeHook(
        {
          hookEventName: "UserPromptSubmit",
          sessionId,
          prompt: `Please inspect ${relativeFile}`,
        },
        tempRoot,
      );
      const second = handleCodexRuntimeHook(
        {
          hookEventName: "UserPromptSubmit",
          sessionId,
          prompt: `Please inspect ${relativeFile} again`,
        },
        tempRoot,
      );
      return {
        firstAction: first.action,
        second: inspectPromptDecision(second),
      };
    };

    const reactWeb = inspectTwice(fixtures.reactWeb);
    const reactNative = inspectTwice(fixtures.reactNative);
    const webview = inspectTwice(fixtures.webview);
    const tui = inspectTwice(fixtures.tui);
    const mixed = inspectTwice(fixtures.mixed);

    const checks = {
      reactWebPositive: {
        claimable:
          reactWeb.firstAction === "record" &&
          reactWeb.second.action === "inject" &&
          reactWeb.second.classification === "react-web" &&
          reactWeb.second.payloadInjected,
        expectedOutcome: "record -> inject with react-web payload",
        actualOutcome: `${reactWeb.firstAction} -> ${reactWeb.second.action} (${reactWeb.second.classification ?? "unknown"})`,
        firstAction: reactWeb.firstAction,
        secondAction: reactWeb.second.action,
        classification: reactWeb.second.classification,
        claimStatus: reactWeb.second.claimStatus,
        domainClaimBoundary: reactWeb.second.domainClaimBoundary,
        frontendPayloadPolicy: reactWeb.second.frontendPayloadPolicy,
        payloadInjected: reactWeb.second.payloadInjected,
        reasons: reactWeb.second.reasons,
      },
      reactNativeBoundary: {
        claimable:
          reactNative.firstAction === "record" &&
          reactNative.second.action === "fallback" &&
          reactNative.second.classification === "react-native" &&
          !reactNative.second.payloadInjected &&
          reactNative.second.fallbackReason === "unsupported-frontend-domain-profile",
        expectedOutcome: "record -> fallback with react-native boundary",
        actualOutcome: `${reactNative.firstAction} -> ${reactNative.second.action} (${reactNative.second.classification ?? "unknown"})`,
        firstAction: reactNative.firstAction,
        secondAction: reactNative.second.action,
        classification: reactNative.second.classification,
        claimStatus: reactNative.second.claimStatus,
        fallbackReason: reactNative.second.fallbackReason,
        frontendPayloadPolicy: reactNative.second.frontendPayloadPolicy,
        payloadInjected: reactNative.second.payloadInjected,
        reasons: reactNative.second.reasons,
      },
      webviewBoundary: {
        claimable:
          webview.firstAction === "record" &&
          webview.second.action === "fallback" &&
          webview.second.classification === "webview" &&
          !webview.second.payloadInjected &&
          webview.second.fallbackReason === "unsupported-react-native-webview-boundary",
        expectedOutcome: "record -> fallback with webview boundary",
        actualOutcome: `${webview.firstAction} -> ${webview.second.action} (${webview.second.classification ?? "unknown"})`,
        firstAction: webview.firstAction,
        secondAction: webview.second.action,
        classification: webview.second.classification,
        claimStatus: webview.second.claimStatus,
        fallbackReason: webview.second.fallbackReason,
        frontendPayloadPolicy: webview.second.frontendPayloadPolicy,
        payloadInjected: webview.second.payloadInjected,
        reasons: webview.second.reasons,
      },
      tuiBoundary: {
        claimable:
          tui.firstAction === "record" &&
          tui.second.action === "fallback" &&
          tui.second.classification === "tui-ink" &&
          !tui.second.payloadInjected &&
          tui.second.fallbackReason === "unsupported-frontend-domain-profile",
        expectedOutcome: "record -> fallback with tui boundary",
        actualOutcome: `${tui.firstAction} -> ${tui.second.action} (${tui.second.classification ?? "unknown"})`,
        firstAction: tui.firstAction,
        secondAction: tui.second.action,
        classification: tui.second.classification,
        claimStatus: tui.second.claimStatus,
        fallbackReason: tui.second.fallbackReason,
        frontendPayloadPolicy: tui.second.frontendPayloadPolicy,
        payloadInjected: tui.second.payloadInjected,
        reasons: tui.second.reasons,
      },
      mixedBoundary: {
        claimable:
          mixed.firstAction === "record" &&
          mixed.second.action === "fallback" &&
          mixed.second.classification === "mixed" &&
          !mixed.second.payloadInjected &&
          mixed.second.fallbackReason === "unsupported-react-native-webview-boundary",
        expectedOutcome: "record -> fallback with mixed boundary",
        actualOutcome: `${mixed.firstAction} -> ${mixed.second.action} (${mixed.second.classification ?? "unknown"})`,
        firstAction: mixed.firstAction,
        secondAction: mixed.second.action,
        classification: mixed.second.classification,
        claimStatus: mixed.second.claimStatus,
        fallbackReason: mixed.second.fallbackReason,
        frontendPayloadPolicy: mixed.second.frontendPayloadPolicy,
        payloadInjected: mixed.second.payloadInjected,
        reasons: mixed.second.reasons,
      },
    };

    const warnings = summarizeWarnings(checks);

    return {
      schemaVersion: "react-web-mixed-routing-evidence.v1",
      generatedAt: new Date().toISOString(),
      runId,
      measurement: "codex-runtime-hook-local-mixed-routing-boundary-decisions",
      claimBoundary:
        "Local routing-boundary evidence only: proves the current React Web lane stays positive for the measured React Web fixture while RN, WebView, TUI, and mixed frontend boundaries stay fallback-only. This is not context-reduction measurement, not wall-clock performance, not cache-hit-rate proof, not runtime-token savings, and not provider cost, billing, invoice, or charged-cost evidence.",
      checks,
      summary: {
        boundaryIsolationClaimable: Object.values(checks).every((check) => check.claimable),
        warnings,
        contextReduction: {
          claimable: false,
          blocker: "this artifact measures routing-boundary isolation decisions, not source-byte or additionalContext-byte reduction",
        },
        cachePerformance: {
          claimable: false,
          blocker: "this artifact measures routing-boundary decisions, not wall-clock latency or cache hit rate",
        },
        providerBillingSavings: {
          claimable: false,
          blocker: "this artifact contains no provider usage, token accounting, billing dashboard, invoice, or charged-cost data",
        },
      },
    };
  } finally {
    cleanupRuntimeState(tempRoot, sessionId);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function renderReactWebMixedRoutingEvidenceMarkdown(evidence) {
  const warnings = evidence.summary.warnings.length > 0 ? evidence.summary.warnings : ["none"];
  return `# React Web mixed-routing evidence

${evidence.claimBoundary}

## Summary

- React Web positive lane claimable: ${evidence.checks.reactWebPositive.claimable ? "yes" : "no"}
- React Native boundary preserved: ${evidence.checks.reactNativeBoundary.claimable ? "yes" : "no"}
- WebView boundary preserved: ${evidence.checks.webviewBoundary.claimable ? "yes" : "no"}
- TUI boundary preserved: ${evidence.checks.tuiBoundary.claimable ? "yes" : "no"}
- Mixed RN/WebView boundary preserved: ${evidence.checks.mixedBoundary.claimable ? "yes" : "no"}
- Overall boundary isolation claimable: ${evidence.summary.boundaryIsolationClaimable ? "yes" : "no"}
- Context reduction claimable: no
- Cache performance claimable: no
- Provider billing savings claimable: no

## Boundary matrix

| Lane | first -> second | classification | fallback reason | payload injected |
| --- | --- | --- | --- | --- |
| React Web | ${evidence.checks.reactWebPositive.firstAction} -> ${evidence.checks.reactWebPositive.secondAction} | ${evidence.checks.reactWebPositive.classification} | n/a | ${evidence.checks.reactWebPositive.payloadInjected ? "yes" : "no"} |
| React Native | ${evidence.checks.reactNativeBoundary.firstAction} -> ${evidence.checks.reactNativeBoundary.secondAction} | ${evidence.checks.reactNativeBoundary.classification} | ${evidence.checks.reactNativeBoundary.fallbackReason} | ${evidence.checks.reactNativeBoundary.payloadInjected ? "yes" : "no"} |
| WebView | ${evidence.checks.webviewBoundary.firstAction} -> ${evidence.checks.webviewBoundary.secondAction} | ${evidence.checks.webviewBoundary.classification} | ${evidence.checks.webviewBoundary.fallbackReason} | ${evidence.checks.webviewBoundary.payloadInjected ? "yes" : "no"} |
| TUI | ${evidence.checks.tuiBoundary.firstAction} -> ${evidence.checks.tuiBoundary.secondAction} | ${evidence.checks.tuiBoundary.classification} | ${evidence.checks.tuiBoundary.fallbackReason} | ${evidence.checks.tuiBoundary.payloadInjected ? "yes" : "no"} |
| Mixed RN/WebView | ${evidence.checks.mixedBoundary.firstAction} -> ${evidence.checks.mixedBoundary.secondAction} | ${evidence.checks.mixedBoundary.classification} | ${evidence.checks.mixedBoundary.fallbackReason} | ${evidence.checks.mixedBoundary.payloadInjected ? "yes" : "no"} |

## Warnings

${warnings.map((warning) => `- ${warning}`).join("\n")}

## Claim boundary

This surface is local routing-boundary evidence only. React Web positivity here does not mean RN/WebView/TUI support. It does not support context-reduction, wall-clock performance, cache-hit-rate, runtime-token, provider-cost, billing, invoice, or charged-cost claims.
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runId = process.argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ?? "local";
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const evidence = await buildReactWebMixedRoutingEvidence({ repoRoot: defaultRepoRoot, runId });

  if (outputArg) {
    const outputPath = path.resolve(defaultRepoRoot, outputArg);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }

  if (markdownArg) {
    const markdownPath = path.resolve(defaultRepoRoot, markdownArg);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderReactWebMixedRoutingEvidenceMarkdown(evidence));
  }

  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}
