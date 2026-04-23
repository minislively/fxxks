#!/usr/bin/env node
/**
 * Run an applied-code R4 benchmark attempt in an isolated workspace.
 *
 * Supports both Codex and Claude providers via --provider flag.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { validate } = require('./validate-r4-applied');
const { parseCodexRuntimeUsage } = require('./runtime-token-metrics');
const ClaudeWrapper = require('./claude-wrapper');

function parseArgs(argv) {
  return argv.reduce((acc, arg) => {
    const [key, ...rest] = arg.split('=');
    if (key.startsWith('--')) acc[key.slice(2)] = rest.length > 0 ? rest.join('=') : true;
    return acc;
  }, {});
}

function promptTokensApprox(text) {
  return Math.ceil(text.length / 3.5);
}

function buildContext(mode, targetFile) {
  if (mode === 'fooks') {
    const fooksPath = path.join(__dirname, '../../dist/index.js');
    const fooks = require(fooksPath);
    const extraction = fooks.extractFile(targetFile);
    return JSON.stringify({ ...extraction, filePath: path.basename(targetFile) }, null, 2);
  }
  return fs.readFileSync(targetFile, 'utf8');
}

function buildPrompt(context) {
  return `You are running an applied-code benchmark for the R4 Feature Module Split task.

Create a new directory named exactly ./combobox with this file tree:

combobox/
  components/index.ts
  components/Combobox.tsx
  components/ComboboxInput.tsx
  components/ComboboxList.tsx
  components/ComboboxItem.tsx
  hooks/index.ts
  hooks/useCombobox.ts
  utils/index.ts
  utils/combobox-utils.ts
  types/index.ts
  types/combobox-types.ts

Requirements:
1. Preserve the public component intent from the provided context.
2. Keep every generated file under 200 lines.
3. Use TypeScript exports and imports that typecheck without circular dependencies.
4. Add barrel exports in every index.ts; ensure utils/index.ts exports combobox-utils consumers.
5. Do not edit files outside ./combobox.
6. Prefer self-contained generated code over imports from unavailable packages.
7. Do not import React, react/jsx-runtime, DOM libraries, or any external package.
8. Do not use JSX; the .tsx files must be plain TypeScript modules/functions.
9. hooks/useCombobox.ts must be plain TypeScript with dependency-free state/data helpers.
10. Use ASCII-only source text.
11. Add an explicit readonly-array guard where input options/items are normalized.
12. Keep domain types simple and concrete; prefer string/number/null value types over unconstrained generic component APIs unless the generic is obviously type-safe.
13. Keep the final response under 120 words and do not include full diffs.

Context:
${context}

Write the files now. Do not only describe a plan; create the files in the workspace.`;
}

function runCodex(prompt, workdir, model, timeoutMs) {
  const startedAt = Date.now();
  const lastMessagePath = path.join(workdir, 'last-message.txt');
  const args = [
    'exec',
    '--ephemeral',
    '--skip-git-repo-check',
    '--sandbox',
    'workspace-write',
    '-C',
    workdir,
    '-m',
    model,
    '-o',
    lastMessagePath,
    '-',
  ];

  return new Promise((resolve, reject) => {
    const child = spawn('codex', args, {
      env: { ...process.env },
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });
    child.on('error', reject);
    child.on('close', (exitCode, signal) => {
      const lastMessage = fs.existsSync(lastMessagePath) ? fs.readFileSync(lastMessagePath, 'utf8') : '';
      const runtimeUsage = parseCodexRuntimeUsage(stdout, stderr, lastMessage);
      resolve({
        exitCode,
        signal,
        success: exitCode === 0,
        stdout,
        stderr,
        lastMessage,
        runtimeUsage,
        latencyMs: Date.now() - startedAt,
      });
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

async function runClaude(prompt, workdir, model, timeoutMs) {
  const wrapper = new ClaudeWrapper({ model, timeoutMs });
  const result = await wrapper.run(prompt, 'Write the files now. Do not only describe a plan; create the files in the workspace.');

  // Write files to workdir if Claude returned code blocks
  if (result.success && result.lastMessage) {
    const codeBlocks = extractCodeBlocks(result.lastMessage);
    for (const block of codeBlocks) {
      const filePath = path.join(workdir, block.filePath);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, block.content);
    }
  }

  return {
    exitCode: result.exitCode,
    signal: null,
    success: result.success,
    stdout: result.stdout,
    stderr: result.stderr,
    lastMessage: result.lastMessage,
    runtimeUsage: result.runtimeUsage,
    latencyMs: result.latencyMs,
  };
}

function extractCodeBlocks(text) {
  const blocks = [];
  const fenceRegex = /```(?:\w+)?\s*\n([\s\S]*?)```/g;
  const filePathRegex = /^(?:\s*\/\/\s*)?(?:File:\s*)?(.+\.(?:ts|tsx|js|jsx))\s*\n/;
  let match;
  while ((match = fenceRegex.exec(text)) !== null) {
    let content = match[1];
    const fileMatch = content.match(filePathRegex);
    if (fileMatch) {
      const filePath = fileMatch[1].trim();
      content = content.slice(fileMatch[0].length);
      blocks.push({ filePath, content });
    }
  }
  return blocks;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.mode || 'vanilla';
  const targetFile = args.target;
  const outputPath = args.output;
  const provider = args.provider || 'codex';
  const model = args.model || process.env.CODEX_MODEL || process.env.CLAUDE_MODEL || 'gpt-5.4-mini';
  const timeoutMs = Number(args.timeoutMs || process.env.CODEX_TIMEOUT_MS || process.env.CLAUDE_TIMEOUT_MS || 300000);
  const keepWorkdir = Boolean(args['keep-workdir']);

  if (!targetFile || !outputPath || !['vanilla', 'fooks'].includes(mode)) {
    console.error('Usage: node run-r4-applied.js --mode=vanilla|fooks --target=<file> --output=<json> [--provider=codex|claude] [--model=<model>] [--timeoutMs=<ms>] [--keep-workdir]');
    process.exit(1);
  }

  const workdir = args.workdir ? path.resolve(args.workdir) : fs.mkdtempSync(path.join(os.tmpdir(), `fooks-r4-applied-${provider}-${mode}-`));
  fs.mkdirSync(workdir, { recursive: true });
  const context = buildContext(mode, targetFile);
  const prompt = buildPrompt(context);
  const timestamp = new Date().toISOString();

  let providerResult;
  if (provider === 'claude') {
    providerResult = await runClaude(prompt, workdir, model, timeoutMs);
  } else {
    providerResult = await runCodex(prompt, workdir, model, timeoutMs);
  }

  const candidateRoot = path.join(workdir, 'combobox');
  let validation;
  try {
    validation = validate(candidateRoot, { typecheck: 'auto' });
  } catch (error) {
    validation = {
      status: 'applied-acceptance-failed',
      error: error.message,
      targetRoot: candidateRoot,
    };
  }

  const artifact = {
    status: providerResult.success && validation.status === 'applied-acceptance-validated'
      ? 'applied-code-run-validated'
      : 'applied-code-run-failed',
    schemaVersion: 'layer2-r4-applied-run.v1',
    timestamp,
    mode,
    provider,
    targetFile: path.resolve(targetFile),
    model,
    sandbox: 'workspace-write isolated tempdir',
    workdir: keepWorkdir ? workdir : null,
    metrics: {
      promptTokensApprox: promptTokensApprox(prompt),
      latencyMs: providerResult.latencyMs,
      retryCount: 0,
      outputChars: providerResult.lastMessage.length || providerResult.stdout.length,
      runtimeTokensInput: providerResult.runtimeUsage.inputTokens,
      runtimeTokensOutput: providerResult.runtimeUsage.outputTokens,
      runtimeTokensTotal: providerResult.runtimeUsage.totalTokens,
      runtimeTokenSource: providerResult.runtimeUsage.source,
      runtimeTokenTelemetryAvailable: providerResult.runtimeUsage.totalTokens !== null,
      runtimeTokenClaimAvailable: providerResult.runtimeUsage.totalTokens !== null,
      runtimeTokenClaimBoundary: providerResult.runtimeUsage.claimBoundary,
    },
    providerResult: {
      exitCode: providerResult.exitCode,
      signal: providerResult.signal,
      success: providerResult.success,
      stderrTail: providerResult.stderr.slice(-4000),
      stdoutTail: providerResult.stdout.slice(-4000),
      lastMessageTail: providerResult.lastMessage.slice(-4000),
    },
    validation,
    claimBoundary: [
      'A single applied-code run can support candidate acceptance for this run only.',
      'Matched vanilla/fooks applied runs are required before comparing modes.',
      'Repeated multi-task evidence is required before stable runtime-token/time claims.',
      'Provider billing-token savings still require provider usage telemetry.',
    ],
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
  if (!keepWorkdir && !args.workdir) fs.rmSync(workdir, { recursive: true, force: true });
  console.log(JSON.stringify({ output: outputPath, status: artifact.status, validation: validation.status }, null, 2));
  if (artifact.status !== 'applied-code-run-validated') process.exit(2);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
