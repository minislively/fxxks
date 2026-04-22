#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  buildProviderCostEvidence,
  renderProviderCostEvidenceMarkdown,
} = require('./provider-cost-evidence.js');
const {
  LITELLM_PRICING_URL,
  fetchPricingCatalog,
  pricingAssumptionFromLiteLLMCatalog,
  readPricingCatalog,
} = require('./provider-pricing.js');
const {
  ensureEvidenceDir,
  evidencePaths,
  timestampRunId,
} = require('./evidence-paths.js');

function parseArgs(argv) {
  return argv.reduce((acc, arg) => {
    if (!arg.startsWith('--')) return acc;
    const index = arg.indexOf('=');
    if (index === -1) {
      acc[arg.slice(2)] = true;
    } else {
      acc[arg.slice(2, index)] = arg.slice(index + 1);
    }
    return acc;
  }, {});
}

function readJson(filePath, label) {
  if (!filePath) throw new Error(`Missing --${label}=<json>`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function optionalNumber(value) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid non-negative number: ${value}`);
  return parsed;
}

function firstArtifactField(artifacts, field) {
  const artifact = artifacts.find((item) => item && item[field]);
  return artifact ? artifact[field] : undefined;
}

function relativePath(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath)).split(path.sep).join('/');
}

async function pricingFromArgs(args, artifacts) {
  const pricing = args.pricing ? readJson(args.pricing, 'pricing') : {};
  const merged = {
    ...pricing,
    provider: args.provider || pricing.provider || firstArtifactField(artifacts, 'provider'),
    model: args.model || pricing.model || firstArtifactField(artifacts, 'model'),
    currency: args.currency || pricing.currency,
    inputPer1MTokens: optionalNumber(args['input-rate-per-1m']) ?? pricing.inputPer1MTokens,
    outputPer1MTokens: optionalNumber(args['output-rate-per-1m']) ?? pricing.outputPer1MTokens,
    sourceUrl: args['pricing-source-url'] || pricing.sourceUrl,
    checkedDate: args['pricing-checked-date'] || pricing.checkedDate,
    note: args['pricing-note'] || pricing.note,
  };

  const shouldUseCatalog = args['pricing-catalog'] || args['pricing-catalog-url'] || args['fetch-pricing'];
  const hasManualRates = merged.inputPer1MTokens !== undefined && merged.outputPer1MTokens !== undefined;
  if (!shouldUseCatalog || hasManualRates) return merged;

  const sourceUrl = args['pricing-catalog-url'] || LITELLM_PRICING_URL;
  const catalog = args['pricing-catalog']
    ? readPricingCatalog(args['pricing-catalog'])
    : await fetchPricingCatalog(sourceUrl);
  const fromCatalog = pricingAssumptionFromLiteLLMCatalog({
    dataset: catalog,
    provider: merged.provider,
    model: merged.model,
    sourceUrl,
    checkedDate: merged.checkedDate,
    currency: merged.currency,
  });

  return {
    ...fromCatalog.pricing,
    ...Object.fromEntries(
      Object.entries(merged).filter(([, value]) => value !== undefined && value !== null),
    ),
    catalogLookupReasons: fromCatalog.reasons,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log([
      'Usage:',
      '  node benchmarks/layer2-frontend-task/run-provider-cost-evidence.js --baseline=<json> --fooks=<json> [--output=<json>] [options]',
      '',
      'Options:',
      '  --pricing=<json>                 Pricing assumption JSON',
      '  --provider=openai                Provider label',
      '  --model=<model>                  Model label (defaults to artifact model when present)',
      '  --input-rate-per-1m=2.5          Input token rate per 1M tokens',
      '  --output-rate-per-1m=15          Output token rate per 1M tokens',
      '  --pricing-catalog=<json>         LiteLLM-shaped local pricing catalog',
      `  --pricing-catalog-url=<url>      Pricing catalog URL (default: ${LITELLM_PRICING_URL})`,
      '  --fetch-pricing                  Fetch pricing catalog URL when manual rates are absent',
      '  --pricing-source-url=<url>       Pricing source URL',
      '  --pricing-checked-date=YYYY-MM-DD',
      '  --source-kind=fixture            fixture|fixture-mechanics|validated-provider-import|live-openai-usage',
      '  --markdown-output=<md>           Optional Markdown summary output',
      '',
      'Default output:',
      '  When --output is omitted, writes to .fooks/evidence/provider-cost/<run-id>/evidence.json',
      '  and .fooks/evidence/provider-cost/<run-id>/evidence.md.',
    ].join('\n'));
    return;
  }

  const baselineArtifact = readJson(args.baseline, 'baseline');
  const fooksArtifact = readJson(args.fooks, 'fooks');
  const runId = args['run-id'] || timestampRunId('provider-cost');
  const evidence = buildProviderCostEvidence({
    baselineArtifact,
    fooksArtifact,
    pricing: await pricingFromArgs(args, [baselineArtifact, fooksArtifact]),
    sourceKind: args['source-kind'] || 'fixture',
    runId,
  });

  const defaultPaths = args.output ? null : evidencePaths({ tier: 'provider-cost', runId });
  const output = args.output || defaultPaths.json;
  if (defaultPaths) ensureEvidenceDir({ tier: 'provider-cost', runId });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);

  const markdownOutput = args['markdown-output'] || (defaultPaths ? defaultPaths.markdown : null);
  if (markdownOutput) {
    fs.mkdirSync(path.dirname(markdownOutput), { recursive: true });
    fs.writeFileSync(markdownOutput, renderProviderCostEvidenceMarkdown(evidence));
  }

  console.log(JSON.stringify({
    output: relativePath(output),
    markdownOutput: markdownOutput ? relativePath(markdownOutput) : null,
    runId,
    status: evidence.status,
    claimBoundary: evidence.claimBoundary,
  }, null, 2));
}

try {
  main().catch((error) => {
    console.error(`[provider-cost-evidence] ${error.message}`);
    process.exit(1);
  });
} catch (error) {
  console.error(`[provider-cost-evidence] ${error.message}`);
  process.exit(1);
}
