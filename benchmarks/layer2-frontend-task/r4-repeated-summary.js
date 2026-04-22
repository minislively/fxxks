'use strict';

const fs = require('fs');
const path = require('path');

function readArtifact(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return {
      status: 'applied-code-run-failed',
      schemaVersion: 'layer2-r4-applied-run.v1',
      validation: { status: 'artifact-unavailable' },
      metrics: {},
      artifactError: error.message,
    };
  }
}

function round1(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

function reductionPct(vanilla, fooks) {
  if (!Number.isFinite(vanilla) || !Number.isFinite(fooks) || vanilla <= 0) return null;
  return round1(((vanilla - fooks) / vanilla) * 100);
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return round1((sorted[mid - 1] + sorted[mid]) / 2);
}

function artifactStatus(artifactPath, artifact) {
  const metrics = artifact.metrics || {};
  return {
    path: artifactPath ? path.relative(process.cwd(), path.resolve(artifactPath)).split(path.sep).join('/') : null,
    status: artifact.status || null,
    validationStatus: artifact.validation?.status || null,
    promptTokensApprox: Number.isFinite(metrics.promptTokensApprox) ? metrics.promptTokensApprox : null,
    runtimeTokensTotal: Number.isFinite(metrics.runtimeTokensTotal) ? metrics.runtimeTokensTotal : null,
    runtimeTokenClaimAvailable: metrics.runtimeTokenClaimAvailable === true,
    latencyMs: Number.isFinite(metrics.latencyMs) ? metrics.latencyMs : null,
    artifactError: artifact.artifactError || null,
  };
}

function acceptedRun(status) {
  return status.status === 'applied-code-run-validated' && status.validationStatus === 'applied-acceptance-validated';
}

function summarizeRepeatedPairs(input) {
  const requiredAcceptedPairs = Number(input.requiredAcceptedPairs || 5);
  const timestamp = input.timestamp || new Date().toISOString();
  const pairSpecs = input.pairs || [];
  const pairs = pairSpecs.map((pair, index) => {
    const vanillaArtifact = pair.vanillaArtifact || readArtifact(pair.vanillaPath);
    const fooksArtifact = pair.fooksArtifact || readArtifact(pair.fooksPath);
    const vanilla = artifactStatus(pair.vanillaPath, vanillaArtifact);
    const fooks = artifactStatus(pair.fooksPath, fooksArtifact);
    const accepted = acceptedRun(vanilla) && acceptedRun(fooks);
    const runtimeComparable = accepted && vanilla.runtimeTokenClaimAvailable && fooks.runtimeTokenClaimAvailable
      && Number.isFinite(vanilla.runtimeTokensTotal) && Number.isFinite(fooks.runtimeTokensTotal);
    const latencyComparable = accepted && Number.isFinite(vanilla.latencyMs) && Number.isFinite(fooks.latencyMs);

    return {
      pairIndex: pair.pairIndex || index + 1,
      accepted,
      vanilla,
      fooks,
      deltas: {
        promptReductionPct: accepted ? reductionPct(vanilla.promptTokensApprox, fooks.promptTokensApprox) : null,
        runtimeTokenReductionPct: runtimeComparable ? reductionPct(vanilla.runtimeTokensTotal, fooks.runtimeTokensTotal) : null,
        latencyReductionPct: latencyComparable ? reductionPct(vanilla.latencyMs, fooks.latencyMs) : null,
      },
    };
  });

  const acceptedPairs = pairs.filter((pair) => pair.accepted);
  const runtimeTokenDeltas = acceptedPairs.map((pair) => pair.deltas.runtimeTokenReductionPct).filter(Number.isFinite);
  const latencyDeltas = acceptedPairs.map((pair) => pair.deltas.latencyReductionPct).filter(Number.isFinite);
  const promptDeltas = acceptedPairs.map((pair) => pair.deltas.promptReductionPct).filter(Number.isFinite);
  const medians = {
    promptReductionPct: median(promptDeltas),
    runtimeTokenReductionPct: median(runtimeTokenDeltas),
    latencyReductionPct: median(latencyDeltas),
  };
  const outliers = {
    runtimeTokenRegressionCount: runtimeTokenDeltas.filter((value) => value < 0).length,
    severeRuntimeTokenRegressionCount: runtimeTokenDeltas.filter((value) => value <= -25).length,
    latencyRegressionCount: latencyDeltas.filter((value) => value < 0).length,
  };
  const runtimeTokenComparablePairCount = runtimeTokenDeltas.length;
  const latencyComparablePairCount = latencyDeltas.length;

  let classification = 'diagnostic-only';
  if (acceptedPairs.length < requiredAcceptedPairs) {
    classification = 'insufficient-accepted-pairs';
  } else if (runtimeTokenComparablePairCount < requiredAcceptedPairs) {
    classification = 'runtime-token-unavailable';
  } else if (
    medians.runtimeTokenReductionPct > 0
    && medians.latencyReductionPct > 0
    && outliers.severeRuntimeTokenRegressionCount === 0
  ) {
    classification = 'narrow-l1-candidate';
  }

  return {
    schemaVersion: 'layer2-r4-repeated-summary.v1',
    timestamp,
    requiredAcceptedPairs,
    attemptedPairCount: pairs.length,
    acceptedPairCount: acceptedPairs.length,
    failedPairCount: pairs.length - acceptedPairs.length,
    runtimeTokenComparablePairCount,
    latencyComparablePairCount,
    medians,
    outliers,
    pairs,
    claimBoundary: [
      'Accepted pairs require both vanilla and fooks to pass local applied acceptance gates.',
      'Runtime-token comparisons are Level 1 CLI runtime-reported telemetry only, not provider billing tokens or costs.',
      'A narrow L1 candidate still does not support provider billing-token, cost-savings, broad multi-task, Claude, or opencode savings claims.',
      'Broad/stable claims require later multi-task repeated evidence.',
    ],
    classification,
  };
}

function writeSummary(outputPath, summary) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
}

module.exports = { summarizeRepeatedPairs, writeSummary };
