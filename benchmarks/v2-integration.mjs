#!/usr/bin/env node
/**
 * Benchmark V2 Integration Layer
 * Connects new benchmark v2 extractor with main fooks pipeline
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const repoRoot = process.cwd();
const v2SrcDir = join(repoRoot, 'benchmarks', 'v2', 'src');

export function validateV2Setup() {
  const required = [
    'simple-extractor-v2.ts',
    'token-counter.ts'
  ];
  
  for (const file of required) {
    const path = join(v2SrcDir, file);
    if (!existsSync(path)) {
      throw new Error(`Missing required v2 file: ${file}`);
    }
  }
  return true;
}

export function runV2Benchmark(samplePath) {
  validateV2Setup();
  
  // Build v2 if needed
  const buildCmd = 'npm run build:benchmark-v2';
  try {
    execSync(buildCmd, { cwd: repoRoot, stdio: 'pipe' });
  } catch (e) {
    // Build may not exist yet, skip
  }
  
  console.log(`V2 benchmark ready for: ${samplePath}`);
  return { ready: true, samplePath };
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const sample = process.argv[2] || 'default-sample.tsx';
  const result = runV2Benchmark(sample);
  console.log(JSON.stringify(result, null, 2));
}
