#!/usr/bin/env node
/**
 * Direct API Executor - gateway-independent
 * Executes CASE-1 via direct OpenAI API
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('[Direct Executor] ERROR: OPENAI_API_KEY not set');
  process.exit(1);
}

const targetFile = process.argv[2] || 'apps/v4/registry/bases/radix/examples/combobox-example.tsx';
const mode = process.argv[3] || 'vanilla';

console.log(`[Direct Executor] Mode: ${mode}, Target: ${targetFile}`);
console.log(`[Direct Executor] Starting CASE-1 execution...`);

// Read target file
const fullContent = fs.readFileSync(
  path.join('/home/bellman/Workspace/fooks-test-repos/ui', targetFile),
  'utf-8'
);

// Prepare prompt
const prompt = mode === 'vanilla'
  ? `Split this combobox component into modular files:\n\n${fullContent}\n\nRequirements:\n1. components/combobox.tsx (UI, max 200 lines)\n2. hooks/use-combobox.ts (state, max 200 lines)\n3. utils/combobox-helpers.ts (utils, max 200 lines)\n4. types/combobox.ts (types, max 200 lines)\n5. index.ts (barrel export)\n6. No circular deps, maintain functionality`
  : `Split using optimized context:\n\n[FOOKS CONTEXT PLACEHOLDER]\n\nSame requirements as vanilla`;

// API call
const data = JSON.stringify({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: prompt }],
  temperature: 0.1
});

const options = {
  hostname: 'api.openai.com',
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Length': data.length
  }
};

const startTime = Date.now();

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    const latency = Date.now() - startTime;
    console.log(`[Direct Executor] Response received in ${latency}ms`);
    console.log(`[Direct Executor] Status: ${res.statusCode}`);
    
    if (res.statusCode === 200) {
      const result = JSON.parse(body);
      const outputTokens = result.usage?.completion_tokens || 0;
      const inputTokens = result.usage?.prompt_tokens || 0;
      
      console.log(`[Direct Executor] Input tokens: ${inputTokens}`);
      console.log(`[Direct Executor] Output tokens: ${outputTokens}`);
      console.log(`[Direct Executor] Content preview: ${result.choices[0].message.content.substring(0, 200)}...`);
      
      // Save result
      const outputDir = `~/Workspace/fooks/benchmarks/layer2-frontend-task/results/case1-${mode}`;
      fs.mkdirSync(outputDir.replace('~', process.env.HOME), { recursive: true });
      fs.writeFileSync(
        path.join(outputDir.replace('~', process.env.HOME), 'api-response.json'),
        JSON.stringify({ latency, inputTokens, outputTokens, status: 'success', timestamp: new Date().toISOString() }, null, 2)
      );
      console.log(`[Direct Executor] Result saved to ${outputDir}/api-response.json`);
    } else {
      console.error(`[Direct Executor] API Error: ${body}`);
    }
  });
});

req.on('error', (e) => {
  console.error(`[Direct Executor] Request failed: ${e.message}`);
});

req.write(data);
req.end();
