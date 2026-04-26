#!/usr/bin/env node
/**
 * Build a bounded, reviewable summary from two Layer 2 R4 runner outputs.
 *
 * This intentionally validates only proposal-smoke properties. It does not
 * execute generated code, run TypeScript, or claim provider usage/billing-token telemetry.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function parseArgs(argv) {
  return argv.reduce((acc, arg) => {
    const [key, ...rest] = arg.split('=');
    if (key.startsWith('--') && rest.length > 0) {
      acc[key.slice(2)] = rest.join('=');
    }
    return acc;
  }, {});
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function approxReduction(before, after) {
  if (!Number.isFinite(before) || !Number.isFinite(after) || before <= 0) {
    return null;
  }
  return Number((((before - after) / before) * 100).toFixed(1));
}

function latencyReduction(before, after) {
  if (!Number.isFinite(before) || !Number.isFinite(after) || before <= 0) {
    return null;
  }
  return Number((((before - after) / before) * 100).toFixed(1));
}

function extractRun(input) {
  const result = input.codexResult || {};
  const metrics = input.metrics || {};
  return {
    mode: input.mode,
    success: Boolean(result.success),
    exitCode: result.exitCode,
    signal: result.signal ?? null,
    promptTokensApprox: metrics.promptTokensApprox,
    latencyMs: metrics.latencyMs,
    outputChars: metrics.outputChars,
    retryCount: metrics.retryCount ?? 0,
    model: result.metadata?.model,
    targetFile: input.targetFile,
    lastMessage: result.lastMessage || '',
  };
}

function mentionAll(text, patterns) {
  return patterns.every((pattern) => pattern.test(text));
}

function runChecks(vanilla, fooks) {
  const combined = `${vanilla.lastMessage}\n${fooks.lastMessage}`;
  const expectedDirs = [/components\//i, /hooks\//i, /utils\//i, /types\//i];
  const expectedBarrels = [/index\.ts/i, /barrel/i];
  const absolutePathLeak = /\/tmp\/|\/Users\/|\/home\/|\\Users\\/i;

  const checks = [
    {
      name: 'both runs exited successfully',
      passed: vanilla.success === true && fooks.success === true && vanilla.exitCode === 0 && fooks.exitCode === 0,
    },
    {
      name: 'both runs produced proposal text',
      passed: vanilla.lastMessage.length > 500 && fooks.lastMessage.length > 500,
    },
    {
      name: 'both proposals mention target modular directories',
      passed: mentionAll(vanilla.lastMessage, expectedDirs) && mentionAll(fooks.lastMessage, expectedDirs),
    },
    {
      name: 'both proposals mention barrel/index exports',
      passed: expectedBarrels.some((pattern) => pattern.test(vanilla.lastMessage))
        && expectedBarrels.some((pattern) => pattern.test(fooks.lastMessage)),
    },
    {
      name: 'proposal text does not leak local absolute target paths',
      passed: !absolutePathLeak.test(combined),
    },
    {
      name: 'prompt-size delta is computable',
      passed: Number.isFinite(vanilla.promptTokensApprox)
        && Number.isFinite(fooks.promptTokensApprox)
        && vanilla.promptTokensApprox > fooks.promptTokensApprox,
    },
  ];

  return {
    type: 'proposal-smoke-validation',
    passed: checks.every((check) => check.passed),
    checks,
    acceptanceValidation: {
      status: 'not-run',
      reason: 'runner is read-only and returns proposal/code skeletons; no generated project files were applied or typechecked',
    },
  };
}

function getCodexVersion() {
  try {
    return execFileSync('codex', ['--version'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.vanilla || !args.fooks || !args.output) {
    console.error('Usage: node summarize-r4-smoke.js --vanilla=<json> --fooks=<json> --output=<json> [--id=<id>]');
    process.exit(1);
  }

  const vanilla = extractRun(readJson(args.vanilla));
  const fooks = extractRun(readJson(args.fooks));
  const validation = runChecks(vanilla, fooks);
  const output = {
    status: validation.passed ? 'proposal-only-paired-smoke-validated' : 'proposal-only-paired-smoke-needs-review',
    pairId: args.id || path.basename(args.output, '.json'),
    date: new Date().toISOString().slice(0, 10),
    target: 'shadcn-ui apps/v4/registry/bases/radix/examples/combobox-example.tsx',
    runner: 'benchmarks/layer2-frontend-task/runner.js',
    wrapper: 'benchmarks/layer2-frontend-task/codex-wrapper.js',
    model: vanilla.model || fooks.model || process.env.CODEX_MODEL || 'unknown',
    codexCli: getCodexVersion(),
    sandbox: 'read-only',
    modeBoundary: 'fooks mode sanitizes the source file path before prompt construction and instructs Codex to use only provided context.',
    results: {
      vanilla: {
        success: vanilla.success,
        exitCode: vanilla.exitCode,
        promptTokensApprox: vanilla.promptTokensApprox,
        latencyMs: vanilla.latencyMs,
        outputChars: vanilla.outputChars,
        retryCount: vanilla.retryCount,
      },
      fooks: {
        success: fooks.success,
        exitCode: fooks.exitCode,
        promptTokensApprox: fooks.promptTokensApprox,
        latencyMs: fooks.latencyMs,
        outputChars: fooks.outputChars,
        retryCount: fooks.retryCount,
      },
    },
    deltas: {
      promptTokensApproxReductionPct: approxReduction(vanilla.promptTokensApprox, fooks.promptTokensApprox),
      latencyReductionPct: latencyReduction(vanilla.latencyMs, fooks.latencyMs),
    },
    validation,
    claimBoundary: [
      'proposal/skeleton output only',
      'promptTokensApprox is prompt-size accounting, not provider usage/billing-token telemetry',
      'proposal-smoke validation checks output shape and boundary only',
      'acceptance/quality validation remains not-run until generated files are applied and typechecked',
      'not enough evidence for stable runtime-token or latency claims',
    ],
  };

  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, `${JSON.stringify(output, null, 2)}\n`);
  if (!validation.passed) {
    console.error(JSON.stringify(output.validation, null, 2));
    process.exit(2);
  }
  console.log(JSON.stringify({
    output: args.output,
    promptTokensApproxReductionPct: output.deltas.promptTokensApproxReductionPct,
    validation: output.validation.passed,
  }, null, 2));
}

if (require.main === module) {
  main();
}
