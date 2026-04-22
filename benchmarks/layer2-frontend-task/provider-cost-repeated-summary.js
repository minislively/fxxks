'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 'provider-cost-repeated-summary.v1';
const CLAIM_BOUNDARY = 'estimated-api-cost-only';
const ELIGIBLE_LAUNCH_PROVENANCE = new Set(['validated-provider-import', 'live-openai-usage']);
const FIXTURE_PROVENANCE = new Set(['fixture', 'fixture-mechanics']);
const DEFAULT_REQUIRED_TASK_CLASSES = 3;
const DEFAULT_REQUIRED_ACCEPTED_PAIRS_PER_TASK = 5;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value) {
  if (typeof value === 'string' && value.trim() !== '') value = Number(value);
  return Number.isFinite(value) ? value : null;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function stableValue(value) {
  if (value === undefined || value === null || value === '') return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Number(value.toFixed(6));
}

function roundMoney(value) {
  return value === null || value === undefined || !Number.isFinite(value) ? null : Number(value.toFixed(8));
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function normalizeTaskClasses(manifest) {
  const taskClasses = Array.isArray(manifest?.taskClasses)
    ? manifest.taskClasses
    : Array.isArray(manifest?.tasks)
      ? manifest.tasks
      : [];
  return taskClasses.map((task, index) => ({
    id: stableValue(task.id || task.taskClass || task.taskId || task.name || `task-${index + 1}`),
    targetPairCount: Number(task.targetPairCount || task.requiredAcceptedPairs || task.pairs || DEFAULT_REQUIRED_ACCEPTED_PAIRS_PER_TASK),
    qualityGate: normalizeQualityGate(task.qualityGate || task.quality_gate || task.gate),
  })).filter((task) => task.id);
}

function normalizeQualityGate(gate) {
  if (!isObject(gate)) {
    if (typeof gate === 'string' && gate.trim() !== '') {
      return { id: gate.trim(), version: null, command: null, status: null };
    }
    return null;
  }
  return {
    id: nonEmptyString(gate.id || gate.name || gate.kind),
    version: nonEmptyString(gate.version),
    command: nonEmptyString(gate.command),
    status: nonEmptyString(gate.status || gate.result),
  };
}

function qualityGatePassed(gate) {
  const normalized = normalizeQualityGate(gate);
  if (!normalized || !normalized.id) return false;
  if (normalized.id === 'usage-smoke') return false;
  if (!normalized.status) return true;
  return ['pass', 'passed', 'success', 'ok'].includes(normalized.status);
}

function pairQualityGateStatus(pair, evidence) {
  const evidenceGate = evidence.qualityGate || evidence.quality_gate;
  const pairGate = pair.qualityGate || pair.quality_gate;
  const baselineGate = pair.baselineQualityGate || evidence.runs?.baseline?.qualityGate;
  const fooksGate = pair.fooksQualityGate || evidence.runs?.fooks?.qualityGate;

  const hasSideGates = baselineGate || fooksGate;
  const passed = hasSideGates
    ? qualityGatePassed(baselineGate) && qualityGatePassed(fooksGate)
    : qualityGatePassed(pairGate || evidenceGate);

  return {
    passed,
    evidenceGate: normalizeQualityGate(pairGate || evidenceGate),
    baselineGate: normalizeQualityGate(baselineGate),
    fooksGate: normalizeQualityGate(fooksGate),
    reasons: passed ? [] : ['quality gate is missing, usage-smoke, or failed'],
  };
}

function normalizePairEvidence(pairInput, index) {
  const pair = isObject(pairInput) ? pairInput : { evidencePath: String(pairInput) };
  const evidence = pair.evidence || (pair.evidencePath ? readJson(pair.evidencePath) : pair);
  const pairId = stableValue(pair.pairId || pair.id || evidence.pairId || evidence.runId || `pair-${index + 1}`);
  const taskClass = stableValue(
    pair.taskClass
      || pair.taskId
      || pair.taskIdentity
      || evidence.taskClass
      || evidence.taskId
      || evidence.taskIdentity
      || evidence.runs?.baseline?.taskClass
      || evidence.runs?.baseline?.taskIdentity,
  );
  const model = stableValue(pair.model || evidence.model || evidence.runs?.baseline?.model);
  const provider = stableValue(pair.provider || evidence.provider || evidence.runs?.baseline?.provider);
  const setupIdentity = stableValue(pair.setupIdentity || evidence.setupIdentity || evidence.runs?.baseline?.setupIdentity || 'default');
  const endpoint = stableValue(pair.endpoint || evidence.endpoint || evidence.pricingAssumption?.endpoint || evidence.runs?.baseline?.endpoint);
  const serviceTier = stableValue(pair.serviceTier || pair.service_tier || evidence.serviceTier || evidence.pricingAssumption?.serviceTier);
  const reasoning = stableValue(pair.reasoning || evidence.reasoning || evidence.runs?.baseline?.reasoning);
  const maxOutputTokens = finiteNumber(pair.maxOutputTokens || evidence.maxOutputTokens || evidence.runs?.baseline?.maxOutputTokens);
  const sourceKind = evidence.sourceKind || pair.sourceKind || 'fixture';
  const totalDelta = finiteNumber(evidence.deltas?.estimatedApiCostTotal?.absolute);
  const reductionPct = finiteNumber(evidence.deltas?.estimatedApiCostTotal?.reductionPct);
  const status = evidence.status || 'unknown';
  const usageAvailable = status !== 'inconclusive'
    && totalDelta !== null
    && evidence.runs?.baseline?.estimatedApiCost?.total !== null
    && evidence.runs?.fooks?.estimatedApiCost?.total !== null;
  const quality = pairQualityGateStatus(pair, evidence);
  const accepted = usageAvailable && quality.passed;
  const identity = { provider, model, setupIdentity, endpoint, serviceTier, reasoning, maxOutputTokens };

  return {
    pairId,
    pairIndex: index + 1,
    taskClass,
    sourceKind,
    eligibleLaunchProvenance: ELIGIBLE_LAUNCH_PROVENANCE.has(sourceKind),
    fixtureProvenance: FIXTURE_PROVENANCE.has(sourceKind),
    accepted,
    status,
    statusReasons: Array.isArray(evidence.statusReasons) ? evidence.statusReasons : [],
    qualityGate: quality,
    identity,
    deltas: {
      estimatedApiCostTotal: {
        absolute: totalDelta,
        reductionPct,
      },
      estimatedApiCostInput: evidence.deltas?.estimatedApiCostInput || null,
      estimatedApiCostOutput: evidence.deltas?.estimatedApiCostOutput || null,
    },
    pricingAssumption: evidence.pricingAssumption || {},
    cachedInputTokens: (finiteNumber(evidence.runs?.baseline?.cachedInputTokens) || 0)
      + (finiteNumber(evidence.runs?.fooks?.cachedInputTokens) || 0),
    evidencePath: pair.evidencePath ? path.relative(process.cwd(), path.resolve(pair.evidencePath)).split(path.sep).join('/') : null,
  };
}

function identityKey(identity) {
  return JSON.stringify({
    provider: identity.provider,
    model: identity.model,
    setupIdentity: identity.setupIdentity,
    endpoint: identity.endpoint,
    serviceTier: identity.serviceTier,
    reasoning: identity.reasoning,
    maxOutputTokens: identity.maxOutputTokens,
  });
}

function pricingIssuesForPair(pair) {
  const pricing = pair.pricingAssumption || {};
  const reasons = [];
  if (!pricing.sourceUrl && !pricing.source_url) reasons.push(`${pair.pairId}: pricing source URL missing`);
  if (!pricing.checkedDate && !pricing.checked_date) reasons.push(`${pair.pairId}: pricing checked date missing`);
  if (finiteNumber(pricing.inputPer1MTokens ?? pricing.input_per_1m_tokens) === null) reasons.push(`${pair.pairId}: input pricing rate missing`);
  if (finiteNumber(pricing.outputPer1MTokens ?? pricing.output_per_1m_tokens) === null) reasons.push(`${pair.pairId}: output pricing rate missing`);

  const cachedTokens = pair.cachedInputTokens
    || finiteNumber(pair.pricingAssumption?.cachedInputTokens)
    || finiteNumber(pair.pricingAssumption?.cached_input_tokens)
    || 0;
  if (cachedTokens > 0 && finiteNumber(pricing.cachedInputPer1MTokens ?? pricing.cached_input_per_1m_tokens) === null) {
    reasons.push(`${pair.pairId}: cached input tokens present but cached input rate missing`);
  }

  if (!pair.identity.endpoint) reasons.push(`${pair.pairId}: endpoint missing`);
  if (!pair.identity.serviceTier) reasons.push(`${pair.pairId}: service tier missing`);
  const treatment = pricing.pricingTreatment || pricing.pricing_treatment || {};
  const hasLongContext = Object.prototype.hasOwnProperty.call(treatment, 'longContextApplies')
    || Object.prototype.hasOwnProperty.call(treatment, 'long_context_applies');
  const hasRegional = Object.prototype.hasOwnProperty.call(treatment, 'regionalProcessingApplies')
    || Object.prototype.hasOwnProperty.call(treatment, 'regional_processing_applies');
  if (!hasLongContext) reasons.push(`${pair.pairId}: long-context pricing treatment unknown`);
  if (!hasRegional) reasons.push(`${pair.pairId}: regional/data-residency pricing treatment unknown`);
  return reasons;
}

function normalizeLedger(ledger, pairs) {
  if (!isObject(ledger)) {
    return {
      present: false,
      plannedPairCount: null,
      attemptedPairCount: pairs.length,
      acceptedPairCount: pairs.filter((pair) => pair.accepted).length,
      failedPairCount: pairs.filter((pair) => !pair.accepted).length,
      rejectedPairCount: 0,
      missingUsagePairCount: pairs.filter((pair) => pair.status === 'inconclusive').length,
      neutralPairCount: pairs.filter((pair) => pair.accepted && pair.deltas.estimatedApiCostTotal.absolute === 0).length,
      regressedPairCount: pairs.filter((pair) => pair.accepted && pair.deltas.estimatedApiCostTotal.absolute < 0).length,
      omittedPairs: [],
      reasons: ['campaign attempted-pair ledger is missing'],
    };
  }

  const attemptedPairs = Array.isArray(ledger.attemptedPairs) ? ledger.attemptedPairs : [];
  const plannedPairCount = Number(ledger.plannedPairCount ?? ledger.planned_pair_count ?? (attemptedPairs.length || pairs.length));
  const attemptedPairCount = Number(ledger.attemptedPairCount ?? ledger.attempted_pair_count ?? (attemptedPairs.length || pairs.length));
  const acceptedPairCount = Number(ledger.acceptedPairCount ?? ledger.accepted_pair_count ?? pairs.filter((pair) => pair.accepted).length);
  const failedPairCount = Number(ledger.failedPairCount ?? ledger.failed_pair_count ?? pairs.filter((pair) => !pair.accepted).length);
  const rejectedPairCount = Number(ledger.rejectedPairCount ?? ledger.rejected_pair_count ?? 0);
  const missingUsagePairCount = Number(ledger.missingUsagePairCount ?? ledger.missing_usage_pair_count ?? pairs.filter((pair) => pair.status === 'inconclusive').length);
  const neutralPairCount = Number(ledger.neutralPairCount ?? ledger.neutral_pair_count ?? pairs.filter((pair) => pair.accepted && pair.deltas.estimatedApiCostTotal.absolute === 0).length);
  const regressedPairCount = Number(ledger.regressedPairCount ?? ledger.regressed_pair_count ?? pairs.filter((pair) => pair.accepted && pair.deltas.estimatedApiCostTotal.absolute < 0).length);
  const omittedPairs = Array.isArray(ledger.omittedPairs) ? ledger.omittedPairs : [];
  const reasons = [];

  if (!Number.isFinite(plannedPairCount)) reasons.push('ledger planned pair count is missing');
  if (!Number.isFinite(attemptedPairCount)) reasons.push('ledger attempted pair count is missing');
  if (attemptedPairCount < pairs.length) reasons.push('ledger attempted pair count is less than imported pair count');
  if (acceptedPairCount > attemptedPairCount) reasons.push('ledger accepted pair count exceeds attempted pair count');
  if (plannedPairCount < attemptedPairCount) reasons.push('ledger planned pair count is less than attempted pair count');

  return {
    present: true,
    plannedPairCount,
    attemptedPairCount,
    acceptedPairCount,
    failedPairCount,
    rejectedPairCount,
    missingUsagePairCount,
    neutralPairCount,
    regressedPairCount,
    omittedPairs,
    attemptedPairs,
    reasons,
  };
}

function summarizeByTask(pairs, requiredAcceptedPairsPerTask) {
  const byTask = new Map();
  for (const pair of pairs) {
    const key = pair.taskClass || 'unknown-task';
    if (!byTask.has(key)) byTask.set(key, []);
    byTask.get(key).push(pair);
  }

  return Array.from(byTask.entries()).map(([taskClass, taskPairs]) => {
    const acceptedPairs = taskPairs.filter((pair) => pair.accepted);
    const positiveAcceptedPairs = acceptedPairs.filter((pair) => pair.deltas.estimatedApiCostTotal.absolute > 0);
    const reductions = acceptedPairs.map((pair) => pair.deltas.estimatedApiCostTotal.reductionPct).filter(Number.isFinite);
    const totalDeltas = acceptedPairs.map((pair) => pair.deltas.estimatedApiCostTotal.absolute).filter(Number.isFinite);
    const identityKeys = [...new Set(acceptedPairs.map((pair) => identityKey(pair.identity)))];
    const missingIdentity = acceptedPairs.some((pair) => !pair.taskClass || !pair.identity.model || !pair.identity.setupIdentity);
    return {
      taskClass,
      attemptedPairCount: taskPairs.length,
      acceptedPairCount: acceptedPairs.length,
      positiveAcceptedPairCount: positiveAcceptedPairs.length,
      regressedPairCount: acceptedPairs.filter((pair) => pair.deltas.estimatedApiCostTotal.absolute < 0).length,
      neutralPairCount: acceptedPairs.filter((pair) => pair.deltas.estimatedApiCostTotal.absolute === 0).length,
      requiredAcceptedPairs: requiredAcceptedPairsPerTask,
      medianEstimatedApiCostReductionPct: median(reductions),
      medianEstimatedApiCostDelta: roundMoney(median(totalDeltas)),
      positiveMedian: median(totalDeltas) !== null && median(totalDeltas) > 0,
      identity: {
        mixed: identityKeys.length > 1,
        missing: missingIdentity,
        keys: identityKeys,
      },
      pairs: taskPairs.map((pair) => ({
        pairId: pair.pairId,
        accepted: pair.accepted,
        sourceKind: pair.sourceKind,
        status: pair.status,
        qualityGatePassed: pair.qualityGate.passed,
        estimatedApiCostDelta: pair.deltas.estimatedApiCostTotal.absolute,
        estimatedApiCostReductionPct: pair.deltas.estimatedApiCostTotal.reductionPct,
      })),
    };
  });
}

function buildDiagnostics({ statusReasons, taskSummaries, requiredTaskClasses, requiredAcceptedPairsPerTask, capState }) {
  const recommendations = [];
  if (statusReasons.some((reason) => /pricing/i.test(reason))) recommendations.push('Resolve current model pricing assumptions before treating cost deltas as launch-grade evidence.');
  if (statusReasons.some((reason) => /quality gate/i.test(reason))) recommendations.push('Attach a non-usage-smoke quality gate per task class and record baseline/fooks pass status.');
  if (statusReasons.some((reason) => /ledger|manifest|cherry/i.test(reason))) recommendations.push('Use a campaign manifest and attempted-pair ledger so failed, omitted, neutral, and regressed pairs stay in the denominator.');
  if (taskSummaries.length < requiredTaskClasses) recommendations.push(`Add task classes: ${taskSummaries.length}/${requiredTaskClasses} represented.`);
  for (const task of taskSummaries) {
    if (task.acceptedPairCount < requiredAcceptedPairsPerTask) recommendations.push(`${task.taskClass}: collect accepted pairs ${task.acceptedPairCount}/${requiredAcceptedPairsPerTask}.`);
    if (!task.positiveMedian && task.acceptedPairCount > 0) recommendations.push(`${task.taskClass}: diagnose negative/neutral median estimated-cost result before rerunning.`);
    if (task.identity.mixed || task.identity.missing) recommendations.push(`${task.taskClass}: normalize task/model/setup identity before aggregation.`);
  }
  if (capState && capState.blocked) recommendations.push('Increase campaign budget explicitly or use validated imports; default capped live smoke cannot reach launch-grade threshold.');
  if (recommendations.length === 0) recommendations.push('No diagnostic recommendation; threshold appears satisfied for the reported classification.');
  return recommendations;
}

function summarizeProviderCostCampaign(input = {}) {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const runId = input.runId || input.campaignManifest?.campaignId || input.campaignManifest?.runId || null;
  const requiredTaskClasses = Number(input.requiredTaskClasses || input.campaignManifest?.requiredTaskClasses || DEFAULT_REQUIRED_TASK_CLASSES);
  const requiredAcceptedPairsPerTask = Number(
    input.requiredAcceptedPairsPerTask
      || input.campaignManifest?.requiredAcceptedPairsPerTask
      || DEFAULT_REQUIRED_ACCEPTED_PAIRS_PER_TASK,
  );
  const manifest = isObject(input.campaignManifest) ? input.campaignManifest : null;
  const manifestTasks = normalizeTaskClasses(manifest);
  const pairs = toArray(input.pairEvidence || input.pairs).map(normalizePairEvidence);
  const ledger = normalizeLedger(input.attemptedPairLedger || input.ledger, pairs);
  const taskSummaries = summarizeByTask(pairs, requiredAcceptedPairsPerTask);
  const acceptedPairs = pairs.filter((pair) => pair.accepted);
  const acceptedEligiblePairs = acceptedPairs.filter((pair) => pair.eligibleLaunchProvenance);
  const acceptedFixturePairs = acceptedPairs.filter((pair) => pair.fixtureProvenance);
  const allAcceptedFixture = acceptedPairs.length > 0 && acceptedFixturePairs.length === acceptedPairs.length;
  const representedPassingTasks = taskSummaries.filter((task) => task.acceptedPairCount >= requiredAcceptedPairsPerTask);
  const positivePassingTasks = representedPassingTasks.filter((task) => task.positiveMedian);
  const overallMedianDelta = median(acceptedPairs.map((pair) => pair.deltas.estimatedApiCostTotal.absolute));
  const overallMedianReductionPct = median(acceptedPairs.map((pair) => pair.deltas.estimatedApiCostTotal.reductionPct));

  const statusReasons = [];
  if (!manifest) statusReasons.push('campaign manifest is missing');
  if (manifest && manifestTasks.length < requiredTaskClasses) statusReasons.push(`campaign manifest task classes ${manifestTasks.length}/${requiredTaskClasses}`);
  for (const task of manifestTasks) {
    if (!task.qualityGate || !task.qualityGate.id) statusReasons.push(`${task.id}: quality gate declaration missing`);
    if (task.qualityGate?.id === 'usage-smoke') statusReasons.push(`${task.id}: usage-smoke quality gate cannot count toward launch-grade`);
  }
  statusReasons.push(...ledger.reasons);
  if (pairs.length === 0) statusReasons.push('no pair evidence provided');
  if (acceptedPairs.length === 0 && pairs.length > 0) statusReasons.push('no accepted provider-cost pairs');

  const missingUsagePairs = pairs.filter((pair) => pair.status === 'inconclusive');
  if (missingUsagePairs.length > 0) statusReasons.push(`missing or inconclusive provider usage pairs: ${missingUsagePairs.length}`);

  const taskClassesRepresented = taskSummaries.filter((task) => task.acceptedPairCount > 0).length;
  if (taskClassesRepresented < requiredTaskClasses) statusReasons.push(`accepted task classes ${taskClassesRepresented}/${requiredTaskClasses}`);
  for (const task of taskSummaries) {
    if (task.acceptedPairCount < requiredAcceptedPairsPerTask) statusReasons.push(`${task.taskClass}: accepted pairs ${task.acceptedPairCount}/${requiredAcceptedPairsPerTask}`);
    if (task.identity.missing) statusReasons.push(`${task.taskClass}: missing model/setup/task identity`);
    if (task.identity.mixed) statusReasons.push(`${task.taskClass}: mixed identity within accepted pairs`);
    if (!task.positiveMedian && task.acceptedPairCount >= requiredAcceptedPairsPerTask) statusReasons.push(`${task.taskClass}: median estimated API cost delta is not positive`);
  }

  const pricingQualityReasons = acceptedEligiblePairs.flatMap(pricingIssuesForPair);
  statusReasons.push(...pricingQualityReasons);
  const qualityGateFailedPairs = pairs.filter((pair) => !pair.qualityGate.passed);
  if (qualityGateFailedPairs.length > 0) statusReasons.push(`quality gate failed or missing for ${qualityGateFailedPairs.length} pair(s)`);

  const mixedIdentity = taskSummaries.some((task) => task.identity.mixed);
  const missingIdentity = taskSummaries.some((task) => task.identity.missing);
  const thresholdShapeMet = representedPassingTasks.length >= requiredTaskClasses
    && positivePassingTasks.length >= requiredTaskClasses
    && overallMedianDelta !== null
    && overallMedianDelta > 0
    && !mixedIdentity
    && !missingIdentity;
  const eligibleLaunchShape = thresholdShapeMet
    && acceptedEligiblePairs.length === acceptedPairs.length
    && manifest
    && ledger.present
    && ledger.reasons.length === 0
    && pricingQualityReasons.length === 0
    && qualityGateFailedPairs.length === 0
    && manifestTasks.length >= requiredTaskClasses;

  let status = 'diagnostic-only';
  if (pairs.length === 0) {
    status = 'diagnostic-only';
  } else if (mixedIdentity) {
    status = 'mixed-identity';
  } else if (missingUsagePairs.length > 0) {
    status = 'missing-usage';
  } else if (allAcceptedFixture && thresholdShapeMet) {
    status = 'fixture-launch-grade-mechanics';
  } else if (eligibleLaunchShape) {
    status = 'launch-grade-estimated-cost-evidence';
  } else if (representedPassingTasks.length >= 1 && positivePassingTasks.length >= 1 && overallMedianDelta > 0) {
    status = 'narrow-estimated-cost-candidate';
  } else if (acceptedPairs.length < requiredAcceptedPairsPerTask || taskClassesRepresented < requiredTaskClasses) {
    status = 'insufficient-accepted-pairs';
  }

  const launchGrade = status === 'launch-grade-estimated-cost-evidence';
  const summary = {
    schemaVersion: SCHEMA_VERSION,
    claimBoundary: CLAIM_BOUNDARY,
    generatedAt,
    runId,
    status,
    statusReasons: launchGrade ? [] : statusReasons,
    requiredTaskClasses,
    requiredAcceptedPairsPerTask,
    campaignManifest: manifest ? {
      campaignId: manifest.campaignId || manifest.runId || runId,
      model: manifest.model || null,
      endpoint: manifest.endpoint || null,
      serviceTier: manifest.serviceTier || manifest.service_tier || null,
      pricingSourceUrl: manifest.pricingSourceUrl || manifest.pricing_source_url || null,
      pricingCheckedDate: manifest.pricingCheckedDate || manifest.pricing_checked_date || null,
      taskClasses: manifestTasks,
      caps: manifest.caps || null,
    } : null,
    attemptedPairLedger: ledger,
    counts: {
      plannedPairCount: ledger.plannedPairCount,
      attemptedPairCount: ledger.attemptedPairCount,
      importedPairCount: pairs.length,
      acceptedPairCount: acceptedPairs.length,
      acceptedEligibleLaunchPairCount: acceptedEligiblePairs.length,
      acceptedFixturePairCount: acceptedFixturePairs.length,
      failedPairCount: ledger.failedPairCount,
      rejectedPairCount: ledger.rejectedPairCount,
      missingUsagePairCount: ledger.missingUsagePairCount,
      neutralPairCount: ledger.neutralPairCount,
      regressedPairCount: ledger.regressedPairCount,
    },
    distributions: {
      estimatedApiCostDelta: acceptedPairs.map((pair) => pair.deltas.estimatedApiCostTotal.absolute).filter(Number.isFinite),
      estimatedApiCostReductionPct: acceptedPairs.map((pair) => pair.deltas.estimatedApiCostTotal.reductionPct).filter(Number.isFinite),
    },
    medians: {
      estimatedApiCostDelta: roundMoney(overallMedianDelta),
      estimatedApiCostReductionPct: overallMedianReductionPct,
    },
    taskSummaries,
    pairs,
    diagnostics: buildDiagnostics({ statusReasons, taskSummaries, requiredTaskClasses, requiredAcceptedPairsPerTask, capState: input.capState }),
    claimability: {
      estimatedApiCostPositiveEvidence: launchGrade,
      estimatedApiCostDelta: launchGrade,
      providerInvoiceOrBillingSavings: false,
      providerBillingTokenSavings: false,
      stableRuntimeTokenSavings: false,
      stableTimeOrLatencySavings: false,
    },
    claimBoundaryNotes: [
      'This summary can only unlock estimated API cost positive evidence when campaign-level thresholds pass.',
      'It is not provider invoice, dashboard, charge, or billing-grade savings evidence.',
      'It does not establish stable runtime-token, wall-clock, or latency savings.',
      'Fixture mechanics can validate threshold logic but cannot unlock public-positive claimability.',
    ],
  };

  return summary;
}

function shouldStartNextPair({
  currentBatchEstimatedUsd = 0,
  currentCampaignEstimatedUsd = 0,
  nextWorstCaseEstimatedUsd = 0,
  maxEstimatedUsd = 5,
  campaignMaxEstimatedUsd = maxEstimatedUsd,
  attemptedMatchedPairs = 0,
  maxMatchedPairs = 10,
} = {}) {
  const reasons = [];
  const next = Number(nextWorstCaseEstimatedUsd);
  const batch = Number(currentBatchEstimatedUsd);
  const campaign = Number(currentCampaignEstimatedUsd);
  if (!Number.isFinite(next) || next < 0) reasons.push('next worst-case estimate is invalid');
  if (Number.isFinite(maxMatchedPairs) && attemptedMatchedPairs >= maxMatchedPairs) reasons.push('matched pair cap reached');
  if (Number.isFinite(maxEstimatedUsd) && batch + next > maxEstimatedUsd) reasons.push('batch estimated spend cap would be exceeded');
  if (Number.isFinite(campaignMaxEstimatedUsd) && campaign + next > campaignMaxEstimatedUsd) reasons.push('campaign estimated spend cap would be exceeded');
  return {
    allowed: reasons.length === 0,
    reasons,
    projectedBatchEstimatedUsd: roundMoney(Number.isFinite(batch + next) ? batch + next : null),
    projectedCampaignEstimatedUsd: roundMoney(Number.isFinite(campaign + next) ? campaign + next : null),
  };
}

function renderProviderCostCampaignMarkdown(summary) {
  return [
    '# Provider cost repeated campaign summary',
    '',
    `- Schema: \`${summary.schemaVersion}\``,
    `- Status: \`${summary.status}\``,
    `- Claim boundary: \`${summary.claimBoundary}\``,
    `- Accepted pairs: ${summary.counts.acceptedPairCount}/${summary.counts.attemptedPairCount}`,
    `- Median estimated API cost delta: ${summary.medians.estimatedApiCostDelta ?? 'n/a'}`,
    `- Median estimated API cost reduction: ${summary.medians.estimatedApiCostReductionPct ?? 'n/a'}%`,
    '',
    '## Claimability',
    '',
    `- Estimated API cost positive evidence: ${summary.claimability.estimatedApiCostPositiveEvidence}`,
    '- Provider invoice/billing savings: false',
    '- Stable runtime-token/time savings: false',
    '',
    '## Task summaries',
    '',
    ...summary.taskSummaries.map((task) => `- ${task.taskClass}: accepted ${task.acceptedPairCount}/${task.requiredAcceptedPairs}, median cost delta ${task.medianEstimatedApiCostDelta ?? 'n/a'}`),
    '',
    '## Diagnostics',
    '',
    ...summary.diagnostics.map((item) => `- ${item}`),
    '',
  ].join('\n');
}

function writeProviderCostCampaignSummary({ outputPath, markdownPath, summary }) {
  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
  }
  if (markdownPath) {
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderProviderCostCampaignMarkdown(summary));
  }
}

module.exports = {
  SCHEMA_VERSION,
  CLAIM_BOUNDARY,
  ELIGIBLE_LAUNCH_PROVENANCE,
  FIXTURE_PROVENANCE,
  summarizeProviderCostCampaign,
  shouldStartNextPair,
  renderProviderCostCampaignMarkdown,
  writeProviderCostCampaignSummary,
};
