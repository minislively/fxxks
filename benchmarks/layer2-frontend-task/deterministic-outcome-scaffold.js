#!/usr/bin/env node
'use strict';

/**
 * Design/scaffold-only contract for future deterministic outcome benchmarks.
 *
 * This file deliberately does not run Codex/Claude, does not price provider
 * usage, does not tokenize provider payloads, and does not change runtime
 * defaults. It only emits/validates the benchmark contract that later lanes can
 * build on after release-safe runtime guardrails land.
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 'layer2-deterministic-outcome-scaffold.v1';
const STATUS = 'design-scaffold-only';

const CLAIM_BOUNDARY = [
  'This scaffold is a design contract only, not live Codex or Claude outcome evidence.',
  'This scaffold does not claim provider billing-token savings, provider tokenizer parity, provider invoice savings, or provider costs.',
  'This scaffold does not change automatic runtime defaults or editGuidance.patchTargets default behavior.',
  'Future live smoke or provider-cost evidence must run in separate lanes after release-safe guardrails land.',
];

const REQUIRED_CONTROLS = [
  'fixed-task-identity',
  'fixed-fixture-revision',
  'isolated-workdir-per-attempt',
  'deterministic-validator-command',
  'explicit-seed-and-order-metadata',
  'source-fingerprint-recorded',
  'claim-boundary-recorded',
];

const FORBIDDEN_UNTIL_NEXT_PHASE = [
  'runtime-default-change',
  'edit-guidance-default-change',
  'provider-tokenizer-claim',
  'provider-billing-token-claim',
  'provider-cost-claim',
  'live-codex-outcome-claim',
  'live-claude-outcome-claim',
  'lsp-dependency',
];

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function buildDeterministicOutcomeScaffold(options = {}) {
  const runId = options.runId || `deterministic-outcome-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const tasks = normalizeList(options.tasks);
  const validators = normalizeList(options.validators);
  return {
    schemaVersion: SCHEMA_VERSION,
    status: STATUS,
    runId,
    generatedAt: options.generatedAt || new Date().toISOString(),
    scope: {
      lane: 'priority-3-deterministic-outcome-benchmark',
      phase: 'scaffold',
      allowedWork: [
        'contract-docs',
        'local-scaffold-emission',
        'claim-boundary-tests',
      ],
      nonGoals: FORBIDDEN_UNTIL_NEXT_PHASE,
    },
    plannedInputs: {
      tasks,
      validators,
      minimumAcceptedPairs: Number.isFinite(Number(options.minimumAcceptedPairs))
        ? Number(options.minimumAcceptedPairs)
        : 0,
      liveModelExecution: false,
      providerBillingImport: false,
      lspRequired: false,
    },
    deterministicControls: REQUIRED_CONTROLS,
    artifactContract: {
      requiredIdentityFields: [
        'taskIdentity',
        'fixtureRevision',
        'setupIdentity',
        'validatorIdentity',
      ],
      requiredOutcomeFields: [
        'accepted',
        'validatorStatus',
        'diagnosticReasons',
      ],
      requiredAuditFields: [
        'sourceFingerprint',
        'seed',
        'attemptOrder',
        'claimBoundary',
      ],
    },
    claimability: {
      liveCodexOutcome: false,
      liveClaudeOutcome: false,
      providerTokenizerParity: false,
      providerBillingTokenSavings: false,
      providerInvoiceOrCostSavings: false,
      stableRuntimeTokenSavings: false,
      stableLatencySavings: false,
    },
    claimBoundary: CLAIM_BOUNDARY,
    nextPhaseRequires: [
      'release-safe-runtime-opt-in-guardrails-merged',
      'fixture-replay-manifest-reviewed',
      'no-live-model-claim-wording-approved',
    ],
  };
}

function validateDeterministicOutcomeScaffold(scaffold) {
  const blockers = [];
  if (!scaffold || typeof scaffold !== 'object') blockers.push('missing-scaffold-object');
  if (scaffold?.schemaVersion !== SCHEMA_VERSION) blockers.push('unexpected-schema-version');
  if (scaffold?.status !== STATUS) blockers.push('status-must-remain-design-scaffold-only');

  for (const [key, value] of Object.entries(scaffold?.claimability || {})) {
    if (value !== false) blockers.push(`claimability-${key}-must-be-false`);
  }

  const controls = new Set(scaffold?.deterministicControls || []);
  for (const control of REQUIRED_CONTROLS) {
    if (!controls.has(control)) blockers.push(`missing-control:${control}`);
  }

  const nonGoals = new Set(scaffold?.scope?.nonGoals || []);
  for (const forbidden of FORBIDDEN_UNTIL_NEXT_PHASE) {
    if (!nonGoals.has(forbidden)) blockers.push(`missing-non-goal:${forbidden}`);
  }

  const boundary = (scaffold?.claimBoundary || []).join(' ').toLowerCase();
  for (const phrase of ['design contract only', 'provider billing-token', 'automatic runtime defaults', 'separate lanes']) {
    if (!boundary.includes(phrase)) blockers.push(`missing-claim-boundary:${phrase}`);
  }

  return {
    valid: blockers.length === 0,
    blockers,
  };
}

function markdownForScaffold(scaffold, validation = validateDeterministicOutcomeScaffold(scaffold)) {
  return [
    '# Deterministic Outcome Benchmark Scaffold',
    '',
    `- Schema: ${scaffold.schemaVersion}`,
    `- Status: ${scaffold.status}`,
    `- Run ID: ${scaffold.runId}`,
    `- Valid: ${validation.valid}`,
    '',
    '## Claim boundary',
    '',
    ...scaffold.claimBoundary.map((item) => `- ${item}`),
    '',
    '## Deterministic controls',
    '',
    ...scaffold.deterministicControls.map((item) => `- ${item}`),
    '',
    '## Non-goals for this phase',
    '',
    ...scaffold.scope.nonGoals.map((item) => `- ${item}`),
    '',
    '## Validation blockers',
    '',
    ...(validation.blockers.length > 0 ? validation.blockers.map((item) => `- ${item}`) : ['- none']),
    '',
  ].join('\n');
}

function parseArgs(argv) {
  return argv.reduce((acc, arg) => {
    const [key, ...rest] = arg.split('=');
    if (key.startsWith('--')) {
      acc[key.slice(2)] = rest.length > 0 ? rest.join('=') : true;
    }
    return acc;
  }, {});
}

function writeIfRequested(filePath, content) {
  if (!filePath) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function usage() {
  return [
    'Usage: node benchmarks/layer2-frontend-task/deterministic-outcome-scaffold.js [--output=<json>] [--markdown=<md>] [--run-id=<id>] [--tasks=a,b] [--validators=a,b] [--minimum-accepted-pairs=5]',
    'Emits a design/scaffold-only deterministic outcome benchmark contract. It does not run live models or provider-cost evidence.',
  ].join('\n');
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }
  const scaffold = buildDeterministicOutcomeScaffold({
    runId: args['run-id'],
    tasks: args.tasks,
    validators: args.validators,
    minimumAcceptedPairs: args['minimum-accepted-pairs'],
  });
  const validation = validateDeterministicOutcomeScaffold(scaffold);
  const json = `${JSON.stringify({ ...scaffold, validation }, null, 2)}\n`;
  writeIfRequested(args.output, json);
  writeIfRequested(args.markdown, markdownForScaffold(scaffold, validation));
  if (!args.output) process.stdout.write(json);
  return validation.valid ? 0 : 2;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  SCHEMA_VERSION,
  STATUS,
  CLAIM_BOUNDARY,
  REQUIRED_CONTROLS,
  FORBIDDEN_UNTIL_NEXT_PHASE,
  buildDeterministicOutcomeScaffold,
  validateDeterministicOutcomeScaffold,
  markdownForScaffold,
};
