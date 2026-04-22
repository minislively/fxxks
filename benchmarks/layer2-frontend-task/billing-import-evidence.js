#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { ensureEvidenceDir, evidencePaths, timestampRunId } = require('./evidence-paths');

const BILLING_IMPORT_SCHEMA_VERSION = 'billing-import-evidence.v1';

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
            enum: ['invoice', 'dashboard-export', 'usage-export', 'manual-entry'],
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

function renderBillingImportReadme(runId) {
  return [
    '# Billing manual-import evidence tier',
    '',
    `Run ID: \`${runId}\``,
    '',
    'This directory is a placeholder for future manual provider billing imports.',
    '',
    '## Claim boundary',
    '',
    '- This schema does not prove provider invoice or billing savings.',
    '- This tier does not collect provider credentials or call billing dashboards/APIs.',
    '- Actual billing savings require a later reconciliation step against invoice/dashboard/export data.',
    '',
  ].join('\n');
}

function writeBillingImportArtifacts({ cwd = process.cwd(), runId = timestampRunId('billing-import') } = {}) {
  const paths = evidencePaths({
    cwd,
    tier: 'billing-import',
    runId,
    jsonName: 'import.schema.json',
    markdownName: 'README.md',
  });
  ensureEvidenceDir({ cwd, tier: 'billing-import', runId });
  fs.writeFileSync(paths.json, `${JSON.stringify(billingImportSchema(), null, 2)}\n`);
  fs.writeFileSync(paths.markdown, renderBillingImportReadme(paths.runId));
  return {
    runId: paths.runId,
    schemaPath: paths.json,
    readmePath: paths.markdown,
    claimability: {
      providerInvoiceOrBillingSavings: false,
      providerBillingTokenSavings: false,
    },
  };
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
    console.log('Usage: node benchmarks/layer2-frontend-task/billing-import-evidence.js [--run-id=<id>]');
    return;
  }

  const result = writeBillingImportArtifacts({ runId: args['run-id'] });
  console.log(JSON.stringify({
    runId: result.runId,
    schemaPath: relativePath(result.schemaPath),
    readmePath: relativePath(result.readmePath),
    claimability: result.claimability,
  }, null, 2));
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
  billingImportSchema,
  renderBillingImportReadme,
  writeBillingImportArtifacts,
};
