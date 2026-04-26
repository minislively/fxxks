// @ts-check
/// <reference types="node" />

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const scaffoldPath = path.join(repoRoot, 'benchmarks', 'layer2-frontend-task', 'deterministic-outcome-scaffold.js');
const {
  buildDeterministicOutcomeScaffold,
  validateDeterministicOutcomeScaffold,
  markdownForScaffold,
  buildDeterministicFixtureReplay,
  validateDeterministicFixtureReplay,
  markdownForFixtureReplay,
  REQUIRED_FIXTURE_REPLAY_CLAIMABILITY,
} = require(scaffoldPath);

test('deterministic outcome scaffold stays design-only and claim-bounded', () => {
  const scaffold = buildDeterministicOutcomeScaffold({
    runId: 'deterministic-outcome-test',
    tasks: ['R4-feature-module-split'],
    validators: ['validate-r4-applied'],
    minimumAcceptedPairs: 5,
    generatedAt: '2026-04-23T00:00:00.000Z',
  });

  assert.equal(scaffold.status, 'design-scaffold-only');
  assert.equal(scaffold.plannedInputs.liveModelExecution, false);
  assert.equal(scaffold.plannedInputs.providerBillingImport, false);
  assert.equal(scaffold.plannedInputs.lspRequired, false);
  assert.equal(scaffold.claimability.liveCodexOutcome, false);
  assert.equal(scaffold.claimability.liveClaudeOutcome, false);
  assert.equal(scaffold.claimability.providerTokenizerParity, false);
  assert.equal(scaffold.claimability.providerBillingTokenSavings, false);
  assert.equal(scaffold.claimability.providerInvoiceOrCostSavings, false);
  assert.ok(scaffold.scope.nonGoals.includes('runtime-default-change'));
  assert.ok(scaffold.scope.nonGoals.includes('edit-guidance-default-change'));
  assert.ok(scaffold.deterministicControls.includes('source-fingerprint-recorded'));

  const validation = validateDeterministicOutcomeScaffold(scaffold);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.blockers, []);

  const combined = JSON.stringify(scaffold).toLowerCase();
  assert.match(combined, /design contract only/);
  assert.match(combined, /provider usage\/billing-token/);
  assert.match(combined, /automatic runtime defaults/);
  assert.doesNotMatch(combined, /provider usage\/billing-token savings are proven/);
  assert.doesNotMatch(combined, /live codex outcome win/);
});

test('deterministic outcome scaffold validation rejects premature claimability', () => {
  const scaffold = buildDeterministicOutcomeScaffold({ runId: 'invalid-claimability' });
  scaffold.claimability.providerBillingTokenSavings = true;
  scaffold.scope.nonGoals = scaffold.scope.nonGoals.filter((item) => item !== 'provider-billing-token-claim');

  const validation = validateDeterministicOutcomeScaffold(scaffold);
  assert.equal(validation.valid, false);
  assert.ok(validation.blockers.includes('claimability-providerBillingTokenSavings-must-be-false'));
  assert.ok(validation.blockers.includes('missing-non-goal:provider-billing-token-claim'));
});

test('deterministic outcome scaffold CLI writes JSON and Markdown without live execution', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fooks-deterministic-outcome-'));
  const output = path.join(tempDir, 'scaffold.json');
  const markdown = path.join(tempDir, 'scaffold.md');

  execFileSync(process.execPath, [
    scaffoldPath,
    `--output=${output}`,
    `--markdown=${markdown}`,
    '--run-id=cli-scaffold',
    '--tasks=R4-feature-module-split',
    '--validators=validate-r4-applied',
    '--minimum-accepted-pairs=5',
  ], { cwd: repoRoot, encoding: 'utf8' });

  const result = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.equal(result.validation.valid, true);
  assert.equal(result.plannedInputs.liveModelExecution, false);
  assert.equal(result.plannedInputs.providerBillingImport, false);
  assert.equal(result.plannedInputs.minimumAcceptedPairs, 5);
  assert.deepEqual(result.plannedInputs.tasks, ['R4-feature-module-split']);

  const md = fs.readFileSync(markdown, 'utf8');
  assert.match(md, /Design.*Scaffold/i);
  assert.match(md, /does not run live models|design contract only/i);
  assert.match(md, /provider usage\/billing-token/i);
  assert.doesNotMatch(md, /provider usage\/billing-token savings are proven/i);
});

test('deterministic outcome scaffold markdown reports validation blockers', () => {
  const scaffold = buildDeterministicOutcomeScaffold({ runId: 'markdown-invalid' });
  scaffold.deterministicControls = scaffold.deterministicControls.filter((item) => item !== 'source-fingerprint-recorded');

  const validation = validateDeterministicOutcomeScaffold(scaffold);
  const markdown = markdownForScaffold(scaffold, validation);
  assert.equal(validation.valid, false);
  assert.match(markdown, /missing-control:source-fingerprint-recorded/);
});


function loadBuiltExtractors() {
  const { extractFile } = require(path.join(repoRoot, 'dist', 'core', 'extract.js'));
  const { toModelFacingPayload } = require(path.join(repoRoot, 'dist', 'core', 'payload', 'model-facing.js'));
  return { extractFile, toModelFacingPayload };
}

function buildReplay(overrides = {}) {
  return buildDeterministicFixtureReplay({
    repoRoot,
    runId: 'fixture-replay-test',
    generatedAt: '2026-04-23T00:00:00.000Z',
    fixtureRevision: 'test-fixture-revision',
    ...loadBuiltExtractors(),
    ...overrides,
  });
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('deterministic fixture replay builds with and without edit guidance from production payloads', () => {
  const replay = buildReplay();
  const validation = validateDeterministicFixtureReplay(replay);

  assert.equal(replay.schemaVersion, 'layer2-deterministic-outcome-fixture-replay.v1');
  assert.equal(replay.status, 'fixture-replay-only');
  assert.equal(replay.classification, 'pass');
  assert.equal(replay.pairedTarget.filePath, 'fixtures/compressed/HookEffectPanel.tsx');
  assert.equal(replay.pairedTarget.componentName, 'HookEffectPanel');
  assert.match(replay.comparisonInvariant, /same target file and component/);
  assert.deepEqual(replay.comparisonInputs.withoutEditGuidance, replay.comparisonInputs.withEditGuidance);
  assert.equal(replay.sourceIdentity.sourceFingerprint.fileHash.length, 64);
  assert.deepEqual(replay.sourceIdentity.sourceFingerprint, replay.sourceIdentity.defaultPayloadFingerprint);
  assert.deepEqual(replay.sourceIdentity.sourceFingerprint, replay.sourceIdentity.withGuidancePayloadFingerprint);
  assert.deepEqual(replay.sourceIdentity.sourceFingerprint, replay.sourceIdentity.editGuidanceFreshness);

  assert.equal(replay.variants.withoutEditGuidance.editGuidanceEnabled, false);
  assert.equal(replay.variants.withoutEditGuidance.sourceIdentityRef, 'sourceIdentity');
  assert.equal('selectedPatchTarget' in replay.variants.withoutEditGuidance, false);
  assert.equal('patchTargets' in replay.variants.withoutEditGuidance, false);
  assert.equal('editGuidance' in replay.variants.withoutEditGuidance, false);
  assert.equal(replay.variants.withoutEditGuidance.fallbackFullReadOrSearchRequired, true);

  assert.equal(replay.variants.withEditGuidance.editGuidanceEnabled, true);
  assert.equal(replay.variants.withEditGuidance.sourceIdentityRef, 'sourceIdentity');
  assert.equal(replay.variants.withEditGuidance.freshnessChecked, true);
  assert.ok(replay.variants.withEditGuidance.patchTargetsCount > 0);
  assert.ok(replay.variants.withEditGuidance.selectedPatchTarget.loc.startLine > 0);
  assert.equal(replay.variants.withEditGuidance.fallbackFullReadOrSearchRequired, false);
  assert.deepEqual(validation, { valid: true, blockers: [] });
});

test('deterministic fixture replay claimability contract rejects every premature claim', () => {
  const replay = buildReplay();

  for (const key of Object.keys(REQUIRED_FIXTURE_REPLAY_CLAIMABILITY)) {
    const trueClaim = deepClone(replay);
    trueClaim.claimability[key] = true;
    assert.ok(
      validateDeterministicFixtureReplay(trueClaim).blockers.includes(`claimability-${key}-must-be-false`),
      `${key} true should fail`,
    );

    const missingClaim = deepClone(replay);
    delete missingClaim.claimability[key];
    assert.ok(
      validateDeterministicFixtureReplay(missingClaim).blockers.includes(`missing-claimability:${key}`),
      `${key} missing should fail`,
    );

    const nonBooleanClaim = deepClone(replay);
    nonBooleanClaim.claimability[key] = 'false';
    assert.ok(
      validateDeterministicFixtureReplay(nonBooleanClaim).blockers.includes(`claimability-${key}-must-be-boolean-false`),
      `${key} non-boolean should fail`,
    );
  }

  const ambiguousClaim = deepClone(replay);
  ambiguousClaim.claimability.providerBillingSavings = false;
  assert.ok(validateDeterministicFixtureReplay(ambiguousClaim).blockers.includes('unexpected-claimability:providerBillingSavings'));
});

test('deterministic fixture replay enforces paired target and source identity equality', () => {
  const replay = buildReplay();

  const fileMismatch = deepClone(replay);
  fileMismatch.comparisonInputs.withEditGuidance.filePath = 'fixtures/compressed/FormControls.tsx';
  assert.ok(validateDeterministicFixtureReplay(fileMismatch).blockers.includes('paired-target-filePath-mismatch'));

  const componentMismatch = deepClone(replay);
  componentMismatch.comparisonInputs.withoutEditGuidance.componentName = 'OtherComponent';
  assert.ok(validateDeterministicFixtureReplay(componentMismatch).blockers.includes('paired-target-componentName-mismatch'));

  for (const field of ['defaultPayloadFingerprint', 'withGuidancePayloadFingerprint', 'editGuidanceFreshness']) {
    const mutated = deepClone(replay);
    mutated.sourceIdentity[field].fileHash = '0'.repeat(64);
    const validation = validateDeterministicFixtureReplay(mutated);
    assert.ok(validation.blockers.includes(`source-identity-mismatch:${field}`), `${field} mismatch should fail`);
  }

  const replayFingerprintMismatch = deepClone(replay);
  replayFingerprintMismatch.sourceIdentity.sourceFingerprint.fileHash = '1'.repeat(64);
  const blockers = validateDeterministicFixtureReplay(replayFingerprintMismatch).blockers.join('\n');
  assert.match(blockers, /source-identity-mismatch/);
});

test('deterministic fixture replay rejects invented patch targets and without-guidance leakage', () => {
  const replay = buildReplay();

  const inventedTarget = deepClone(replay);
  inventedTarget.variants.withEditGuidance.selectedPatchTarget = {
    kind: 'effect',
    label: 'inventedEffect',
    loc: { startLine: 1, endLine: 1 },
    reason: 'Invented target should not validate.',
  };
  assert.ok(
    validateDeterministicFixtureReplay(inventedTarget).blockers
      .includes('with-guidance-selectedPatchTarget-not-in-production-patchTargets'),
  );

  const missingLoc = deepClone(replay);
  delete missingLoc.variants.withEditGuidance.selectedPatchTarget.loc;
  const missingLocBlockers = validateDeterministicFixtureReplay(missingLoc).blockers;
  assert.ok(missingLocBlockers.includes('with-guidance-selectedPatchTarget-missing-loc'));
  assert.ok(missingLocBlockers.includes('with-guidance-selectedPatchTarget-not-in-production-patchTargets'));

  const forbiddenFields = {
    editGuidance: { patchTargets: [] },
    patchTargets: [],
    selectedPatchTarget: replay.variants.withEditGuidance.selectedPatchTarget,
  };
  for (const [field, value] of Object.entries(forbiddenFields)) {
    const leaked = deepClone(replay);
    leaked.variants.withoutEditGuidance[field] = value;
    assert.ok(
      validateDeterministicFixtureReplay(leaked).blockers.includes(`without-guidance-forbidden-field:${field}`),
      `${field} leakage should fail`,
    );
  }

  const freshnessLeak = deepClone(replay);
  freshnessLeak.variants.withoutEditGuidance.freshnessChecked = true;
  assert.ok(validateDeterministicFixtureReplay(freshnessLeak).blockers.includes('without-guidance-freshnessChecked-must-not-be-true'));

  const stepLeak = deepClone(replay);
  stepLeak.variants.withoutEditGuidance.targetLocalizationSteps.push('select-patchTarget');
  assert.ok(validateDeterministicFixtureReplay(stepLeak).blockers.includes('without-guidance-must-not-select-patchTarget'));
});

test('deterministic fixture replay reports inconclusive when patch targets are unavailable', () => {
  const replay = buildReplay({
    toModelFacingPayload(result, cwd, options) {
      const payload = loadBuiltExtractors().toModelFacingPayload(result, cwd, options);
      if (options?.includeEditGuidance && payload.editGuidance) {
        payload.editGuidance.patchTargets = [];
      }
      return payload;
    },
  });

  assert.equal(replay.classification, 'inconclusive');
  assert.ok(replay.classificationReasons.includes('missing-selected-patch-target'));
  assert.equal(replay.variants.withEditGuidance.fallbackFullReadOrSearchRequired, true);
});

test('deterministic fixture replay CLI writes JSON and Markdown without live execution', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fooks-deterministic-fixture-replay-'));
  const output = path.join(tempDir, 'fixture-replay.json');
  const markdown = path.join(tempDir, 'fixture-replay.md');

  execFileSync(process.execPath, [
    scaffoldPath,
    '--fixture-replay',
    `--output=${output}`,
    `--markdown=${markdown}`,
    '--run-id=cli-fixture-replay',
  ], { cwd: repoRoot, encoding: 'utf8' });

  const result = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.equal(result.validation.valid, true);
  assert.equal(result.status, 'fixture-replay-only');
  assert.equal(result.claimability.liveCodexOutcome, false);
  assert.equal(result.claimability.providerBillingTokenSavings, false);
  assert.equal(result.variants.withoutEditGuidance.editGuidanceEnabled, false);
  assert.equal('selectedPatchTarget' in result.variants.withoutEditGuidance, false);

  const md = fs.readFileSync(markdown, 'utf8');
  assert.match(md, /local deterministic target-localization evidence only/i);
  assert.match(md, /not live Codex\/Claude model outcome proof/i);
  assert.match(md, /providerTokenizerParity: false/);
  assert.doesNotMatch(md, /provider usage\/billing-token savings are proven/i);
  assert.doesNotMatch(md, /public edit win/i);
});

test('deterministic fixture replay markdown reports validation blockers and claimability', () => {
  const replay = buildReplay();
  replay.claimability.publicEditWin = true;
  const validation = validateDeterministicFixtureReplay(replay);
  const markdown = markdownForFixtureReplay(replay, validation);

  assert.equal(validation.valid, false);
  assert.match(markdown, /publicEditWin: true/);
  assert.match(markdown, /claimability-publicEditWin-must-be-false/);
  assert.match(markdown, /not live Codex\/Claude model outcome proof/);
});
