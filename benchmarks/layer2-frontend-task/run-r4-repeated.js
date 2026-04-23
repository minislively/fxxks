#!/usr/bin/env node
'use strict';

/**
 * Run repeated matched R4 applied-code pairs and summarize the narrow L1 signal.
 *
 * The output is deliberately conservative: it can identify a same-task L1
 * candidate or a diagnostic failure, but it never proves provider billing-token
 * savings, provider costs, broad multi-task wins, Claude wins, or opencode wins.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { summarizeRepeatedPairs, writeSummary } = require('./r4-repeated-summary');
const { ensureEvidenceDir, evidencePaths, timestampRunId } = require('./evidence-paths');

function parseArgs(argv) {
  return argv.reduce((acc, arg) => {
    const [key, ...rest] = arg.split('=');
    if (key.startsWith('--')) {
      const name = key.slice(2);
      const value = rest.length > 0 ? rest.join('=') : true;
      if (name === 'seed-pair') acc[name] = [...(acc[name] || []), value];
      else acc[name] = value;
    }
    return acc;
  }, {});
}

function runApplied({ mode, target, output, provider, model, timeoutMs, keepWorkdir }) {
  const args = [
    path.join(__dirname, 'run-r4-applied.js'),
    `--mode=${mode}`,
    `--target=${target}`,
    `--output=${output}`,
    `--provider=${provider}`,
    `--model=${model}`,
    `--timeoutMs=${timeoutMs}`,
  ];
  if (keepWorkdir) args.push('--keep-workdir');

  const result = spawnSync(process.execPath, args, {
    cwd: path.resolve(__dirname, '..', '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  return result.status === 0;
}

function seedPairs(values) {
  return (values || []).map((value, index) => {
    const [vanillaPath, fooksPath] = String(value).split(':');
    if (!vanillaPath || !fooksPath) {
      throw new Error(`Invalid --seed-pair at index ${index + 1}; expected <vanilla.json>:<fooks.json>`);
    }
    return { pairIndex: index + 1, vanillaPath, fooksPath };
  });
}

function usage() {
  return 'Usage: node run-r4-repeated.js --target=<file> [--output=<summary.json>] [--results-dir=<dir>] [--required-accepted=5] [--max-pairs=8] [--provider=codex|claude] [--model=<model>] [--timeoutMs=300000] [--run-id=<id>] [--task-id=<id>] [--setup-id=<id>] [--seed-pair=<vanilla.json>:<fooks.json>] [--keep-workdir]';
}

function taskIdentityFromTarget(target) {
  if (!target) return null;
  return `target:${path.relative(process.cwd(), path.resolve(target)).split(path.sep).join('/')}`;
}

function setupIdentity({ taskIdentity, provider, model, requiredAcceptedPairs, explicitSetupId }) {
  if (explicitSetupId) return explicitSetupId;
  return [
    `task=${taskIdentity || 'unspecified-task'}`,
    `provider=${provider || 'unspecified-provider'}`,
    `model=${model || 'unspecified-model'}`,
    'runner=run-r4-repeated',
    'prompt=R4-feature-module-split-v1',
    'validator=validate-r4-applied',
    'modePair=vanilla-vs-fooks',
    `requiredAccepted=${requiredAcceptedPairs}`,
  ].join('|');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = args.target;
  const runId = args['run-id'] || timestampRunId('runtime');
  const defaultPaths = args.output ? null : evidencePaths({
    tier: 'runtime',
    runId,
    jsonName: 'summary.json',
    markdownName: 'summary.md',
  });
  const output = args.output || defaultPaths.json;
  const requiredAcceptedPairs = Number(args['required-accepted'] || 5);
  const maxPairs = Number(args['max-pairs'] || requiredAcceptedPairs);
  const provider = args.provider || 'codex';
  const model = args.model || process.env.CODEX_MODEL || process.env.CLAUDE_MODEL || 'gpt-5.4-mini';
  const taskIdentity = args['task-id'] || taskIdentityFromTarget(target);
  const resolvedSetupIdentity = setupIdentity({
    taskIdentity,
    provider,
    model,
    requiredAcceptedPairs,
    explicitSetupId: args['setup-id'] || args['setup-identity'],
  });
  const timeoutMs = Number(args.timeoutMs || process.env.CODEX_TIMEOUT_MS || process.env.CLAUDE_TIMEOUT_MS || 300000);
  const resultsDir = args['results-dir'] || (defaultPaths
    ? path.join(defaultPaths.dir, 'pairs')
    : path.dirname(output));
  const keepWorkdir = Boolean(args['keep-workdir']);
  const pairs = seedPairs(args['seed-pair']);

  if ((!target && pairs.length < maxPairs) || !output || requiredAcceptedPairs < 1 || maxPairs < 1) {
    console.error(usage());
    process.exit(1);
  }
  if (defaultPaths) ensureEvidenceDir({ tier: 'runtime', runId });
  fs.mkdirSync(resultsDir, { recursive: true });
  let nextPairIndex = pairs.length + 1;

  while (pairs.length < maxPairs) {
    const pairIndex = nextPairIndex;
    nextPairIndex += 1;
    const prefix = path.join(resultsDir, `R4-repeated-${runId}-pair-${pairIndex}`);
    const vanillaPath = `${prefix}-vanilla.json`;
    const fooksPath = `${prefix}-fooks.json`;

    runApplied({ mode: 'vanilla', target, output: vanillaPath, provider, model, timeoutMs, keepWorkdir });
    runApplied({ mode: 'fooks', target, output: fooksPath, provider, model, timeoutMs, keepWorkdir });
    pairs.push({ pairIndex, vanillaPath, fooksPath });

    const interim = summarizeRepeatedPairs({
      runId,
      taskIdentity,
      model,
      setupIdentity: resolvedSetupIdentity,
      requiredAcceptedPairs,
      pairs,
    });
    writeSummary(output, interim);
    if (interim.acceptedPairCount >= requiredAcceptedPairs) break;
  }

  const summary = summarizeRepeatedPairs({
    runId,
    taskIdentity,
    model,
    setupIdentity: resolvedSetupIdentity,
    requiredAcceptedPairs,
    pairs,
  });
  writeSummary(output, summary);
  console.log(JSON.stringify({
    output,
    runId,
    classification: summary.classification,
    candidateStatus: summary.candidate.status,
    acceptedPairCount: summary.acceptedPairCount,
    attemptedPairCount: summary.attemptedPairCount,
  }, null, 2));
  if (summary.acceptedPairCount < requiredAcceptedPairs) process.exit(2);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
