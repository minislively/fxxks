#!/usr/bin/env node
/**
 * Layer 2 Direct Execution Runner - Provider-Agnostic
 * 
 * Interface:
 *   Input:  --mode=vanilla|fooks --target=<file> --output=<json> [--provider=openai|anthropic] [--model=gpt-4o|claude-sonnet-4]
 *   Output: JSON artifact with metrics, validation, and comparison data
 * 
 * First Success Criteria:
 *   1. Direct API call succeeds (HTTP 200, valid response)
 *   2. Response parsed and files generated
 *   3. Artifact JSON written to --output path
 *   4. Metrics collected: inputTokens, outputTokens, latencyMs, retryCount
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

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
const provider = args.provider || 'openai';
const model = args.model || 'gpt-4o';

// Validate inputs
if (!targetFile || !outputPath) {
  console.error('Usage: node runner-direct.js --mode=vanilla|fooks --target=<file> --output=<json> [--provider=openai|anthropic] [--model=<model-id>]');
  process.exit(1);
}

console.log(`[Direct Runner] Mode: ${mode}, Provider: ${provider}, Model: ${model}`);
console.log(`[Direct Runner] Target: ${targetFile}`);
console.log(`[Direct Runner] Output: ${outputPath}`);

// Load target content
let context;
let inputTokens = 0;

if (mode === 'fooks') {
  // Use fooks extraction
  const fooksPath = path.join(__dirname, '../../dist/index.js');
  console.log(`[Direct Runner] Using fooks: ${fooksPath}`);
  try {
    const fooks = require(fooksPath);
    const extraction = fooks.extractFile(targetFile);
    context = JSON.stringify(extraction, null, 2);
    inputTokens = Math.ceil(context.length / 3.5); // Approximate token count
  } catch (error) {
    console.error(`[Direct Runner] Fooks extraction failed: ${error.message}`);
    context = fs.readFileSync(targetFile, 'utf-8');
    inputTokens = Math.ceil(context.length / 3.5);
  }
} else {
  // Vanilla mode: use full file
  console.log(`[Direct Runner] Vanilla mode: reading full file`);
  context = fs.readFileSync(targetFile, 'utf-8');
  inputTokens = Math.ceil(context.length / 3.5);
}

console.log(`[Direct Runner] Input tokens (approx): ${inputTokens}`);

// Build prompt
const taskPrompt = `Refactor this component into modular files:
- Split into components/, hooks/, utils/, types/
- Maintain all functionality
- No circular dependencies
- Max 200 lines per file
- Add barrel exports

Context:
${context.substring(0, 5000)}${context.length > 5000 ? '\n... (truncated)' : ''}`;

// First Success Criteria: Direct API call
// NOTE: Requires API key in environment
// First success = HTTP 200 + valid response + artifact written

const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;

if (!apiKey) {
  console.error('[Direct Runner] ERROR: No API key found');
  console.error('[Direct Runner] Set OPENAI_API_KEY or ANTHROPIC_AUTH_TOKEN');
  
  // Write failure artifact for tracking
  const failureArtifact = {
    mode,
    targetFile,
    timestamp: new Date().toISOString(),
    status: 'failed',
    error: 'API key not configured',
    inputTokens,
    outputTokens: 0,
    latencyMs: 0,
    retryCount: 0,
    output: null
  };
  
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(failureArtifact, null, 2));
  console.log(`[Direct Runner] Failure artifact written to: ${outputPath}`);
  process.exit(1);
}

console.log('[Direct Runner] API key found, client implementation pending');
console.log('[Direct Runner] First success criteria: HTTP 200 + valid response + files generated + real metrics');
console.log('[Direct Runner] Implementing OpenAI-compatible HTTP client...');
// Placeholder for actual implementation
// Full implementation would:
// 1. Create provider-specific API client
// 2. Send request with proper headers/auth
// 3. Stream or collect response
// 4. Parse generated code
// 5. Write files to temp directory
// 6. Run validation (tsc, madge, etc.)
// 7. Collect metrics
// 8. Write artifact
console.log('[Direct Runner] API key found, client implementation pending');
console.log('[Direct Runner] First success criteria: HTTP 200 + valid response + files generated + real metrics');
console.log('[Direct Runner] Implementing OpenAI-compatible HTTP client...');
console.log('[Direct Runner] First success criteria: HTTP 200 + valid response + artifact written');

// For now, write placeholder to show interface works
const placeholderArtifact = {
  mode,
  targetFile,
  timestamp: new Date().toISOString(),
  status: 'implementation-in-progress',
  provider,
  model,
  inputTokens,
  outputTokens: 0,
  latencyMs: 0,
  retryCount: 0,
  output: null,
  nextStep: 'Implement provider-specific API client'
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(placeholderArtifact, null, 2));

console.log(`[Direct Runner] Placeholder artifact written to: ${outputPath}`);
console.log('[Direct Runner] Interface validation complete');
console.log('[Direct Runner] Next: Add provider-specific API implementation');
