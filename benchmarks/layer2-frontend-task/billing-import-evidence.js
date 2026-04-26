#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { ensureEvidenceDir, evidencePaths, timestampRunId } = require('./evidence-paths');

const BILLING_IMPORT_SCHEMA_VERSION = 'billing-import-evidence.v1';
const BILLING_RECONCILIATION_SCHEMA_VERSION = 'billing-import-reconciliation.v1';
const CLAIM_BOUNDARY = 'billing-import-reconciliation-only';
const ALLOWED_SOURCE_TYPES = ['invoice', 'dashboard-export', 'usage-export', 'manual-entry'];
const BILLING_CLAIMABILITY = Object.freeze({
  providerInvoiceOrBillingSavings: false,
  providerBillingTokenSavings: false,
});

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

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function normalizeComparableString(value) {
  const normalized = nonEmptyString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function usageTotal(usage) {
  if (!isObject(usage)) return null;
  return firstFiniteNonNegative(
    usage.totalTokens,
    usage.total_tokens,
    usage.inputTokens !== null && usage.outputTokens !== null ? usage.inputTokens + usage.outputTokens : null,
  );
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function billingImportSchema() {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'fooks manual billing import evidence',
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'provider', 'period', 'source', 'claimability'],
    properties: {
      schemaVersion: { const: BILLING_IMPORT_SCHEMA_VERSION },
      provider: { type: 'string', minLength: 1 },
      account: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          projectId: { type: 'string' },
          redacted: { type: 'boolean' },
        },
      },
      period: {
        type: 'object',
        additionalProperties: false,
        required: ['start', 'end'],
        properties: {
          start: { type: 'string', description: 'Inclusive billing/usage period start date or timestamp' },
          end: { type: 'string', description: 'Exclusive billing/usage period end date or timestamp' },
        },
      },
      model: { type: 'string' },
      currency: { type: 'string', minLength: 3, maxLength: 3 },
      usage: {
        type: 'object',
        additionalProperties: false,
        properties: {
          inputTokens: { type: 'number', minimum: 0 },
          outputTokens: { type: 'number', minimum: 0 },
          cachedInputTokens: { type: 'number', minimum: 0 },
          cacheCreationInputTokens: { type: 'number', minimum: 0 },
        },
      },
      billedAmount: { type: 'number', minimum: 0 },
      source: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'timestamp'],
        properties: {
          type: {
            enum: ALLOWED_SOURCE_TYPES,
          },
          timestamp: { type: 'string' },
          redacted: { type: 'boolean' },
          note: { type: 'string' },
        },
      },
      claimability: {
        type: 'object',
        additionalProperties: false,
        required: ['providerInvoiceOrBillingSavings', 'providerBillingTokenSavings'],
        properties: {
          providerInvoiceOrBillingSavings: { const: false },
          providerBillingTokenSavings: { const: false },
        },
      },
    },
  };
}

function normalizeBillingUsage(usageInput) {
  const usage = isObject(usageInput) ? usageInput : {};
  const normalized = {
    inputTokens: firstFiniteNonNegative(usage.inputTokens, usage.input_tokens, usage.prompt_tokens),
    outputTokens: firstFiniteNonNegative(usage.outputTokens, usage.output_tokens, usage.completion_tokens),
    cachedInputTokens: firstFiniteNonNegative(usage.cachedInputTokens, usage.cached_input_tokens),
    cacheCreationInputTokens: firstFiniteNonNegative(usage.cacheCreationInputTokens, usage.cache_creation_input_tokens),
  };
  normalized.totalTokens = usageTotal({ ...usage, ...normalized });
  return normalized;
}

function normalizeBillingImportArtifact(artifact) {
  const errors = [];
  const warnings = [];

  if (!isObject(artifact)) {
    return {
      schemaVersion: BILLING_IMPORT_SCHEMA_VERSION,
      status: 'invalid',
      provider: null,
      account: null,
      period: { start: null, end: null },
      model: null,
      currency: null,
      usage: normalizeBillingUsage(null),
      billedAmount: null,
      source: { type: null, timestamp: null, redacted: null, note: null },
      claimability: { ...BILLING_CLAIMABILITY },
      errors: ['billing import artifact is not an object'],
      warnings,
    };
  }

  const period = isObject(artifact.period) ? artifact.period : {};
  const source = isObject(artifact.source) ? artifact.source : {};
  const usage = normalizeBillingUsage(artifact.usage);
  const provider = nonEmptyString(artifact.provider);
  const model = nonEmptyString(artifact.model);
  const sourceType = nonEmptyString(source.type);
  const sourceTimestamp = nonEmptyString(source.timestamp);
  const claimability = isObject(artifact.claimability) ? artifact.claimability : {};

  if (artifact.schemaVersion && artifact.schemaVersion !== BILLING_IMPORT_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${BILLING_IMPORT_SCHEMA_VERSION}`);
  }
  if (!provider) errors.push('provider is required');
  if (!nonEmptyString(period.start)) errors.push('period.start is required');
  if (!nonEmptyString(period.end)) errors.push('period.end is required');
  if (!sourceType) errors.push('source.type is required');
  else if (!ALLOWED_SOURCE_TYPES.includes(sourceType)) {
    errors.push(`source.type must be one of: ${ALLOWED_SOURCE_TYPES.join(', ')}`);
  }
  if (!sourceTimestamp) errors.push('source.timestamp is required');
  if (!model) warnings.push('model is missing; reconciliation can only compare provider-level evidence');
  if (usage.inputTokens === null && usage.outputTokens === null && usage.totalTokens === null) {
    warnings.push('billing usage tokens are missing; charged amount can be recorded but usage-token reconciliation is inconclusive');
  }
  if (finiteNonNegativeNumber(artifact.billedAmount) === null) {
    warnings.push('billedAmount is missing; actual charged amount cannot be reviewed beside estimated evidence');
  }
  if (claimability.providerInvoiceOrBillingSavings === true || claimability.providerBillingTokenSavings === true) {
    warnings.push('billing import claimability was force-disabled; imports do not prove savings by themselves');
  }

  return {
    schemaVersion: BILLING_IMPORT_SCHEMA_VERSION,
    status: errors.length ? 'invalid' : 'valid',
    provider,
    account: isObject(artifact.account) ? {
      id: nonEmptyString(artifact.account.id),
      projectId: nonEmptyString(artifact.account.projectId),
      redacted: artifact.account.redacted === true,
    } : null,
    period: {
      start: nonEmptyString(period.start),
      end: nonEmptyString(period.end),
    },
    model,
    currency: nonEmptyString(artifact.currency)?.toUpperCase() || null,
    usage,
    billedAmount: finiteNonNegativeNumber(artifact.billedAmount),
    source: {
      type: sourceType,
      timestamp: sourceTimestamp,
      redacted: source.redacted === true,
      note: nonEmptyString(source.note),
    },
    claimability: { ...BILLING_CLAIMABILITY },
    errors,
    warnings,
  };
}

function firstPair(summary) {
  return Array.isArray(summary?.pairs) && summary.pairs.length > 0 ? summary.pairs[0] : null;
}

function firstPairIdentity(summary) {
  const pair = firstPair(summary);
  return isObject(pair?.identity) ? pair.identity : {};
}

function normalizeEstimatedEvidence(evidence) {
  const errors = [];
  const warnings = [];
  if (!isObject(evidence)) {
    return {
      status: 'invalid',
      schemaVersion: null,
      evidenceKind: 'unknown',
      runId: null,
      provider: null,
      model: null,
      claimBoundary: null,
      evidenceStatus: null,
      sourceKind: null,
      pricingAssumption: null,
      estimatedApiCost: null,
      deltas: null,
      errors: ['estimated provider-cost evidence is not an object'],
      warnings,
    };
  }

  const identity = firstPairIdentity(evidence);
  const pricing = isObject(evidence.pricingAssumption)
    ? evidence.pricingAssumption
    : isObject(firstPair(evidence)?.pricingAssumption)
      ? firstPair(evidence).pricingAssumption
      : {};
  const manifest = isObject(evidence.campaignManifest) ? evidence.campaignManifest : {};
  const schemaVersion = nonEmptyString(evidence.schemaVersion);
  const evidenceKind = schemaVersion === 'provider-cost-repeated-summary.v1'
    ? 'campaign-summary'
    : schemaVersion === 'provider-cost-evidence.v1'
      ? 'pair-evidence'
      : 'unknown';
  const provider = nonEmptyString(evidence.provider || pricing.provider || identity.provider);
  const model = nonEmptyString(evidence.model || pricing.model || manifest.model || identity.model);
  const claimBoundary = nonEmptyString(evidence.claimBoundary);
  const sourceKinds = Array.isArray(evidence.pairs)
    ? Array.from(new Set(evidence.pairs.map((pair) => pair.sourceKind).filter(Boolean)))
    : [];

  if (!schemaVersion) errors.push('estimated evidence schemaVersion is missing');
  if (!provider) errors.push('estimated evidence provider is missing');
  if (!model) errors.push('estimated evidence model is missing');
  if (claimBoundary !== 'estimated-api-cost-only') {
    errors.push('estimated evidence must have estimated-api-cost-only claim boundary');
  }

  let estimatedApiCost = null;
  let deltas = null;
  if (evidenceKind === 'pair-evidence') {
    estimatedApiCost = {
      baseline: evidence.runs?.baseline?.estimatedApiCost?.total ?? null,
      fooks: evidence.runs?.fooks?.estimatedApiCost?.total ?? null,
      currency: evidence.pricingAssumption?.currency || null,
    };
    deltas = evidence.deltas?.estimatedApiCostTotal || null;
  } else if (evidenceKind === 'campaign-summary') {
    estimatedApiCost = {
      baseline: evidence.aggregate?.estimatedApiCost?.baseline ?? evidence.aggregate?.estimatedApiCostBaseline ?? null,
      fooks: evidence.aggregate?.estimatedApiCost?.fooks ?? evidence.aggregate?.estimatedApiCostFooks ?? null,
      currency: pricing.currency || null,
    };
    deltas = {
      absolute: evidence.medians?.estimatedApiCostDelta ?? null,
      reductionPct: evidence.medians?.estimatedApiCostReductionPct ?? null,
      aggregation: 'median',
    };
  } else {
    warnings.push('estimated evidence schema is not a recognized provider-cost pair or campaign summary schema');
  }

  if (!deltas || deltas.absolute === null || deltas.absolute === undefined || !Number.isFinite(Number(deltas.absolute))) {
    warnings.push('estimated API cost delta is missing or not numeric');
  }
  if (evidenceKind === 'campaign-summary' && estimatedApiCost.baseline === null && estimatedApiCost.fooks === null) {
    warnings.push('campaign summary does not include aggregate estimated baseline/fooks costs; median deltas remain reviewable');
  }

  return {
    status: errors.length ? 'invalid' : 'valid',
    schemaVersion,
    evidenceKind,
    runId: nonEmptyString(evidence.runId),
    provider,
    model,
    claimBoundary,
    evidenceStatus: nonEmptyString(evidence.status),
    sourceKind: nonEmptyString(evidence.sourceKind) || (sourceKinds.length ? sourceKinds.join(',') : null),
    pricingAssumption: {
      provider: nonEmptyString(pricing.provider),
      model: nonEmptyString(pricing.model),
      currency: nonEmptyString(pricing.currency),
      sourceUrl: nonEmptyString(pricing.sourceUrl || pricing.source_url || manifest.pricingSourceUrl),
      checkedDate: nonEmptyString(pricing.checkedDate || pricing.checked_date || manifest.pricingCheckedDate),
    },
    estimatedApiCost,
    deltas,
    errors,
    warnings,
  };
}

function check(id, label, status, detail) {
  return { id, label, status, detail };
}

function hasNumericEstimatedDelta(estimated) {
  return estimated.deltas
    && estimated.deltas.absolute !== null
    && estimated.deltas.absolute !== undefined
    && Number.isFinite(Number(estimated.deltas.absolute));
}

function buildBillingImportReconciliation({
  billingImportArtifact,
  estimatedEvidence,
  generatedAt = new Date().toISOString(),
  runId = null,
} = {}) {
  const billingImport = normalizeBillingImportArtifact(billingImportArtifact);
  const estimated = normalizeEstimatedEvidence(estimatedEvidence);
  const checks = [];

  checks.push(check(
    'billing-import-valid',
    'Billing import validates against the local import contract',
    billingImport.status === 'valid' ? 'pass' : 'fail',
    billingImport.errors.length ? billingImport.errors.join('; ') : 'required provider, period, source, and claimability fields are present',
  ));
  checks.push(check(
    'estimated-evidence-valid',
    'Estimated provider-cost evidence is recognized and estimate-scoped',
    estimated.status === 'valid' ? 'pass' : 'fail',
    estimated.errors.length ? estimated.errors.join('; ') : `${estimated.schemaVersion} / ${estimated.evidenceKind}`,
  ));

  const providerMatchable = billingImport.provider && estimated.provider;
  const providerMatches = providerMatchable && normalizeComparableString(billingImport.provider) === normalizeComparableString(estimated.provider);
  checks.push(check(
    'provider-match',
    'Billing provider matches estimated evidence provider',
    providerMatchable ? (providerMatches ? 'pass' : 'fail') : 'warn',
    providerMatchable ? `${billingImport.provider} vs ${estimated.provider}` : 'provider missing on one side',
  ));

  const modelMatchable = billingImport.model && estimated.model;
  const modelMatches = modelMatchable && normalizeComparableString(billingImport.model) === normalizeComparableString(estimated.model);
  checks.push(check(
    'model-match',
    'Billing model matches estimated evidence model',
    modelMatchable ? (modelMatches ? 'pass' : 'fail') : 'warn',
    modelMatchable ? `${billingImport.model} vs ${estimated.model}` : 'model missing on one side',
  ));

  const periodPresent = Boolean(billingImport.period.start && billingImport.period.end);
  checks.push(check(
    'billing-period-present',
    'Billing period is present',
    periodPresent ? 'pass' : 'fail',
    periodPresent ? `${billingImport.period.start} → ${billingImport.period.end}` : 'period.start and period.end are required',
  ));

  const billingUsagePresent = billingImport.usage.inputTokens !== null
    || billingImport.usage.outputTokens !== null
    || billingImport.usage.totalTokens !== null;
  checks.push(check(
    'billing-usage-present',
    'Billing import includes provider usage tokens',
    billingUsagePresent ? 'pass' : 'warn',
    billingUsagePresent ? `${billingImport.usage.totalTokens ?? 'n/a'} total tokens` : 'usage tokens missing',
  ));

  checks.push(check(
    'billed-amount-present',
    'Billing import includes actual billed amount',
    billingImport.billedAmount !== null ? 'pass' : 'warn',
    billingImport.billedAmount !== null ? `${billingImport.billedAmount} ${billingImport.currency || ''}`.trim() : 'billedAmount missing',
  ));

  checks.push(check(
    'redaction-recorded',
    'Source redaction state is recorded',
    billingImport.source.redacted === true || billingImport.account?.redacted === true ? 'info' : 'warn',
    billingImport.source.redacted === true || billingImport.account?.redacted === true
      ? 'source/account marked redacted'
      : 'artifact does not mark source/account as redacted',
  ));

  checks.push(check(
    'estimated-delta-present',
    'Estimated API cost delta remains available for side-by-side review',
    hasNumericEstimatedDelta(estimated) ? 'pass' : 'warn',
    estimated.deltas ? `${estimated.deltas.absolute} ${estimated.pricingAssumption.currency || ''}`.trim() : 'estimated delta missing',
  ));

  checks.push(check(
    'billing-claimability-blocked',
    'Billing/import claimability remains disabled',
    'pass',
    'providerInvoiceOrBillingSavings=false; providerBillingTokenSavings=false',
  ));

  const failed = checks.filter((item) => item.status === 'fail');
  const warned = checks.filter((item) => item.status === 'warn');
  let status = 'reconciliation-ready';
  if (billingImport.status === 'invalid' || estimated.status === 'invalid') status = 'invalid';
  else if (failed.length > 0) status = 'mismatch';
  else if (warned.length > 0) status = 'inconclusive';

  return {
    schemaVersion: BILLING_RECONCILIATION_SCHEMA_VERSION,
    claimBoundary: CLAIM_BOUNDARY,
    generatedAt,
    runId,
    status,
    statusReasons: failed.map((item) => item.detail),
    warnings: [
      ...billingImport.warnings,
      ...estimated.warnings,
      ...warned.map((item) => item.detail),
    ],
    billingImport,
    estimatedEvidence: estimated,
    checks,
    claimability: {
      ...BILLING_CLAIMABILITY,
      estimatedApiCostDelta: estimated.status === 'valid' && hasNumericEstimatedDelta(estimated),
    },
    claimBoundaryNotes: [
      'This artifact reconciles a local/redacted billing import with existing estimated API cost evidence for review only.',
      'It does not prove provider invoice/dashboard savings or actual charged-cost savings.',
      'It does not prove provider usage/billing-token savings.',
      'It does not collect provider credentials or call billing dashboards/APIs.',
    ],
  };
}

function formatValue(value, fallback = 'n/a') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function renderBillingReconciliationMarkdown(reconciliation) {
  const billing = reconciliation.billingImport;
  const estimated = reconciliation.estimatedEvidence;
  return [
    '# Billing import reconciliation evidence',
    '',
    `- Schema: \`${reconciliation.schemaVersion}\``,
    `- Status: \`${reconciliation.status}\``,
    `- Claim boundary: \`${reconciliation.claimBoundary}\``,
    `- Billing source: \`${formatValue(billing.source.type)}\` at \`${formatValue(billing.source.timestamp)}\``,
    `- Provider/model: billing \`${formatValue(billing.provider)}/${formatValue(billing.model)}\` vs estimated \`${formatValue(estimated.provider)}/${formatValue(estimated.model)}\``,
    `- Billing period: \`${formatValue(billing.period.start)}\` → \`${formatValue(billing.period.end)}\``,
    `- Billing amount: \`${formatValue(billing.billedAmount)} ${formatValue(billing.currency, '')}\``,
    `- Estimated evidence: \`${formatValue(estimated.schemaVersion)}\` / \`${formatValue(estimated.evidenceStatus)}\``,
    '',
    '## Reconciliation checks',
    '',
    '| Check | Status | Detail |',
    '| --- | --- | --- |',
    ...reconciliation.checks.map((item) => `| ${item.label} | \`${item.status}\` | ${item.detail || ''} |`),
    '',
    '## Claim boundary',
    '',
    '- This is a local billing import reconciliation artifact only.',
    '- This is not provider invoice/billing savings proof and does not prove actual charged-cost savings.',
    '- This does not unlock provider usage/billing-token savings claims.',
    '- This does not collect credentials or call provider billing APIs.',
    '',
  ].join('\n');
}

function renderBillingImportReadme(runId) {
  return [
    '# Billing manual-import evidence tier',
    '',
    `Run ID: \`${runId}\``,
    '',
    'This directory stores the offline billing-import contract and, when provided, a local reconciliation artifact that links redacted provider billing/dashboard/export data beside existing provider usage estimated-cost evidence.',
    '',
    '## Claim boundary',
    '',
    '- This schema does not prove provider invoice or billing savings.',
    '- This tier does not collect provider credentials or call billing dashboards/APIs.',
    '- Reconciliation artifacts keep `providerInvoiceOrBillingSavings=false` and `providerBillingTokenSavings=false` until a separate billing-grade proof lane is authorized and completed.',
    '',
  ].join('\n');
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

function writeBillingImportArtifacts({
  cwd = process.cwd(),
  runId = timestampRunId('billing-import'),
  billingImportArtifact = null,
  estimatedEvidence = null,
  outputPath = null,
  markdownOutputPath = null,
} = {}) {
  const paths = evidencePaths({
    cwd,
    tier: 'billing-import',
    runId,
    jsonName: 'import.schema.json',
    markdownName: 'README.md',
  });
  ensureEvidenceDir({ cwd, tier: 'billing-import', runId });
  writeJson(paths.json, billingImportSchema());
  writeText(paths.markdown, renderBillingImportReadme(paths.runId));

  const result = {
    runId: paths.runId,
    schemaPath: paths.json,
    readmePath: paths.markdown,
    claimability: { ...BILLING_CLAIMABILITY },
  };

  if (billingImportArtifact && estimatedEvidence) {
    const reconciliation = buildBillingImportReconciliation({
      billingImportArtifact,
      estimatedEvidence,
      runId: paths.runId,
    });
    const reconciliationPath = outputPath || path.join(paths.dir, 'reconciliation.json');
    const reconciliationMarkdownPath = markdownOutputPath || path.join(paths.dir, 'reconciliation.md');
    writeJson(reconciliationPath, reconciliation);
    writeText(reconciliationMarkdownPath, renderBillingReconciliationMarkdown(reconciliation));
    result.reconciliationPath = reconciliationPath;
    result.reconciliationMarkdownPath = reconciliationMarkdownPath;
    result.reconciliation = reconciliation;
  }

  return result;
}

function parseArgs(argv) {
  return argv.reduce((acc, arg) => {
    if (!arg.startsWith('--')) return acc;
    const index = arg.indexOf('=');
    if (index === -1) acc[arg.slice(2)] = true;
    else acc[arg.slice(2, index)] = arg.slice(index + 1);
    return acc;
  }, {});
}

function relativePath(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath)).split(path.sep).join('/');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log([
      'Usage: node benchmarks/layer2-frontend-task/billing-import-evidence.js [--run-id=<id>]',
      '       node benchmarks/layer2-frontend-task/billing-import-evidence.js --import=<billing.json> --estimated-evidence=<evidence.json> [--run-id=<id>]',
      '',
      'Aliases: --provider-cost=<evidence.json>, --summary=<summary.json>',
    ].join('\n'));
    return;
  }

  const estimatedPath = args['estimated-evidence'] || args['provider-cost'] || args.summary;
  if ((args.import && !estimatedPath) || (!args.import && estimatedPath)) {
    throw new Error('Both --import and --estimated-evidence/--provider-cost/--summary are required for reconciliation');
  }
  const billingImportArtifact = args.import ? readJson(args.import) : null;
  const estimatedEvidence = estimatedPath ? readJson(estimatedPath) : null;
  const result = writeBillingImportArtifacts({
    runId: args['run-id'],
    billingImportArtifact,
    estimatedEvidence,
    outputPath: args.output,
    markdownOutputPath: args['markdown-output'],
  });
  const summary = {
    runId: result.runId,
    schemaPath: relativePath(result.schemaPath),
    readmePath: relativePath(result.readmePath),
    claimability: result.claimability,
  };
  if (result.reconciliationPath) {
    summary.reconciliationPath = relativePath(result.reconciliationPath);
    summary.reconciliationMarkdownPath = relativePath(result.reconciliationMarkdownPath);
    summary.reconciliationStatus = result.reconciliation.status;
  }
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[billing-import-evidence] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  BILLING_IMPORT_SCHEMA_VERSION,
  BILLING_RECONCILIATION_SCHEMA_VERSION,
  CLAIM_BOUNDARY,
  billingImportSchema,
  normalizeBillingImportArtifact,
  normalizeEstimatedEvidence,
  buildBillingImportReconciliation,
  renderBillingImportReadme,
  renderBillingReconciliationMarkdown,
  writeBillingImportArtifacts,
};
