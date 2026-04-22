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

function runApplied({ mode, target, output, model, timeoutMs, keepWorkdir }) {
  const args = [
    path.join(__dirname, 'run-r4-applied.js'),
    `--mode=${mode}`,
    `--target=${target}`,
    `--output=${output}`,
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
  return 'Usage: node run-r4-repeated.js --target=<file> --output=<summary.json> [--results-dir=<dir>] [--required-accepted=5] [--max-pairs=8] [--model=gpt-5.4-mini] [--timeoutMs=300000] [--run-id=<id>] [--seed-pair=<vanilla.json>:<fooks.json>] [--keep-workdir]';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = args.target;
  const output = args.output;
  const requiredAcceptedPairs = Number(args['required-accepted'] || 5);
  const maxPairs = Number(args['max-pairs'] || requiredAcceptedPairs);
  const model = args.model || process.env.CODEX_MODEL || 'gpt-5.4-mini';
  const timeoutMs = Number(args.timeoutMs || process.env.CODEX_TIMEOUT_MS || 300000);
  const runId = args['run-id'] || new Date().toISOString().slice(0, 10);
  const resultsDir = args['results-dir'] || path.dirname(output || path.join('benchmarks', 'layer2-frontend-task', 'results', 'summary.json'));
  const keepWorkdir = Boolean(args['keep-workdir']);

  if (!target || !output || requiredAcceptedPairs < 1 || maxPairs < 1) {
    console.error(usage());
    process.exit(1);
  }

  const pairs = seedPairs(args['seed-pair']);
  let nextPairIndex = pairs.length + 1;

  while (pairs.length < maxPairs) {
    const pairIndex = nextPairIndex;
    nextPairIndex += 1;
    const prefix = path.join(resultsDir, `R4-repeated-${runId}-pair-${pairIndex}`);
    const vanillaPath = `${prefix}-vanilla.json`;
    const fooksPath = `${prefix}-fooks.json`;

    runApplied({ mode: 'vanilla', target, output: vanillaPath, model, timeoutMs, keepWorkdir });
    runApplied({ mode: 'fooks', target, output: fooksPath, model, timeoutMs, keepWorkdir });
    pairs.push({ pairIndex, vanillaPath, fooksPath });

    const interim = summarizeRepeatedPairs({ requiredAcceptedPairs, pairs });
    writeSummary(output, interim);
    if (interim.acceptedPairCount >= requiredAcceptedPairs) break;
  }

  const summary = summarizeRepeatedPairs({ requiredAcceptedPairs, pairs });
  writeSummary(output, summary);
  console.log(JSON.stringify({ output, classification: summary.classification, acceptedPairCount: summary.acceptedPairCount, attemptedPairCount: summary.attemptedPairCount }, null, 2));
  if (summary.acceptedPairCount < requiredAcceptedPairs) process.exit(2);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
