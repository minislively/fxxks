'use strict';

const CLAIM_BOUNDARY = 'estimated-api-cost-only';
const EVIDENCE_TIER = 'L2-provider-usage-estimated-cost';
const SCHEMA_VERSION = 'provider-cost-evidence.v1';
const VALID_SOURCE_KINDS = new Set([
  'fixture',
  'fixture-mechanics',
  'validated-provider-import',
  'live-openai-usage',
]);

const DEFAULT_PRICING_SOURCE_URL = 'https://openai.com/api/pricing/';
const DEFAULT_PRICING_CHECKED_DATE = '2026-04-22';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNonNegativeNumber(value) {
  if (typeof value === 'string' && value.trim() !== '') value = Number(value);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function firstFiniteNonNegative(...values) {
  for (const value of values) {
    const normalized = finiteNonNegativeNumber(value);
    if (normalized !== null) return normalized;
  }
  return null;
}

function hasProviderUsageTokens(usage) {
  return firstFiniteNonNegative(usage.prompt_tokens, usage.input_tokens) !== null
    && firstFiniteNonNegative(usage.completion_tokens, usage.output_tokens) !== null;
}

function usageInputDetails(usage) {
  return isObject(usage.input_tokens_details) ? usage.input_tokens_details : {};
}

function usageOutputDetails(usage) {
  return isObject(usage.output_tokens_details) ? usage.output_tokens_details : {};
}

function unusableArtifactStatus(status) {
  return [
    'failed',
    'error',
    'implementation-in-progress',
    'usage-unavailable',
  ].includes(status);
}

function normalizeUsageArtifact(artifact, role = 'run', options = {}) {
  const sourceKind = options.sourceKind || 'fixture';
  if (!isObject(artifact)) {
    return {
      role,
      status: 'invalid-artifact',
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      reasons: [`${role} artifact is not an object`],
    };
  }

  const usage = isObject(artifact.usage) ? artifact.usage : {};
  const metrics = isObject(artifact.metrics) ? artifact.metrics : {};
  const artifactStatus = artifact.status || null;
  const providerEvidenceSource = sourceKind === 'live-openai-usage' || sourceKind === 'validated-provider-import';
  const sourceMatches = artifact.usageSource === sourceKind
    || artifact.usageSource === 'live-openai-usage'
    || artifact.usageSource === 'validated-provider-import';
  const liveProviderUsageAvailable = sourceMatches || hasProviderUsageTokens(usage);

  const inputCandidates = providerEvidenceSource
    ? [artifact.inputTokens, artifact.promptTokens, artifact.prompt_tokens, usage.prompt_tokens, usage.input_tokens]
    : [
        artifact.inputTokens,
        artifact.promptTokens,
        artifact.prompt_tokens,
        usage.prompt_tokens,
        usage.input_tokens,
        metrics.inputTokens,
        metrics.promptTokens,
        metrics.promptTokensApprox,
      ];
  const outputCandidates = providerEvidenceSource
    ? [artifact.outputTokens, artifact.completionTokens, artifact.completion_tokens, usage.completion_tokens, usage.output_tokens]
    : [
        artifact.outputTokens,
        artifact.completionTokens,
        artifact.completion_tokens,
        usage.completion_tokens,
        usage.output_tokens,
        metrics.outputTokens,
        metrics.completionTokens,
      ];

  const inputTokens = firstFiniteNonNegative(...inputCandidates);
  const outputTokens = firstFiniteNonNegative(...outputCandidates);
  const totalTokens = firstFiniteNonNegative(
    artifact.totalTokens,
    artifact.total_tokens,
    usage.total_tokens,
    inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null,
  );
  const cachedInputTokens = firstFiniteNonNegative(
    artifact.cachedInputTokens,
    artifact.cached_input_tokens,
    usageInputDetails(usage).cached_tokens,
  );
  const reasoningOutputTokens = firstFiniteNonNegative(
    artifact.reasoningOutputTokens,
    artifact.reasoning_output_tokens,
    usageOutputDetails(usage).reasoning_tokens,
  );

  const reasons = [];
  if (unusableArtifactStatus(artifactStatus)) reasons.push(`${role} artifact status is not usable: ${artifactStatus}`);
  if (providerEvidenceSource && !liveProviderUsageAvailable) {
    reasons.push(sourceKind === 'live-openai-usage'
      ? `${role} artifact lacks live provider usage provenance`
      : `${role} artifact lacks validated provider usage provenance`);
  }
  if (inputTokens === null) reasons.push(`${role} input tokens are missing`);
  if (outputTokens === null) reasons.push(`${role} output tokens are missing`);

  return {
    role,
    status: reasons.length ? 'incomplete-usage' : 'usage-available',
    artifactStatus,
    usageSource: artifact.usageSource || (hasProviderUsageTokens(usage) ? 'provider-usage-object' : null),
    provider: artifact.provider || usage.provider || null,
    model: artifact.model || usage.model || null,
    timestamp: artifact.timestamp || null,
    runId: artifact.runId || artifact.id || null,
    inputTokens,
    outputTokens,
    totalTokens,
    cachedInputTokens,
    reasoningOutputTokens,
    taskClass: artifact.taskClass || artifact.taskId || artifact.taskIdentity || null,
    taskIdentity: artifact.taskIdentity || artifact.taskClass || artifact.taskId || null,
    setupIdentity: artifact.setupIdentity || null,
    endpoint: artifact.endpoint || null,
    serviceTier: artifact.serviceTier || artifact.service_tier || null,
    reasoning: artifact.reasoning || null,
    maxOutputTokens: firstFiniteNonNegative(artifact.maxOutputTokens, artifact.max_output_tokens),
    qualityGate: artifact.qualityGate || artifact.quality_gate || null,
    reasons,
  };
}

function normalizePricingAssumption(pricing = {}, artifacts = []) {
  const provider = pricing.provider || artifacts.find((artifact) => artifact.provider)?.provider || null;
  const model = pricing.model || artifacts.find((artifact) => artifact.model)?.model || null;
  const inputPer1MTokens = firstFiniteNonNegative(pricing.inputPer1MTokens, pricing.input_per_1m_tokens);
  const outputPer1MTokens = firstFiniteNonNegative(pricing.outputPer1MTokens, pricing.output_per_1m_tokens);

  return {
    provider,
    model,
    currency: pricing.currency || 'USD',
    inputPer1MTokens,
    outputPer1MTokens,
    cachedInputPer1MTokens: firstFiniteNonNegative(pricing.cachedInputPer1MTokens, pricing.cached_input_per_1m_tokens),
    cacheCreationInputPer1MTokens: firstFiniteNonNegative(
      pricing.cacheCreationInputPer1MTokens,
      pricing.cache_creation_input_per_1m_tokens,
    ),
    sourceUrl: pricing.sourceUrl || pricing.source_url || DEFAULT_PRICING_SOURCE_URL,
    checkedDate: pricing.checkedDate || pricing.checked_date || DEFAULT_PRICING_CHECKED_DATE,
    pricingSourceKind: pricing.pricingSourceKind || pricing.pricing_source_kind || null,
    catalogModelKey: pricing.catalogModelKey || pricing.catalog_model_key || null,
    catalogMatchKind: pricing.catalogMatchKind || pricing.catalog_match_kind || null,
    catalogLookupReasons: Array.isArray(pricing.catalogLookupReasons) ? pricing.catalogLookupReasons : [],
    endpoint: pricing.endpoint || null,
    serviceTier: pricing.serviceTier || pricing.service_tier || null,
    pricingTreatment: isObject(pricing.pricingTreatment)
      ? pricing.pricingTreatment
      : isObject(pricing.pricing_treatment)
        ? pricing.pricing_treatment
        : null,
    note: pricing.note || 'Estimated API cost only; not an invoice, charge, or provider billing statement.',
  };
}

function estimatedCost(tokens, per1MTokens) {
  if (tokens === null || per1MTokens === null) return null;
  return (tokens / 1_000_000) * per1MTokens;
}

function roundMoney(value) {
  return value === null ? null : Number(value.toFixed(8));
}

function roundPct(value) {
  return value === null ? null : Number(value.toFixed(3));
}

function deltaReduction(baseline, fooks) {
  if (baseline === null || fooks === null) return { absolute: null, reductionPct: null };
  const absolute = baseline - fooks;
  return {
    absolute,
    reductionPct: baseline > 0 ? (absolute / baseline) * 100 : null,
  };
}

function normalizeSourceKind(sourceKind) {
  if (VALID_SOURCE_KINDS.has(sourceKind)) return { value: sourceKind, reasons: [] };
  return {
    value: 'invalid-source-kind',
    reasons: [`sourceKind must be one of: ${Array.from(VALID_SOURCE_KINDS).join(', ')}`],
  };
}

function withEstimatedCosts(run, pricing) {
  const cachedInputTokens = run.cachedInputTokens || 0;
  const standardInputTokens = run.inputTokens === null
    ? null
    : Math.max(run.inputTokens - cachedInputTokens, 0);
  const estimatedStandardInput = estimatedCost(standardInputTokens, pricing.inputPer1MTokens);
  const estimatedCachedInput = cachedInputTokens > 0
    ? estimatedCost(cachedInputTokens, pricing.cachedInputPer1MTokens)
    : 0;
  const estimatedApiCostInput = estimatedStandardInput === null || estimatedCachedInput === null
    ? null
    : estimatedStandardInput + estimatedCachedInput;
  const estimatedApiCostOutput = estimatedCost(run.outputTokens, pricing.outputPer1MTokens);
  const estimatedApiCostTotal = estimatedApiCostInput === null || estimatedApiCostOutput === null
    ? null
    : estimatedApiCostInput + estimatedApiCostOutput;

  return {
    ...run,
    estimatedApiCost: {
      input: roundMoney(estimatedApiCostInput),
      inputStandard: roundMoney(estimatedStandardInput),
      inputCached: roundMoney(estimatedCachedInput),
      output: roundMoney(estimatedApiCostOutput),
      total: roundMoney(estimatedApiCostTotal),
      currency: pricing.currency,
    },
  };
}

function tokenDelta(baseline, fooks) {
  const delta = deltaReduction(baseline, fooks);
  return { absolute: delta.absolute, reductionPct: roundPct(delta.reductionPct) };
}

function costDelta(baseline, fooks) {
  const delta = deltaReduction(baseline, fooks);
  return { absolute: roundMoney(delta.absolute), reductionPct: roundPct(delta.reductionPct) };
}

function compareRuns(baseline, fooks) {
  return {
    inputTokens: tokenDelta(baseline.inputTokens, fooks.inputTokens),
    outputTokens: tokenDelta(baseline.outputTokens, fooks.outputTokens),
    totalTokens: tokenDelta(baseline.totalTokens, fooks.totalTokens),
    estimatedApiCostInput: costDelta(baseline.estimatedApiCost.input, fooks.estimatedApiCost.input),
    estimatedApiCostOutput: costDelta(baseline.estimatedApiCost.output, fooks.estimatedApiCost.output),
    estimatedApiCostTotal: costDelta(baseline.estimatedApiCost.total, fooks.estimatedApiCost.total),
  };
}

function pricingReasons(pricing) {
  const reasons = [];
  if (!pricing.provider) reasons.push('pricing provider is missing');
  if (!pricing.model) reasons.push('pricing model is missing');
  if (pricing.inputPer1MTokens === null) reasons.push('pricing input rate is missing');
  if (pricing.outputPer1MTokens === null) reasons.push('pricing output rate is missing');
  if (Array.isArray(pricing.catalogLookupReasons)) reasons.push(...pricing.catalogLookupReasons);
  return reasons;
}

function evidenceStatus(baseline, fooks, deltas, additionalReasons = []) {
  const reasons = [...baseline.reasons, ...fooks.reasons, ...additionalReasons];
  if (reasons.length) return { status: 'inconclusive', reasons };
  if (baseline.totalTokens === 0 || baseline.estimatedApiCost.total === 0) {
    return { status: 'inconclusive', reasons: ['baseline usage tokens are zero, so reduction evidence is not meaningful'] };
  }
  const totalDelta = deltas.estimatedApiCostTotal.absolute;
  if (totalDelta === null) return { status: 'inconclusive', reasons: ['estimated total API cost delta is unavailable'] };
  if (totalDelta > 0) return { status: 'estimated-cost-reduction', reasons: [] };
  if (totalDelta < 0) return { status: 'estimated-cost-regression', reasons: [] };
  return { status: 'estimated-cost-neutral', reasons: [] };
}

function buildProviderCostEvidence({
  baselineArtifact,
  fooksArtifact,
  pricing = {},
  sourceKind = 'fixture',
  generatedAt = new Date().toISOString(),
  runId = null,
} = {}) {
  const sourceKindResult = normalizeSourceKind(sourceKind);
  const usageOptions = { sourceKind: sourceKindResult.value };
  const baselineUsage = normalizeUsageArtifact(baselineArtifact, 'baseline', usageOptions);
  const fooksUsage = normalizeUsageArtifact(fooksArtifact, 'fooks', usageOptions);
  const pricingAssumption = normalizePricingAssumption(pricing, [baselineUsage, fooksUsage]);
  const baseline = withEstimatedCosts(baselineUsage, pricingAssumption);
  const fooks = withEstimatedCosts(fooksUsage, pricingAssumption);
  const deltas = compareRuns(baseline, fooks);
  const status = evidenceStatus(
    baseline,
    fooks,
    deltas,
    [...sourceKindResult.reasons, ...pricingReasons(pricingAssumption)],
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    evidenceTier: EVIDENCE_TIER,
    claimBoundary: CLAIM_BOUNDARY,
    generatedAt,
    runId,
    sourceKind: sourceKindResult.value,
    status: status.status,
    statusReasons: status.reasons,
    provider: pricingAssumption.provider,
    model: pricingAssumption.model,
    pricingAssumption,
    runs: { baseline, fooks },
    deltas,
    claimability: {
      estimatedApiCostDelta: status.status !== 'inconclusive',
      providerInvoiceOrBillingSavings: false,
      providerBillingTokenSavings: false,
      stableRuntimeTokenSavings: false,
      stableTimeOrLatencySavings: false,
    },
    claimBoundaryNotes: [
      'This is estimated API cost evidence from provider usage tokens and pricing assumptions only.',
      'It is not provider invoice, dashboard, charge, or billing-grade savings evidence.',
      'It does not establish stable runtime-token, wall-clock, or latency savings.',
    ],
  };
}

function formatPct(value) {
  return value === null ? 'n/a' : `${value}%`;
}

function formatValue(value, suffix = '') {
  return value === null ? 'n/a' : `${value}${suffix}`;
}

function renderProviderCostEvidenceMarkdown(evidence) {
  const total = evidence.deltas.estimatedApiCostTotal;
  const token = evidence.deltas.totalTokens;
  const currency = evidence.pricingAssumption.currency;

  return [
    '# Provider usage estimated-cost evidence',
    '',
    `- Schema: \`${evidence.schemaVersion}\``,
    `- Tier: \`${evidence.evidenceTier}\``,
    `- Status: \`${evidence.status}\``,
    `- Claim boundary: \`${evidence.claimBoundary}\``,
    `- Source kind: \`${evidence.sourceKind}\``,
    `- Provider/model: \`${evidence.provider}/${evidence.model}\``,
    `- Pricing source: ${evidence.pricingAssumption.sourceUrl} (checked ${evidence.pricingAssumption.checkedDate})`,
    evidence.pricingAssumption.catalogModelKey
      ? `- Pricing catalog key: \`${evidence.pricingAssumption.catalogModelKey}\``
      : null,
    '',
    '## Estimated deltas',
    '',
    `- Total tokens reduction: ${formatPct(token.reductionPct)} (${formatValue(token.absolute, ' tokens')})`,
    `- Estimated total API cost reduction: ${formatPct(total.reductionPct)} (${formatValue(total.absolute, ` ${currency}`)})`,
    '',
    '## Claim boundary',
    '',
    '- This is estimated API cost evidence only.',
    '- This is not provider invoice/billing savings evidence.',
    '- This is not stable runtime-token, wall-clock, or latency savings evidence.',
    '',
  ].filter(Boolean).join('\n');
}

module.exports = {
  CLAIM_BOUNDARY,
  EVIDENCE_TIER,
  SCHEMA_VERSION,
  VALID_SOURCE_KINDS,
  normalizeUsageArtifact,
  normalizePricingAssumption,
  buildProviderCostEvidence,
  renderProviderCostEvidenceMarkdown,
};
