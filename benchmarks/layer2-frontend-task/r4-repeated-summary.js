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

function stableIdentityValue(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function targetIdentityFromPath(filePath) {
  if (!filePath) return null;
  const normalized = path.relative(process.cwd(), path.resolve(filePath)).split(path.sep).join('/');
  return `target:${normalized}`;
}

function firstIdentityCandidate(candidates) {
  for (const candidate of candidates) {
    const value = stableIdentityValue(candidate.value);
    if (value !== null) return { value, source: candidate.source };
  }
  return { value: null, source: null };
}

function artifactIdentity(artifact, defaults) {
  const taskIdentity = firstIdentityCandidate([
    { value: artifact.taskIdentity, source: 'artifact.taskIdentity' },
    { value: artifact.targetIdentity, source: 'artifact.targetIdentity' },
    { value: defaults.taskIdentity, source: defaults.taskIdentitySource },
    { value: targetIdentityFromPath(artifact.targetFile), source: 'artifact.targetFile' },
  ]);
  const model = firstIdentityCandidate([
    { value: artifact.model, source: 'artifact.model' },
    { value: defaults.model, source: defaults.modelSource },
  ]);
  const setupIdentity = firstIdentityCandidate([
    { value: artifact.setupIdentity, source: 'artifact.setupIdentity' },
    { value: defaults.setupIdentity, source: defaults.setupIdentitySource },
  ]);
  return {
    taskIdentity: taskIdentity.value,
    model: model.value,
    setupIdentity: setupIdentity.value,
    sources: {
      taskIdentity: taskIdentity.source,
      model: model.source,
      setupIdentity: setupIdentity.source,
    },
  };
}

function sameIdentity(left, right) {
  return left.taskIdentity === right.taskIdentity
    && left.model === right.model
    && left.setupIdentity === right.setupIdentity;
}

function missingIdentityFields(pair) {
  const fields = [];
  if (!pair.vanilla.identity.taskIdentity || !pair.fooks.identity.taskIdentity) fields.push('missing-task-identity');
  if (!pair.vanilla.identity.model || !pair.fooks.identity.model) fields.push('missing-model');
  if (!pair.vanilla.identity.setupIdentity || !pair.fooks.identity.setupIdentity) fields.push('missing-setup-identity');
  return fields;
}

function inheritedIdentityFields(pair) {
  const fields = [];
  for (const side of ['vanilla', 'fooks']) {
    for (const field of ['taskIdentity', 'model', 'setupIdentity']) {
      const source = pair[side].identity.sources?.[field] || null;
      if (source && !source.startsWith('artifact.')) {
        fields.push(`${side}-${field}-from-${source}`);
      }
    }
  }
  return fields;
}

function uniqueFiniteValues(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))];
}

function artifactStatus(artifactPath, artifact, defaults) {
  const metrics = artifact.metrics || {};
  const runtimeTokenTelemetryAvailable = metrics.runtimeTokenClaimAvailable === true
    || metrics.runtimeTokenTelemetryAvailable === true;
  return {
    path: artifactPath ? path.relative(process.cwd(), path.resolve(artifactPath)).split(path.sep).join('/') : null,
    status: artifact.status || null,
    validationStatus: artifact.validation?.status || null,
    identity: artifactIdentity(artifact, defaults),
    promptTokensApprox: Number.isFinite(metrics.promptTokensApprox) ? metrics.promptTokensApprox : null,
    runtimeTokensTotal: Number.isFinite(metrics.runtimeTokensTotal) ? metrics.runtimeTokensTotal : null,
    runtimeTokenTelemetryAvailable,
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
  const runId = input.runId || null;
  const taskIdentity = stableIdentityValue(input.taskIdentity || targetIdentityFromPath(input.target));
  const model = stableIdentityValue(input.model || null);
  const setupIdentity = stableIdentityValue(input.setupIdentity || null);
  const identityDefaults = {
    taskIdentity,
    taskIdentitySource: taskIdentity ? 'run.taskIdentity' : null,
    model,
    modelSource: model ? 'run.model' : null,
    setupIdentity,
    setupIdentitySource: setupIdentity ? 'run.setupIdentity' : null,
  };
  const pairSpecs = input.pairs || [];
  const pairs = pairSpecs.map((pair, index) => {
    const vanillaArtifact = pair.vanillaArtifact || readArtifact(pair.vanillaPath);
    const fooksArtifact = pair.fooksArtifact || readArtifact(pair.fooksPath);
    const pairDefaults = {
      ...identityDefaults,
      taskIdentity: stableIdentityValue(pair.taskIdentity || identityDefaults.taskIdentity),
      taskIdentitySource: pair.taskIdentity ? 'pair.taskIdentity' : identityDefaults.taskIdentitySource,
      model: stableIdentityValue(pair.model || identityDefaults.model),
      modelSource: pair.model ? 'pair.model' : identityDefaults.modelSource,
      setupIdentity: stableIdentityValue(pair.setupIdentity || identityDefaults.setupIdentity),
      setupIdentitySource: pair.setupIdentity ? 'pair.setupIdentity' : identityDefaults.setupIdentitySource,
    };
    const vanilla = artifactStatus(pair.vanillaPath, vanillaArtifact, pairDefaults);
    const fooks = artifactStatus(pair.fooksPath, fooksArtifact, pairDefaults);
    const accepted = acceptedRun(vanilla) && acceptedRun(fooks);
    const identityMatched = sameIdentity(vanilla.identity, fooks.identity);
    const runtimeComparable = accepted && vanilla.runtimeTokenTelemetryAvailable && fooks.runtimeTokenTelemetryAvailable
      && Number.isFinite(vanilla.runtimeTokensTotal) && Number.isFinite(fooks.runtimeTokensTotal);
    const latencyComparable = accepted && Number.isFinite(vanilla.latencyMs) && Number.isFinite(fooks.latencyMs);

    return {
      pairIndex: pair.pairIndex || index + 1,
      accepted,
      identityMatched,
      identity: identityMatched ? vanilla.identity : null,
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
  const identityMatchedAcceptedPairs = acceptedPairs.filter((pair) => pair.identityMatched);
  const mixedIdentityReasons = [];
  const acceptedTaskIdentities = uniqueFiniteValues(identityMatchedAcceptedPairs.map((pair) => pair.identity?.taskIdentity));
  const acceptedModels = uniqueFiniteValues(identityMatchedAcceptedPairs.map((pair) => pair.identity?.model));
  const acceptedSetupIdentities = uniqueFiniteValues(identityMatchedAcceptedPairs.map((pair) => pair.identity?.setupIdentity));
  if (acceptedPairs.some((pair) => !pair.identityMatched)) mixedIdentityReasons.push('pair-identity-mismatch');
  if (acceptedTaskIdentities.length > 1) mixedIdentityReasons.push('mixed-task-identity');
  if (acceptedModels.length > 1) mixedIdentityReasons.push('mixed-model');
  if (acceptedSetupIdentities.length > 1) mixedIdentityReasons.push('mixed-setup-identity');
  const missingIdentityReasons = uniqueFiniteValues(acceptedPairs.flatMap(missingIdentityFields));
  const inheritedIdentityReasons = uniqueFiniteValues(acceptedPairs.flatMap(inheritedIdentityFields));
  const resolvedTaskIdentity = taskIdentity || (acceptedTaskIdentities.length === 1 ? acceptedTaskIdentities[0] : null);
  const resolvedModel = model || (acceptedModels.length === 1 ? acceptedModels[0] : null);
  const resolvedSetupIdentity = setupIdentity
    || (acceptedSetupIdentities.length === 1 ? acceptedSetupIdentities[0] : null);
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
  let candidateStatus = 'diagnostic-only';
  const candidateReasons = [];
  if (acceptedPairs.length < requiredAcceptedPairs) {
    classification = 'insufficient-accepted-pairs';
    candidateStatus = 'insufficient-accepted-pairs';
    candidateReasons.push(`accepted pairs ${acceptedPairs.length}/${requiredAcceptedPairs}`);
  } else if (missingIdentityReasons.length > 0) {
    classification = 'missing-identity';
    candidateStatus = 'missing-identity';
    candidateReasons.push(...missingIdentityReasons);
  } else if (mixedIdentityReasons.length > 0) {
    classification = 'mixed-identity';
    candidateStatus = 'mixed-identity';
    candidateReasons.push(...mixedIdentityReasons);
  } else if (runtimeTokenComparablePairCount < requiredAcceptedPairs) {
    classification = 'runtime-token-unavailable';
    candidateStatus = 'runtime-token-unavailable';
    candidateReasons.push(`runtime-token comparable pairs ${runtimeTokenComparablePairCount}/${requiredAcceptedPairs}`);
  } else if (latencyComparablePairCount < requiredAcceptedPairs) {
    classification = 'latency-unavailable';
    candidateStatus = 'latency-unavailable';
    candidateReasons.push(`latency comparable pairs ${latencyComparablePairCount}/${requiredAcceptedPairs}`);
  } else if (
    medians.runtimeTokenReductionPct > 0
    && medians.latencyReductionPct > 0
    && outliers.severeRuntimeTokenRegressionCount === 0
  ) {
    classification = 'narrow-l1-candidate';
    candidateStatus = 'candidate-evidence';
    candidateReasons.push('5+ same-task/model/setup accepted pairs with positive runtime-token and latency medians');
  } else {
    candidateReasons.push('candidate threshold not met');
  }

  return {
    schemaVersion: 'layer2-r4-repeated-summary.v1',
    runId,
    timestamp,
    taskIdentity: resolvedTaskIdentity,
    model: resolvedModel,
    setupIdentity: resolvedSetupIdentity,
    requiredAcceptedPairs,
    attemptedPairCount: pairs.length,
    acceptedPairCount: acceptedPairs.length,
    failedPairCount: pairs.length - acceptedPairs.length,
    runtimeTokenComparablePairCount,
    latencyComparablePairCount,
    distributions: {
      promptReductionPct: promptDeltas,
      runtimeTokenReductionPct: runtimeTokenDeltas,
      latencyReductionPct: latencyDeltas,
    },
    medians,
    outliers,
    identity: {
      taskIdentity: resolvedTaskIdentity,
      model: resolvedModel,
      setupIdentity: resolvedSetupIdentity,
      acceptedTaskIdentities,
      acceptedModels,
      acceptedSetupIdentities,
      mixed: mixedIdentityReasons.length > 0,
      mixedReasons: mixedIdentityReasons,
      missing: missingIdentityReasons.length > 0,
      missingReasons: missingIdentityReasons,
      inherited: inheritedIdentityReasons.length > 0,
      inheritedReasons: inheritedIdentityReasons,
      sourcePolicy: 'Candidate evidence requires every accepted pair to have the same resolved task/model/setup identity. Artifact, pair, and run-level identity sources are accepted; inherited non-artifact sources are reported for auditability.',
    },
    candidate: {
      status: candidateStatus,
      achieved: candidateStatus === 'candidate-evidence',
      reasons: candidateReasons,
      claimBoundary: 'Candidate evidence is internal repeated local telemetry only; stable runtime-token/time claimability remains false.',
    },
    pairs,
    claimBoundary: [
      'Accepted pairs require both vanilla and fooks to pass local applied acceptance gates.',
      'Runtime-token comparisons are Level 1 CLI runtime-reported telemetry only, not provider billing tokens or costs.',
      'Telemetry availability/comparability is not product claimability.',
      'A candidate evidence summary is internal evidence only, not a stable public runtime-token/time savings claim.',
      'A narrow L1 candidate still does not support provider billing-token, cost-savings, broad multi-task, Claude, or opencode savings claims.',
      'Broad/stable claims require later multi-task repeated evidence.',
    ],
    claimability: {
      providerInvoiceOrBillingSavings: false,
      providerBillingTokenSavings: false,
      stableRuntimeTokenSavings: false,
      stableTimeOrLatencySavings: false,
    },
    classification,
  };
}

function writeSummary(outputPath, summary) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
}

module.exports = { summarizeRepeatedPairs, writeSummary };
