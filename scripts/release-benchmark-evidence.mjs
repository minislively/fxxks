import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReactWebContextEvidence } from "./react-web-context-evidence.mjs";
import { buildReactWebReuseEvidence } from "./react-web-reuse-evidence.mjs";
import { buildReleaseProvenance } from "./release-provenance.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");

function finite(value) {
  return Number.isFinite(value) ? value : null;
}

function claimLine(contextEvidence, reuseEvidence) {
  const min = contextEvidence.summary.actualInjectedContextReduction.minPct;
  const max = contextEvidence.summary.actualInjectedContextReduction.maxPct;
  if (!contextEvidence.summary.actualInjectedContextReduction.claimable || !reuseEvidence.summary.reuseCorrectnessClaimable) {
    return "React Web evidence is present, but npm wording must stay diagnostic until actual injected context and reuse-correctness gates pass.";
  }
  return `React Web same-file reuse is routed correctly, and current-lane fixtures show ${min}% to ${max}% smaller actual injected additionalContext by local byte-size evidence.`;
}

export function renderReactWebDogfoodMetricInterpretationMarkdown() {
  return `## React Web dogfood metric interpretation

- Dogfood metrics are advisory-only and diagnostic-only; they do not block merge or release.
- candidate_* metrics describe candidates, admission, and candidate compression before final host-facing hook output.
- final_injection_byte_reduction is final hook-output size after admission/fallback and is not proof of candidate compression success.
- Dogfood metrics are local byte diagnostics, not provider tokenizer output, and do not prove provider token/cost/billing, runtime-token, latency, invoice, charged-cost, or numeric gate outcomes.`;
}

export async function buildReleaseBenchmarkEvidence({
  repoRoot = defaultRepoRoot,
  runId = new Date().toISOString().replace(/[:.]/g, "-"),
} = {}) {
  const contextEvidence = await buildReactWebContextEvidence({ repoRoot, runId: `${runId}-context` });
  const reuseEvidence = await buildReactWebReuseEvidence({ repoRoot, runId: `${runId}-reuse` });
  const releaseProvenance = buildReleaseProvenance({ repoRoot });

  const releaseClaims = {
    npmUpdateClaimable: contextEvidence.summary.actualInjectedContextReduction.claimable && reuseEvidence.summary.reuseCorrectnessClaimable,
    headline: claimLine(contextEvidence, reuseEvidence),
    allowed: [
      "React Web same-file reuse routes record -> inject for current-lane fixtures.",
      "React Web source changes refresh before attach and do not reuse stale fingerprints.",
      ...(contextEvidence.summary.actualInjectedContextReduction.claimable
        ? [
            `React Web current-lane fixtures show ${contextEvidence.summary.actualInjectedContextReduction.minPct}% to ${contextEvidence.summary.actualInjectedContextReduction.maxPct}% smaller actual injected additionalContext by local byte-size measurement.`,
          ]
        : [
            "React Web current-lane actual injected additionalContext evidence is diagnostic-only until all fixtures are smaller than source.",
          ]),
      "RN and WebView boundaries fall back instead of becoming React Web payload support.",
    ],
    forbidden: [
      "Caching performance improved.",
      "Runtime-token savings are proven.",
      "Provider cost or billing is reduced.",
      "Actual injected runtime context is always smaller than source without fixture evidence.",
      "Diagnostic domainPayload reduction proves runtime-token savings.",
      "Broad React Web, React Native, or WebView support is available.",
    ],
  };

  return {
    schemaVersion: "release-benchmark-evidence.v1",
    generatedAt: new Date().toISOString(),
    runId,
    measurement: "release-facing-local-evidence-summary",
    claimBoundary:
      "Release-facing local evidence summary only: combines React Web context byte-size and reuse-correctness artifacts; not provider tokenizer output, not runtime-token savings, not wall-clock cache performance, not latency, not provider cost, billing, invoice, or charged-cost evidence.",
    releaseClaims,
    context: {
      schemaVersion: contextEvidence.schemaVersion,
      fixtureCount: contextEvidence.summary.fixtureCount,
      allReactWebInjects: contextEvidence.summary.allReactWebInjects,
      actualInjectedContextReduction: {
        claimable: contextEvidence.summary.actualInjectedContextReduction.claimable,
        minPct: finite(contextEvidence.summary.actualInjectedContextReduction.minPct),
        maxPct: finite(contextEvidence.summary.actualInjectedContextReduction.maxPct),
        blocker: contextEvidence.summary.actualInjectedContextReduction.blocker,
      },
      domainPayloadReduction: {
        claimable: contextEvidence.summary.domainPayloadReduction.claimable,
        diagnosticOnly: true,
        minPct: finite(contextEvidence.summary.domainPayloadReduction.minPct),
        maxPct: finite(contextEvidence.summary.domainPayloadReduction.maxPct),
      },
      fullRuntimePayloadReduction: {
        claimable: contextEvidence.summary.fullRuntimePayloadReduction.claimable,
        minPct: finite(contextEvidence.summary.fullRuntimePayloadReduction.minPct),
        maxPct: finite(contextEvidence.summary.fullRuntimePayloadReduction.maxPct),
        blocker: contextEvidence.summary.fullRuntimePayloadReduction.blocker,
      },
      preReadGraphDiagnostics: {
        ...contextEvidence.summary.preReadGraphDiagnostics,
        diagnosticOnly: true,
        claimable: false,
      },
      runtimeGraphDiagnostics: {
        ...contextEvidence.summary.runtimeGraphDiagnostics,
        diagnosticOnly: true,
        claimable: false,
      },
      graphAssistedContextPath: {
        ...contextEvidence.summary.graphAssistedContextPath,
        diagnosticOnly: true,
        claimable: false,
      },
      fixtures: contextEvidence.fixtures.map((row) => ({
        file: row.file,
        sourceBytes: row.sourceBytes,
        additionalContextBytes: row.additionalContextBytes,
        additionalContextReductionPct: row.additionalContextReductionPct,
        domainPayloadBytes: row.domainPayloadBytes,
        domainPayloadReductionPct: row.domainPayloadReductionPct,
        runtimePayloadBytes: row.runtimePayloadBytes,
        runtimePayloadReductionPct: row.runtimePayloadReductionPct,
      })),
    },
    reuse: {
      schemaVersion: reuseEvidence.schemaVersion,
      reuseCorrectnessClaimable: reuseEvidence.summary.reuseCorrectnessClaimable,
      sameFileReactWebReuse: reuseEvidence.checks.sameFileReactWebReuse,
      sourceChangeRefresh: reuseEvidence.checks.sourceChangeRefresh,
      unsupportedDomainFallbacks: reuseEvidence.checks.unsupportedDomainFallbacks,
    },
    nonClaims: {
      cachePerformanceImprovement: {
        claimable: false,
        blocker: "no wall-clock latency, cache-hit-rate, or end-to-end runtime benchmark is measured by this release-facing artifact",
      },
      runtimeTokenSavings: {
        claimable: false,
        blocker: "no comparable runtime-token telemetry is measured by this release-facing artifact",
      },
      providerBillingSavings: {
        claimable: false,
        blocker: "no provider usage, tokenizer, billing dashboard, invoice, or charged-cost data is measured by this release-facing artifact",
      },
    },
    releaseProvenance,
  };
}

export function buildReleaseBenchmarkSmokeSummary(evidence) {
  return {
    npmUpdateClaimable: evidence.releaseClaims.npmUpdateClaimable,
    headline: evidence.releaseClaims.headline,
    actualInjectedContextReduction: evidence.context.actualInjectedContextReduction,
    preReadGraphDiagnostics: evidence.context.preReadGraphDiagnostics,
    runtimeGraphDiagnostics: evidence.context.runtimeGraphDiagnostics,
    graphAssistedContextPath: evidence.context.graphAssistedContextPath,
    reuseCorrectnessClaimable: evidence.reuse.reuseCorrectnessClaimable,
    nonClaims: {
      cachePerformanceImprovement: evidence.nonClaims.cachePerformanceImprovement.claimable,
      runtimeTokenSavings: evidence.nonClaims.runtimeTokenSavings.claimable,
      providerBillingSavings: evidence.nonClaims.providerBillingSavings.claimable,
    },
    releaseProvenance: {
      status: evidence.releaseProvenance.status,
      claimable: evidence.releaseProvenance.claimable,
      blockers: evidence.releaseProvenance.blockers,
      package: evidence.releaseProvenance.package,
      git: evidence.releaseProvenance.git,
      github: evidence.releaseProvenance.github,
      claimBoundary: evidence.releaseProvenance.claimBoundary,
    },
    claimBoundary: evidence.claimBoundary,
  };
}

export function assertReleaseBenchmarkSmokeGate(evidence) {
  if (evidence.releaseClaims.npmUpdateClaimable === true) {
    return;
  }

  const contextBlocker = evidence.context.actualInjectedContextReduction.blocker;
  throw new Error(
    [
      "release benchmark gate failed: npm update wording is not claimable",
      contextBlocker ? `actual injected context blocker: ${contextBlocker}` : null,
      evidence.reuse.reuseCorrectnessClaimable === true ? null : "reuse correctness is not claimable",
    ]
      .filter(Boolean)
      .join("; "),
  );
}

export function renderReleaseBenchmarkEvidenceMarkdown(evidence) {
  const fixtureRows = evidence.context.fixtures
    .map(
      (row) =>
        `| \`${row.file}\` | ${row.sourceBytes} | ${row.additionalContextBytes} | ${row.additionalContextReductionPct}% | ${row.domainPayloadBytes} | ${row.domainPayloadReductionPct}% | ${row.runtimePayloadBytes} | ${row.runtimePayloadReductionPct}% |`,
    )
    .join("\n");

  return `# Release benchmark evidence

${evidence.claimBoundary}

## Release-safe headline

${evidence.releaseClaims.headline}

## Claimable for this npm update

- npm update wording claimable: ${evidence.releaseClaims.npmUpdateClaimable ? "yes" : "no"}
- React Web actual injected context reduction: ${evidence.context.actualInjectedContextReduction.claimable ? "yes" : "no"} (${evidence.context.actualInjectedContextReduction.minPct}% to ${evidence.context.actualInjectedContextReduction.maxPct}% smaller actual additionalContext)
- React Web domainPayload reduction diagnostic-only: ${evidence.context.domainPayloadReduction.claimable ? "yes" : "no"} (${evidence.context.domainPayloadReduction.minPct}% to ${evidence.context.domainPayloadReduction.maxPct}% smaller source-derived domainPayloads)
- React Web pre-read graph diagnostics: ${evidence.context.preReadGraphDiagnostics.emittedCount}/${evidence.context.preReadGraphDiagnostics.fixtureCount} emitted, diagnostic-only=yes
- React Web runtime graph diagnostics: ${evidence.context.runtimeGraphDiagnostics.emittedCount}/${evidence.context.runtimeGraphDiagnostics.fixtureCount} emitted, diagnostic-only=yes
- React Web graph-assisted context path: ${evidence.context.graphAssistedContextPath.correlatedFreshPathCount}/${evidence.context.graphAssistedContextPath.fixtureCount} correlated, diagnostic-only=yes
- React Web reuse correctness: ${evidence.reuse.reuseCorrectnessClaimable ? "yes" : "no"}

${renderReactWebDogfoodMetricInterpretationMarkdown()}

## Fixture context-size measurements

| Fixture | Source bytes | actual additionalContext bytes | actual additionalContext reduction | diagnostic domainPayload bytes | diagnostic domainPayload reduction | diagnostic runtime payload bytes | diagnostic runtime payload reduction |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${fixtureRows}

## Reuse-correctness checks

- Same-file React Web: ${evidence.reuse.sameFileReactWebReuse.firstAction} -> ${evidence.reuse.sameFileReactWebReuse.secondAction}
- Source-change refresh: ${evidence.reuse.sourceChangeRefresh.action}; reasons=${evidence.reuse.sourceChangeRefresh.reasons.join(", ")}; stalePayloadReused=${evidence.reuse.sourceChangeRefresh.stalePayloadReused}
- WebView boundary: ${evidence.reuse.unsupportedDomainFallbacks.webview.secondAction}; reason=${evidence.reuse.unsupportedDomainFallbacks.webview.fallbackReason}
- React Native boundary: ${evidence.reuse.unsupportedDomainFallbacks.reactNative.secondAction}; reason=${evidence.reuse.unsupportedDomainFallbacks.reactNative.fallbackReason}

## Non-claims

- Cache performance improvement: no
- Runtime-token savings: no
- Provider billing/cost savings: no
- Actual injected runtime context always smaller than source without fixture evidence: no
- Diagnostic domainPayload reduction proves runtime-token savings: no
- Broad React Web/RN/WebView support: no

## Release provenance

- Status: ${evidence.releaseProvenance.status}
- Package: ${evidence.releaseProvenance.package.name}@${evidence.releaseProvenance.package.version}
- Expected tag: ${evidence.releaseProvenance.package.expectedVersionTag}
- Commit: ${evidence.releaseProvenance.git.commitSha || "unavailable"}
- Tags at HEAD: ${evidence.releaseProvenance.git.tagsAtHead.length > 0 ? evidence.releaseProvenance.git.tagsAtHead.join(", ") : "none"}
- GitHub release URL: ${evidence.releaseProvenance.github.releaseUrl || "unavailable"}
- Claimable: ${evidence.releaseProvenance.claimable ? "yes" : "no"}
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runId = process.argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ?? "local";
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const evidence = await buildReleaseBenchmarkEvidence({ repoRoot: defaultRepoRoot, runId });

  if (outputArg) {
    const outputPath = path.resolve(defaultRepoRoot, outputArg);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  if (markdownArg) {
    const markdownPath = path.resolve(defaultRepoRoot, markdownArg);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderReleaseBenchmarkEvidenceMarkdown(evidence));
  }

  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}
