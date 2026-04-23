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
  assert.match(combined, /provider billing-token/);
  assert.match(combined, /automatic runtime defaults/);
  assert.doesNotMatch(combined, /provider billing-token savings are proven/);
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
  assert.match(md, /provider billing-token/i);
  assert.doesNotMatch(md, /provider billing-token savings are proven/i);
});

test('deterministic outcome scaffold markdown reports validation blockers', () => {
  const scaffold = buildDeterministicOutcomeScaffold({ runId: 'markdown-invalid' });
  scaffold.deterministicControls = scaffold.deterministicControls.filter((item) => item !== 'source-fingerprint-recorded');

  const validation = validateDeterministicOutcomeScaffold(scaffold);
  const markdown = markdownForScaffold(scaffold, validation);
  assert.equal(validation.valid, false);
  assert.match(markdown, /missing-control:source-fingerprint-recorded/);
});
