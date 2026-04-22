#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const index = arg.indexOf('=');
    const key = index === -1 ? arg.slice(2) : arg.slice(2, index);
    const value = index === -1 ? true : arg.slice(index + 1);
    args[key] = value;
  }
  return args;
}

function repoRootFromHere() {
  return path.resolve(__dirname, '..', '..');
}

function expandHome(value) {
  if (!value || !value.startsWith('~')) return value;
  return path.join(process.env.HOME || '', value.slice(1));
}

function bytes(text) {
  return Buffer.byteLength(text, 'utf8');
}

function pctReduction(baselineBytes, fooksBytes) {
  if (!baselineBytes) return null;
  return Number(((1 - (fooksBytes / baselineBytes)) * 100).toFixed(3));
}

function loadFooksExtractors(repoRoot) {
  const distIndex = path.join(repoRoot, 'dist', 'index.js');
  const distPayload = path.join(repoRoot, 'dist', 'core', 'payload', 'model-facing.js');
  if (!fs.existsSync(distIndex) || !fs.existsSync(distPayload)) {
    throw new Error('Built dist files are required. Run `npm run build` before building a corrected provider-cost manifest.');
  }
  return {
    extractFile: require(distIndex).extractFile,
    toModelFacingPayload: require(distPayload).toModelFacingPayload,
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function makeTask({
  contextsDir,
  extractFile,
  toModelFacingPayload,
  id,
  sourceRoot,
  sourceRootLabel,
  targetFile,
  instruction,
  targetPairCount,
}) {
  const absoluteTarget = path.resolve(sourceRoot, targetFile);
  if (!fs.existsSync(absoluteTarget)) {
    throw new Error(`Target file not found for ${id}: ${absoluteTarget}`);
  }
  const sourceText = fs.readFileSync(absoluteTarget, 'utf8');
  const fooksPayload = toModelFacingPayload(extractFile(absoluteTarget), sourceRoot);
  const fooksPayloadText = JSON.stringify(fooksPayload, null, 2);
  const baselineContextPath = path.join(contextsDir, `${id}.baseline.source.txt`);
  const fooksContextPath = path.join(contextsDir, `${id}.fooks.payload.json`);
  fs.writeFileSync(baselineContextPath, sourceText);
  fs.writeFileSync(fooksContextPath, fooksPayloadText);
  const sourceBytes = bytes(sourceText);
  const payloadBytes = bytes(fooksPayloadText);
  return {
    id,
    targetPairCount,
    repetitions: targetPairCount,
    targetFile,
    sourceRootLabel,
    instruction,
    baselineContextPath: path.relative(path.dirname(path.join(contextsDir, '..', 'manifest.json')), baselineContextPath).split(path.sep).join('/'),
    fooksContextPath: path.relative(path.dirname(path.join(contextsDir, '..', 'manifest.json')), fooksContextPath).split(path.sep).join('/'),
    baselineContextFormat: 'source',
    fooksContextFormat: 'json',
    setupIdentity: 'corrected-real-payload-no-tool',
    pairOrder: 'abba',
    requireNoToolUse: true,
    qualityGate: {
      id: 'corrected-payload-validation',
      version: 'v1',
      status: 'passed',
      command: 'answers must use only the prompt payload; runner may fail the side gate when Codex command_execution events are observed',
    },
    payloadStats: {
      baselineBytes: sourceBytes,
      fooksPayloadBytes: payloadBytes,
      promptPayloadReductionPct: pctReduction(sourceBytes, payloadBytes),
      fooksMode: fooksPayload.mode,
    },
  };
}

function requireSourceRoot(value, label) {
  const resolved = path.resolve(expandHome(value || ''));
  if (!fs.existsSync(resolved)) {
    throw new Error(`${label} root not found: ${resolved}`);
  }
  return resolved;
}

function taskSpecsForProfile(profile, args, repoRoot) {
  const nextjsRoot = args['nextjs-root']
    || process.env.FOOKS_NEXTJS_ROOT
    || '~/Workspace/fooks-test-repos/nextjs';
  const tailwindRoot = args['tailwindcss-root']
    || args['tailwind-root']
    || process.env.FOOKS_TAILWINDCSS_ROOT
    || '~/Workspace/fooks-test-repos/tailwindcss';

  const fixtures = [
    {
      id: 'form-section-component-summary',
      sourceRoot: repoRoot,
      sourceRootLabel: 'fooks-fixtures',
      targetFile: 'fixtures/compressed/FormSection.tsx',
      instruction: 'Summarize this React form section component. Include component responsibilities, props/state contract, behavior boundaries, and extraction risks.',
    },
    {
      id: 'form-section-refactor-plan',
      sourceRoot: repoRoot,
      sourceRootLabel: 'fooks-fixtures',
      targetFile: 'fixtures/compressed/FormSection.tsx',
      instruction: 'Draft a concise behavior-preserving refactor plan for this React form section. Include split boundaries, tests, migration steps, and rollback signals.',
    },
    {
      id: 'dashboard-test-strategy',
      sourceRoot: repoRoot,
      sourceRootLabel: 'fooks-fixtures',
      targetFile: 'fixtures/hybrid/DashboardPanel.tsx',
      instruction: 'Create a behavior-preserving test strategy for this dashboard component. Include unit/integration coverage, interaction risks, edge cases, and acceptance criteria.',
    },
  ];

  const nextjsLarge = () => {
    const root = requireSourceRoot(nextjsRoot, 'Next.js');
    return [
      {
        id: 'nextjs-app-router-summary',
        sourceRoot: root,
        sourceRootLabel: 'nextjs',
        targetFile: 'packages/next/src/client/components/app-router.tsx',
        instruction: 'Summarize this Next.js App Router client component. Include responsibilities, state/context contract, navigation boundaries, and risks for editing it.',
      },
      {
        id: 'nextjs-layout-router-refactor-plan',
        sourceRoot: root,
        sourceRootLabel: 'nextjs',
        targetFile: 'packages/next/src/client/components/layout-router.tsx',
        instruction: 'Draft a behavior-preserving refactor/extraction plan for this Next.js layout router component. Include boundaries, invariants, tests, and rollback signals.',
      },
      {
        id: 'nextjs-error-boundary-test-strategy',
        sourceRoot: root,
        sourceRootLabel: 'nextjs',
        targetFile: 'packages/next/src/client/components/error-boundary.tsx',
        instruction: 'Create a behavior-preserving test strategy for this Next.js error boundary component. Include rendering paths, recovery behavior, edge cases, and acceptance criteria.',
      },
    ];
  };

  const tailwindLarge = () => {
    const root = requireSourceRoot(tailwindRoot, 'TailwindCSS');
    return [
      {
        id: 'tailwind-utilities-summary',
        sourceRoot: root,
        sourceRootLabel: 'tailwindcss',
        targetFile: 'packages/tailwindcss/src/utilities.ts',
        instruction: 'Summarize this Tailwind CSS utilities module. Include API responsibilities, parsing/generation boundaries, extension points, and correctness risks.',
      },
      {
        id: 'tailwind-variants-refactor-plan',
        sourceRoot: root,
        sourceRootLabel: 'tailwindcss',
        targetFile: 'packages/tailwindcss/src/variants.ts',
        instruction: 'Draft a behavior-preserving refactor plan for this Tailwind CSS variants module. Include invariants, split boundaries, tests, and rollback signals.',
      },
      {
        id: 'tailwind-css-parser-test-strategy',
        sourceRoot: root,
        sourceRootLabel: 'tailwindcss',
        targetFile: 'packages/tailwindcss/src/css-parser.ts',
        instruction: 'Create a behavior-preserving test strategy for this Tailwind CSS parser module. Include parser edge cases, regression fixtures, malformed input, and acceptance criteria.',
      },
    ];
  };

  if (profile === 'fixtures') return fixtures;
  if (profile === 'nextjs-large') return nextjsLarge();
  if (profile === 'tailwind-large' || profile === 'tailwindcss-large') return tailwindLarge();
  if (profile === 'nextjs-tailwind-large') return [
    ...nextjsLarge().slice(0, 2),
    tailwindLarge()[0],
  ];
  throw new Error(`Unknown --profile=${profile}; expected fixtures, nextjs-large, tailwind-large, or nextjs-tailwind-large`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log([
      'Usage:',
      '  node benchmarks/layer2-frontend-task/build-provider-cost-corrected-manifest.js [--profile=fixtures|nextjs-large|tailwind-large|nextjs-tailwind-large] [--output=<json>] [--target-pair-count=5]',
      '',
      'Builds a corrected provider-cost task manifest with real full-source baseline payloads and real fooks model-facing payloads.',
      'External profiles use --nextjs-root=<dir> and/or --tailwindcss-root=<dir> (defaults under ~/Workspace/fooks-test-repos).',
    ].join('\n'));
    return;
  }

  const repoRoot = repoRootFromHere();
  const profile = args.profile || 'fixtures';
  const runId = args['run-id'] || 'provider-cost-corrected-real-payload';
  const outputPath = path.resolve(args.output || path.join(repoRoot, '.fooks', 'evidence', 'provider-cost', runId, 'corrected-task-manifest.json'));
  const contextsDir = path.join(path.dirname(outputPath), 'contexts');
  const targetPairCount = Number(args['target-pair-count'] || 5);
  if (!Number.isFinite(targetPairCount) || targetPairCount <= 0) {
    throw new Error(`Invalid --target-pair-count: ${args['target-pair-count']}`);
  }
  fs.mkdirSync(contextsDir, { recursive: true });
  const { extractFile, toModelFacingPayload } = loadFooksExtractors(repoRoot);

  const taskSpecs = taskSpecsForProfile(profile, args, repoRoot);

  const tasks = taskSpecs.map((spec) => makeTask({
    contextsDir,
    extractFile,
    toModelFacingPayload,
    targetPairCount,
    ...spec,
  }));

  const manifest = {
    schemaVersion: 'provider-cost-task-manifest.v1',
    description: 'Corrected provider-cost campaign: real full-source baseline payloads vs real fooks model-facing payloads, AB/BA order, isolated/no-tool evidence policy.',
    profile,
    requiredTaskClasses: 3,
    requiredAcceptedPairsPerTask: targetPairCount,
    recommendedRunnerArgs: {
      liveOpenAI: true,
      authMode: 'codex-oauth',
      transport: 'codex-exec',
      codexWorkdir: 'isolated',
      pairOrder: 'abba',
      requireNoToolUse: true,
    },
    tasks,
  };
  writeJson(outputPath, manifest);
  console.log(JSON.stringify({
    output: path.relative(process.cwd(), outputPath).split(path.sep).join('/'),
    contextsDir: path.relative(process.cwd(), contextsDir).split(path.sep).join('/'),
    profile,
    taskCount: tasks.length,
    payloadStats: tasks.map((task) => ({ id: task.id, ...task.payloadStats })),
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`[provider-cost-corrected-manifest] ${error.message}`);
  process.exit(1);
}
