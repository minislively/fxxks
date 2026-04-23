#!/usr/bin/env node
'use strict';

/**
 * Design/scaffold-only and fixture-replay contracts for deterministic outcome
 * benchmark lanes.
 *
 * This file deliberately does not run Codex/Claude, does not price provider
 * usage, does not tokenize provider payloads, and does not change runtime
 * defaults. Fixture replay is local/offline target-localization evidence only.
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 'layer2-deterministic-outcome-scaffold.v1';
const STATUS = 'design-scaffold-only';
const FIXTURE_REPLAY_SCHEMA_VERSION = 'layer2-deterministic-outcome-fixture-replay.v1';
const FIXTURE_REPLAY_STATUS = 'fixture-replay-only';
const DEFAULT_FIXTURE_TARGET = 'fixtures/compressed/HookEffectPanel.tsx';
const DEFAULT_TASK_IDENTITY = 'edit-guidance-target-localization';
const DEFAULT_FIXTURE_REVISION = 'repo-fixture-current';
const SOURCE_IDENTITY_REF = 'sourceIdentity';
const COMPARISON_INVARIANT =
  'with-guidance and without-guidance variants must use this same target file and component';
const FIXTURE_REPLAY_CLAIM_BOUNDARY = [
  'local deterministic target-localization evidence only',
  'not live Codex/Claude model outcome proof',
  'not provider tokenizer proof',
  'not provider billing/cost proof',
  'not LSP semantic safety',
  'not runtime-token/latency proof',
  'not a public edit-win claim',
].join('; ');

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

const REQUIRED_FIXTURE_REPLAY_CLAIMABILITY = {
  liveCodexOutcome: false,
  liveClaudeOutcome: false,
  providerTokenizerParity: false,
  providerBillingTokenSavings: false,
  providerInvoiceOrCostSavings: false,
  stableRuntimeTokenSavings: false,
  stableLatencySavings: false,
  lspSemanticSafety: false,
  publicEditWin: false,
};

const WITHOUT_GUIDANCE_LOCALIZATION_STEPS = [
  'read-model-payload',
  'fallback-search-or-read',
];

const WITH_GUIDANCE_LOCALIZATION_STEPS = [
  'read-model-payload',
  'verify-sourceFingerprint',
  'select-patchTarget',
];

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sameFingerprint(left, right) {
  return Boolean(
    left &&
      right &&
      left.fileHash === right.fileHash &&
      left.lineCount === right.lineCount,
  );
}

function targetKey(target) {
  if (!target || !target.loc) return '';
  return [
    target.kind,
    target.label,
    target.loc.startLine,
    target.loc.endLine,
    target.reason,
  ].map((item) => String(item ?? '')).join('\u0000');
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function buildClaimability() {
  return { ...REQUIRED_FIXTURE_REPLAY_CLAIMABILITY };
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

function resolveRepoRoot() {
  return path.resolve(__dirname, '..', '..');
}

function loadFooksExtractors(repoRoot = resolveRepoRoot()) {
  const extractModule = require(path.join(repoRoot, 'dist', 'core', 'extract.js'));
  const payloadModule = require(path.join(repoRoot, 'dist', 'core', 'payload', 'model-facing.js'));
  return {
    extractFile: extractModule.extractFile,
    toModelFacingPayload: payloadModule.toModelFacingPayload,
  };
}

function normalizeFixtureTarget(targetFile, repoRoot) {
  const resolved = path.resolve(repoRoot, targetFile || DEFAULT_FIXTURE_TARGET);
  return {
    absoluteTarget: resolved,
    relativeTarget: path.relative(repoRoot, resolved).split(path.sep).join('/'),
  };
}

function selectPatchTarget(patchTargets = [], options = {}) {
  const targets = Array.isArray(patchTargets) ? patchTargets : [];
  if (options.targetKind || options.targetLabel) {
    const matched = targets.find((target) => {
      const kindMatches = options.targetKind ? target.kind === options.targetKind : true;
      const labelMatches = options.targetLabel ? target.label === options.targetLabel : true;
      return kindMatches && labelMatches;
    });
    if (matched) return matched;
  }
  return targets[0];
}

function countFallbackSteps(variant) {
  const steps = Array.isArray(variant?.targetLocalizationSteps) ? variant.targetLocalizationSteps : [];
  let count = steps.filter((step) => /fallback|search|full-read|read-full/i.test(String(step))).length;
  if (variant?.fallbackFullReadOrSearchRequired === true) count += 1;
  return count;
}

function classifyFixtureReplayArtifact(artifact) {
  const blockers = validateDeterministicFixtureReplay(artifact).blockers;
  const identityBlockers = blockers.filter((item) =>
    /source-identity|paired-target|missing-sourceIdentity|missing-pairedTarget/i.test(item),
  );
  if (identityBlockers.length > 0) {
    return {
      classification: 'inconclusive',
      classificationReasons: identityBlockers,
    };
  }

  const withGuidance = artifact?.variants?.withEditGuidance;
  const withoutGuidance = artifact?.variants?.withoutEditGuidance;
  if (!withGuidance?.selectedPatchTarget || !withGuidance.selectedPatchTarget.loc) {
    return {
      classification: 'inconclusive',
      classificationReasons: ['missing-selected-patch-target'],
    };
  }

  const withFallbackCount = countFallbackSteps(withGuidance);
  const withoutFallbackCount = countFallbackSteps(withoutGuidance);
  if (withFallbackCount < withoutFallbackCount) {
    return {
      classification: 'pass',
      classificationReasons: ['with-guidance-reduces-fallback-target-localization'],
    };
  }

  return {
    classification: 'fail',
    classificationReasons: ['with-guidance-does-not-reduce-fallback-target-localization'],
  };
}

function buildDeterministicFixtureReplay(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const { absoluteTarget, relativeTarget } = normalizeFixtureTarget(options.targetFile, repoRoot);
  const extractFile = options.extractFile;
  const toModelFacingPayload = options.toModelFacingPayload;
  if (typeof extractFile !== 'function' || typeof toModelFacingPayload !== 'function') {
    throw new Error('buildDeterministicFixtureReplay requires extractFile and toModelFacingPayload dependencies');
  }

  const extraction = extractFile(absoluteTarget);
  const withoutPayload = toModelFacingPayload(extraction, repoRoot);
  const withPayload = toModelFacingPayload(extraction, repoRoot, { includeEditGuidance: true });
  const patchTargets = clone(withPayload.editGuidance?.patchTargets || []);
  const selectedPatchTarget = clone(selectPatchTarget(patchTargets, options));
  const sourceFingerprint = clone(withPayload.sourceFingerprint || withoutPayload.sourceFingerprint);
  const sourceIdentity = {
    sourceFingerprint,
    defaultPayloadFingerprint: clone(withoutPayload.sourceFingerprint),
    withGuidancePayloadFingerprint: clone(withPayload.sourceFingerprint),
    editGuidanceFreshness: clone(withPayload.editGuidance?.freshness),
    freshnessSource: 'extractFile + toModelFacingPayload(..., { includeEditGuidance: true })',
  };

  const artifact = {
    schemaVersion: FIXTURE_REPLAY_SCHEMA_VERSION,
    status: FIXTURE_REPLAY_STATUS,
    runId: options.runId || `deterministic-fixture-replay-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    generatedAt: options.generatedAt || new Date().toISOString(),
    taskIdentity: options.taskIdentity || DEFAULT_TASK_IDENTITY,
    fixtureRevision: options.fixtureRevision || DEFAULT_FIXTURE_REVISION,
    pairedTarget: {
      filePath: relativeTarget,
      componentName: withPayload.componentName || withoutPayload.componentName || extraction.componentName || 'UnknownComponent',
    },
    comparisonInvariant: COMPARISON_INVARIANT,
    comparisonInputs: {
      withoutEditGuidance: {
        filePath: withoutPayload.filePath,
        componentName: withoutPayload.componentName,
      },
      withEditGuidance: {
        filePath: withPayload.filePath,
        componentName: withPayload.componentName,
      },
    },
    sourceIdentity,
    claimBoundary: FIXTURE_REPLAY_CLAIM_BOUNDARY,
    claimability: buildClaimability(),
    variants: {
      withoutEditGuidance: {
        editGuidanceEnabled: false,
        sourceIdentityRef: SOURCE_IDENTITY_REF,
        targetLocalizationSteps: [...WITHOUT_GUIDANCE_LOCALIZATION_STEPS],
        fallbackFullReadOrSearchRequired: true,
        diagnosticReasons: [],
      },
      withEditGuidance: {
        editGuidanceEnabled: true,
        sourceIdentityRef: SOURCE_IDENTITY_REF,
        freshnessChecked: sameFingerprint(sourceFingerprint, withPayload.editGuidance?.freshness),
        availablePatchTargets: patchTargets,
        patchTargetsCount: patchTargets.length,
        targetLocalizationSteps: selectedPatchTarget
          ? [...WITH_GUIDANCE_LOCALIZATION_STEPS]
          : ['read-model-payload', 'verify-sourceFingerprint', 'fallback-search-or-read'],
        fallbackFullReadOrSearchRequired: !selectedPatchTarget,
        ...(selectedPatchTarget ? { selectedPatchTarget } : {}),
        diagnosticReasons: selectedPatchTarget ? [] : ['missing-patch-target'],
      },
    },
  };

  const classification = classifyFixtureReplayArtifact(artifact);
  return {
    ...artifact,
    ...classification,
  };
}

function validateClaimability(claimability, blockers, prefix = 'claimability') {
  if (!claimability || typeof claimability !== 'object') {
    blockers.push(`missing-${prefix}`);
    return;
  }
  for (const key of Object.keys(REQUIRED_FIXTURE_REPLAY_CLAIMABILITY)) {
    if (!hasOwn(claimability, key)) {
      blockers.push(`missing-${prefix}:${key}`);
    } else if (typeof claimability[key] !== 'boolean') {
      blockers.push(`${prefix}-${key}-must-be-boolean-false`);
    } else if (claimability[key] !== false) {
      blockers.push(`${prefix}-${key}-must-be-false`);
    }
  }
  for (const key of Object.keys(claimability)) {
    if (!hasOwn(REQUIRED_FIXTURE_REPLAY_CLAIMABILITY, key)) {
      blockers.push(`unexpected-${prefix}:${key}`);
    }
  }
}

function validatePairedTarget(artifact, blockers) {
  const pairedTarget = artifact?.pairedTarget;
  if (!pairedTarget || typeof pairedTarget !== 'object') {
    blockers.push('missing-pairedTarget');
    return;
  }
  if (!pairedTarget.filePath) blockers.push('missing-pairedTarget.filePath');
  if (!pairedTarget.componentName) blockers.push('missing-pairedTarget.componentName');
  if (!String(artifact?.comparisonInvariant || '').includes('same target file and component')) {
    blockers.push('missing-comparisonInvariant:same target file and component');
  }

  const withoutIdentity = artifact?.comparisonInputs?.withoutEditGuidance || {};
  const withIdentity = artifact?.comparisonInputs?.withEditGuidance || {};
  if (withoutIdentity.filePath !== withIdentity.filePath || withoutIdentity.filePath !== pairedTarget.filePath) {
    blockers.push('paired-target-filePath-mismatch');
  }
  if (withoutIdentity.componentName !== withIdentity.componentName || withoutIdentity.componentName !== pairedTarget.componentName) {
    blockers.push('paired-target-componentName-mismatch');
  }
}

function validateSourceIdentity(artifact, blockers) {
  const sourceIdentity = artifact?.sourceIdentity;
  if (!sourceIdentity || typeof sourceIdentity !== 'object') {
    blockers.push('missing-sourceIdentity');
    return;
  }
  const fingerprint = sourceIdentity.sourceFingerprint;
  if (!fingerprint) blockers.push('missing-sourceIdentity.sourceFingerprint');
  const checks = [
    ['defaultPayloadFingerprint', sourceIdentity.defaultPayloadFingerprint],
    ['withGuidancePayloadFingerprint', sourceIdentity.withGuidancePayloadFingerprint],
    ['editGuidanceFreshness', sourceIdentity.editGuidanceFreshness],
  ];
  for (const [label, value] of checks) {
    if (!sameFingerprint(fingerprint, value)) {
      blockers.push(`source-identity-mismatch:${label}`);
    }
  }
  if (artifact?.variants?.withoutEditGuidance?.sourceIdentityRef !== SOURCE_IDENTITY_REF) {
    blockers.push('without-guidance-sourceIdentityRef-mismatch');
  }
  if (artifact?.variants?.withEditGuidance?.sourceIdentityRef !== SOURCE_IDENTITY_REF) {
    blockers.push('with-guidance-sourceIdentityRef-mismatch');
  }
  if (hasOwn(artifact?.variants?.withoutEditGuidance, 'sourceFingerprint')) {
    blockers.push('without-guidance-must-not-duplicate-sourceFingerprint');
  }
  if (hasOwn(artifact?.variants?.withEditGuidance, 'sourceFingerprint')) {
    blockers.push('with-guidance-must-not-duplicate-sourceFingerprint');
  }
}

function validateWithoutGuidance(variant, blockers) {
  if (!variant || typeof variant !== 'object') {
    blockers.push('missing-withoutEditGuidance');
    return;
  }
  if (variant.editGuidanceEnabled !== false) blockers.push('without-guidance-editGuidanceEnabled-must-be-false');
  for (const forbidden of ['editGuidance', 'patchTargets', 'selectedPatchTarget']) {
    if (hasOwn(variant, forbidden)) blockers.push(`without-guidance-forbidden-field:${forbidden}`);
  }
  if (variant.freshnessChecked === true) blockers.push('without-guidance-freshnessChecked-must-not-be-true');
  const steps = Array.isArray(variant.targetLocalizationSteps) ? variant.targetLocalizationSteps : [];
  if (steps.includes('select-patchTarget')) blockers.push('without-guidance-must-not-select-patchTarget');
}

function validateWithGuidance(variant, blockers) {
  if (!variant || typeof variant !== 'object') {
    blockers.push('missing-withEditGuidance');
    return;
  }
  if (variant.editGuidanceEnabled !== true) blockers.push('with-guidance-editGuidanceEnabled-must-be-true');
  if (variant.freshnessChecked !== true) blockers.push('with-guidance-freshnessChecked-must-be-true');
  const availableTargets = Array.isArray(variant.availablePatchTargets) ? variant.availablePatchTargets : [];
  if (!Number.isFinite(Number(variant.patchTargetsCount)) || Number(variant.patchTargetsCount) !== availableTargets.length) {
    blockers.push('with-guidance-patchTargetsCount-mismatch');
  }
  const selected = variant.selectedPatchTarget;
  if (selected) {
    if (!selected.loc || !Number.isFinite(Number(selected.loc.startLine)) || !Number.isFinite(Number(selected.loc.endLine))) {
      blockers.push('with-guidance-selectedPatchTarget-missing-loc');
    }
    const selectedKey = targetKey(selected);
    const availableKeys = new Set(availableTargets.map(targetKey));
    if (!availableKeys.has(selectedKey)) {
      blockers.push('with-guidance-selectedPatchTarget-not-in-production-patchTargets');
    }
  }
}

function validateDeterministicFixtureReplay(artifact) {
  const blockers = [];
  if (!artifact || typeof artifact !== 'object') blockers.push('missing-fixture-replay-object');
  if (artifact?.schemaVersion !== FIXTURE_REPLAY_SCHEMA_VERSION) blockers.push('unexpected-fixture-replay-schema-version');
  if (artifact?.status !== FIXTURE_REPLAY_STATUS) blockers.push('fixture-replay-status-must-remain-fixture-replay-only');
  if (!String(artifact?.claimBoundary || '').toLowerCase().includes('local deterministic target-localization evidence only')) {
    blockers.push('missing-fixture-replay-claim-boundary');
  }
  const boundary = String(artifact?.claimBoundary || '').toLowerCase();
  const requiredBoundaryPhrases = [
    'not live codex/claude',
    'not provider tokenizer',
    'not provider billing/cost',
    'not lsp',
    'not runtime-token/latency',
    'not a public edit-win claim',
  ];
  for (const phrase of requiredBoundaryPhrases) {
    if (!boundary.includes(phrase)) blockers.push(`missing-fixture-replay-boundary:${phrase}`);
  }

  validateClaimability(artifact?.claimability, blockers);
  validatePairedTarget(artifact, blockers);
  validateSourceIdentity(artifact, blockers);
  validateWithoutGuidance(artifact?.variants?.withoutEditGuidance, blockers);
  validateWithGuidance(artifact?.variants?.withEditGuidance, blockers);

  if (!['pass', 'fail', 'inconclusive'].includes(artifact?.classification)) {
    blockers.push('invalid-fixture-replay-classification');
  }
  if (artifact?.classification === 'pass') {
    const selected = artifact?.variants?.withEditGuidance?.selectedPatchTarget;
    if (!selected?.loc) blockers.push('pass-requires-selected-patch-target-with-loc');
    const withFallbackCount = countFallbackSteps(artifact?.variants?.withEditGuidance);
    const withoutFallbackCount = countFallbackSteps(artifact?.variants?.withoutEditGuidance);
    if (!(withFallbackCount < withoutFallbackCount)) {
      blockers.push('pass-requires-reduced-fallback-target-localization');
    }
  }

  return {
    valid: blockers.length === 0,
    blockers,
  };
}

function markdownForFixtureReplay(artifact, validation = validateDeterministicFixtureReplay(artifact)) {
  const claimabilityLines = Object.entries(artifact.claimability || {}).map(([key, value]) => `- ${key}: ${value}`);
  return [
    '# Deterministic Edit-Guidance Fixture Replay',
    '',
    `- Schema: ${artifact.schemaVersion}`,
    `- Status: ${artifact.status}`,
    `- Run ID: ${artifact.runId}`,
    `- Valid: ${validation.valid}`,
    `- Classification: ${artifact.classification}`,
    `- Target: ${artifact.pairedTarget?.filePath ?? 'unknown'}#${artifact.pairedTarget?.componentName ?? 'unknown'}`,
    '',
    '## Claim boundary',
    '',
    `- ${artifact.claimBoundary}`,
    '',
    '## Claimability',
    '',
    ...claimabilityLines,
    '',
    '## Target-localization steps',
    '',
    `- Without guidance: ${(artifact.variants?.withoutEditGuidance?.targetLocalizationSteps || []).join(' -> ')}`,
    `- With guidance: ${(artifact.variants?.withEditGuidance?.targetLocalizationSteps || []).join(' -> ')}`,
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
    [
      'Usage: node benchmarks/layer2-frontend-task/deterministic-outcome-scaffold.js',
      '[--output=<json>] [--markdown=<md>] [--run-id=<id>]',
      '[--tasks=a,b] [--validators=a,b] [--minimum-accepted-pairs=5]',
    ].join(' '),
    [
      '       node benchmarks/layer2-frontend-task/deterministic-outcome-scaffold.js --fixture-replay',
      '[--target-file=fixtures/compressed/HookEffectPanel.tsx]',
      '[--output=<json>] [--markdown=<md>] [--run-id=<id>]',
    ].join(' '),
    'Emits local deterministic benchmark contracts. Fixture replay does not run live models or provider-cost evidence.',
  ].join('\n');
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }

  if (args['fixture-replay']) {
    const repoRoot = resolveRepoRoot();
    const deps = loadFooksExtractors(repoRoot);
    const replay = buildDeterministicFixtureReplay({
      ...deps,
      repoRoot,
      runId: args['run-id'],
      targetFile: args['target-file'],
      taskIdentity: args['task-identity'],
      fixtureRevision: args['fixture-revision'],
      targetKind: args['target-kind'],
      targetLabel: args['target-label'],
    });
    const validation = validateDeterministicFixtureReplay(replay);
    const json = `${JSON.stringify({ ...replay, validation }, null, 2)}\n`;
    writeIfRequested(args.output, json);
    writeIfRequested(args.markdown, markdownForFixtureReplay(replay, validation));
    if (!args.output) process.stdout.write(json);
    return validation.valid ? 0 : 2;
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
  FIXTURE_REPLAY_SCHEMA_VERSION,
  FIXTURE_REPLAY_STATUS,
  FIXTURE_REPLAY_CLAIM_BOUNDARY,
  REQUIRED_FIXTURE_REPLAY_CLAIMABILITY,
  CLAIM_BOUNDARY,
  REQUIRED_CONTROLS,
  FORBIDDEN_UNTIL_NEXT_PHASE,
  buildDeterministicOutcomeScaffold,
  validateDeterministicOutcomeScaffold,
  markdownForScaffold,
  buildDeterministicFixtureReplay,
  validateDeterministicFixtureReplay,
  markdownForFixtureReplay,
};
