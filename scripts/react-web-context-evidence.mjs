import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");

export const DEFAULT_REACT_WEB_EVIDENCE_FIXTURES = [
  "fixtures/compressed/HookEffectPanel.tsx",
  "fixtures/compressed/FormSection.tsx",
  "fixtures/hybrid/DashboardPanel.tsx",
  "test/fixtures/frontend-domain-expectations/react-web/custom-design-system-card.tsx",
  "test/fixtures/frontend-domain-expectations/react-web/custom-form-shell.tsx",
];

function byteLength(value) {
  return Buffer.byteLength(value, "utf8");
}

function percentReduction(beforeBytes, afterBytes) {
  if (!Number.isFinite(beforeBytes) || beforeBytes <= 0) return 0;
  return Number.parseFloat(((1 - afterBytes / beforeBytes) * 100).toFixed(3));
}

function cleanupRuntimeSessions(repoRoot, prefix) {
  const root = path.join(repoRoot, ".fooks", "state", "codex-runtime");
  if (!fs.existsSync(root)) return;

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.startsWith(prefix)) {
      fs.rmSync(path.join(root, entry.name), { force: true });
    }
  }

  if (fs.existsSync(root) && fs.readdirSync(root).length === 0) {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function loadRuntimeHook(repoRoot) {
  return import(path.join(repoRoot, "dist", "adapters", "codex-runtime-hook.js"));
}

export async function measureReactWebFixture({ repoRoot = defaultRepoRoot, relativeFile, runId = Date.now().toString() }) {
  const { handleCodexRuntimeHook } = await loadRuntimeHook(repoRoot);
  const sessionPrefix = `react-web-context-evidence-${runId}-`;
  const sessionId = `${sessionPrefix}${relativeFile.replace(/[^a-z0-9]+/gi, "-")}`;
  const absoluteFile = path.join(repoRoot, relativeFile);
  const source = fs.readFileSync(absoluteFile, "utf8");

  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, repoRoot);
  const first = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: `Please inspect ${relativeFile}`,
    },
    repoRoot,
  );
  const second = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: `Please inspect ${relativeFile} again and keep the same-file React Web context compact if safe`,
    },
    repoRoot,
  );

  const payload = second.debug?.decision?.payload ?? null;
  const domainPayload = payload?.domainPayload ?? null;
  const sourceBytes = byteLength(source);
  const runtimePayloadBytes = payload ? byteLength(JSON.stringify(payload)) : 0;
  const domainPayloadBytes = domainPayload ? byteLength(JSON.stringify(domainPayload)) : 0;

  return {
    file: relativeFile,
    firstAction: first.action,
    secondAction: second.action,
    decision: second.debug?.decision?.decision ?? null,
    classification: second.debug?.decision?.debug?.domainDetection?.classification ?? null,
    sourceBytes,
    runtimePayloadBytes,
    domainPayloadBytes,
    runtimePayloadReductionPct: percentReduction(sourceBytes, runtimePayloadBytes),
    domainPayloadReductionPct: percentReduction(sourceBytes, domainPayloadBytes),
    runtimePayloadLargerThanSource: runtimePayloadBytes > sourceBytes,
    domainPayloadLargerThanSource: domainPayloadBytes > sourceBytes,
    claimBoundary: domainPayload?.claimBoundary ?? null,
    claimStatus: domainPayload?.claimStatus ?? null,
  };
}

export async function buildReactWebContextEvidence({
  repoRoot = defaultRepoRoot,
  fixtures = DEFAULT_REACT_WEB_EVIDENCE_FIXTURES,
  runId = new Date().toISOString().replace(/[:.]/g, "-"),
} = {}) {
  const rows = [];
  for (const relativeFile of fixtures) {
    rows.push(await measureReactWebFixture({ repoRoot, relativeFile, runId }));
  }
  cleanupRuntimeSessions(repoRoot, `react-web-context-evidence-${runId}-`);

  const domainReductionValues = rows.map((row) => row.domainPayloadReductionPct);
  const runtimeReductionValues = rows.map((row) => row.runtimePayloadReductionPct);
  const allDomainPayloadsSmaller = rows.every((row) => row.secondAction === "inject" && row.classification === "react-web" && !row.domainPayloadLargerThanSource);
  const allRuntimePayloadsSmaller = rows.every((row) => row.secondAction === "inject" && !row.runtimePayloadLargerThanSource);

  return {
    schemaVersion: "react-web-context-evidence.v1",
    generatedAt: new Date().toISOString(),
    runId,
    measurement: "local-source-bytes-vs-runtime-json-bytes",
    claimBoundary:
      "Local fixture byte-size evidence only: source-derived React Web domainPayload compactness, not provider tokenizer output, not runtime-token savings, not cache performance, not latency, and not provider billing or invoice savings.",
    fixtures: rows,
    summary: {
      fixtureCount: rows.length,
      allReactWebInjects: rows.every((row) => row.firstAction === "record" && row.secondAction === "inject" && row.classification === "react-web"),
      domainPayloadReduction: {
        claimable: allDomainPayloadsSmaller,
        minPct: Math.min(...domainReductionValues),
        maxPct: Math.max(...domainReductionValues),
      },
      fullRuntimePayloadReduction: {
        claimable: allRuntimePayloadsSmaller,
        minPct: Math.min(...runtimeReductionValues),
        maxPct: Math.max(...runtimeReductionValues),
        blocker: allRuntimePayloadsSmaller ? null : "full runtime payload includes envelope/extraction fields and is not smaller than source for every fixture",
      },
      cachePerformanceImprovement: {
        claimable: false,
        blocker: "no wall-clock, cache-hit-rate, or end-to-end runtime benchmark is measured by this artifact",
      },
      providerBillingSavings: {
        claimable: false,
        blocker: "no provider usage, billing dashboard, invoice, or charged-cost data is measured by this artifact",
      },
    },
  };
}

export function renderReactWebContextEvidenceMarkdown(evidence) {
  const rows = evidence.fixtures
    .map(
      (row) =>
        `| \`${row.file}\` | ${row.sourceBytes} | ${row.domainPayloadBytes} | ${row.domainPayloadReductionPct}% | ${row.runtimePayloadBytes} | ${row.runtimePayloadReductionPct}% |`,
    )
    .join("\n");

  return `# React Web context evidence

${evidence.claimBoundary}

## Summary

- React Web repeated same-file injects observed: ${evidence.summary.allReactWebInjects ? "yes" : "no"}
- Domain payload reduction claimable: ${evidence.summary.domainPayloadReduction.claimable ? "yes" : "no"} (${evidence.summary.domainPayloadReduction.minPct}% to ${evidence.summary.domainPayloadReduction.maxPct}% local byte reduction)
- Full runtime payload reduction claimable: ${evidence.summary.fullRuntimePayloadReduction.claimable ? "yes" : "no"}
- Cache performance improvement claimable: no
- Provider billing savings claimable: no

## Fixture measurements

| Fixture | Source bytes | domainPayload bytes | domainPayload reduction | full runtime payload bytes | full runtime payload reduction |
| --- | ---: | ---: | ---: | ---: | ---: |
${rows}

## Claim boundary

This artifact supports a bounded statement that React Web same-file reuse can carry a smaller source-derived domainPayload. It does not support broad runtime-token, latency, cache-performance, provider-cost, billing, invoice, or charged-cost claims.
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runId = process.argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ?? "local";
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const evidence = await buildReactWebContextEvidence({ repoRoot: defaultRepoRoot, runId });

  if (outputArg) {
    const outputPath = path.resolve(defaultRepoRoot, outputArg);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  if (markdownArg) {
    const markdownPath = path.resolve(defaultRepoRoot, markdownArg);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderReactWebContextEvidenceMarkdown(evidence));
  }

  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}
