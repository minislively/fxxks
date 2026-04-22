#!/usr/bin/env node
/**
 * R4 Feature Module Split - Runner with Codex Wrapper
 */

const fs = require('fs');
const path = require('path');
const CodexWrapper = require('./codex-wrapper');

// Parse arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  if (key && value) {
    acc[key.replace(/^--/, '')] = value;
  }
  return acc;
}, {});

const mode = args.mode || 'vanilla';
const targetFile = args.target;
const outputPath = args.output;
const model = args.model || process.env.CODEX_MODEL || 'gpt-5.4-mini';

if (!targetFile || !outputPath) {
  console.error('Usage: node runner.js --mode=vanilla|fooks --target=<file> --output=<json>');
  process.exit(1);
}

console.log(`[R4 Runner] Mode: ${mode}`);
console.log(`[R4 Runner] Target: ${targetFile}`);

async function main() {
  // Prepare context based on mode
  let context;
  let fooksPath;
  
  if (mode === 'fooks') {
    // Use fooks extraction
    fooksPath = path.join(__dirname, '../../dist/index.js');
    console.log(`[R4 Runner] Using fooks: ${fooksPath}`);
    const fooks = require(fooksPath);
    const extraction = fooks.extractFile(targetFile);
    const promptSafeExtraction = {
      ...extraction,
      filePath: path.basename(targetFile),
    };
    context = JSON.stringify(promptSafeExtraction, null, 2);
  } else {
    // Vanilla mode: use full file
    console.log(`[R4 Runner] Vanilla mode: reading full file`);
    context = fs.readFileSync(targetFile, 'utf-8');
  }
  
  // Initialize Codex wrapper
  const codex = new CodexWrapper({
    model
  });
  
  // Execute Codex
  const taskPrompt = 'Refactor this combobox component into modular files (components/, hooks/, utils/, types/)';
  
  console.log(`[R4 Runner] Calling Codex...`);
  const result = await codex.run(context, taskPrompt);
  
  console.log(`[R4 Runner] Codex completed with exitCode: ${result.exitCode}`);
  console.log(`[R4 Runner] Latency: ${result.latencyMs}ms`);
  console.log(`[R4 Runner] Prompt tokens: ${result.metadata.promptTokens}`);
  
  // Save result
  const output = {
    mode,
    targetFile,
    timestamp: result.timestamp,
    codexResult: result,
    metrics: {
      promptTokensApprox: result.metadata.promptTokens,
      latencyMs: result.latencyMs,
      retryCount: 0,
      outputChars: result.lastMessage?.length || result.stdout.length,
      runtimeTokensInput: result.runtimeUsage.inputTokens,
      runtimeTokensOutput: result.runtimeUsage.outputTokens,
      runtimeTokensTotal: result.runtimeUsage.totalTokens,
      runtimeTokenSource: result.runtimeUsage.source,
      runtimeTokenTelemetryAvailable: result.runtimeUsage.totalTokens !== null,
      runtimeTokenClaimBoundary: result.runtimeUsage.claimBoundary,
    }
  };
  
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`[R4 Runner] Result saved to: ${outputPath}`);
  console.log(`[R4 Runner] Success: ${result.success}`);
}

main().catch(err => {
  console.error('[R4 Runner] Error:', err);
  process.exit(1);
});
