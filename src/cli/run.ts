#!/usr/bin/env node
import { scanProject } from "../core/scan.js";
import { extractFile } from "../core/extract.js";
import { decideMode } from "../core/decide.js";
import { discoverProjectFiles, discoverRelevantFiles } from "../core/discover.js";
import { executeViaCodex } from "../adapters/codex.js";

export interface RunOptions {
  prompt: string;
  mode?: "auto" | "raw" | "hybrid" | "compressed";
  runner?: "auto" | "codex" | "omx";
  verbose?: boolean;
}

export interface RunResult {
  success: boolean;
  durationMs: number;
  filesProcessed: number;
  tokensSaved: number;
  reductionPercent: number;
  modifiedFiles: string[];
  error?: string;
}

export async function runTask(options: RunOptions): Promise<RunResult> {
  const startTime = Date.now();
  
  try {
    // 1. Scan if stale
    const scanResult = scanProject();
    
    // 2. Discover relevant files
    const allFiles = discoverProjectFiles();
    const relevantFiles = discoverRelevantFiles(options.prompt, allFiles);
    
    // 3. Process each file with fallback chain
    let totalTokensSaved = 0;
    let totalRawTokens = 0;
    const processedFiles: string[] = [];
    
    for (const filePath of relevantFiles) {
      try {
        // Try compressed -> hybrid -> raw
        let result = await tryExtract(filePath, "compressed");
        if (!result.success) {
          result = await tryExtract(filePath, "hybrid");
        }
        if (!result.success) {
          result = await tryExtract(filePath, "raw");
        }
        
        if (result.success) {
          processedFiles.push(filePath);
          totalTokensSaved += result.tokensSaved;
          totalRawTokens += result.rawTokens;
        }
      } catch (err) {
        // Log but continue
        console.error(`Failed to process ${filePath}: ${err}`);
      }
    }
    
    // 4. Execute via attached runtime
    const runner = options.runner === "auto" ? detectRunner() : options.runner;
    console.log("Detected runner:", runner);
    let executionResult;
    if (runner === "codex") {
      executionResult = await executeViaCodex(options.prompt, processedFiles);
      console.log("Execution result:", executionResult);
    } else {
      executionResult = { success: true, modifiedFiles: [] };
    }
    
    // 5. Summary
    const durationMs = Date.now() - startTime;
    const reductionPercent = totalRawTokens > 0 
      ? Math.round((totalTokensSaved / totalRawTokens) * 100) 
      : 0;
    
    return {
      success: true,
      durationMs,
      filesProcessed: processedFiles.length,
      tokensSaved: totalTokensSaved,
      reductionPercent,
      modifiedFiles: [], // TODO: Get from runner execution
    };
    
  } catch (error) {
    return {
      success: false,
      durationMs: Date.now() - startTime,
      filesProcessed: 0,
      tokensSaved: 0,
      reductionPercent: 0,
      modifiedFiles: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function tryExtract(filePath: string, mode: "raw" | "hybrid" | "compressed"): Promise<{
  success: boolean;
  tokensSaved: number;
  rawTokens: number;
}> {
  try {
    const result = extractFile(filePath);
    const metrics = decideMode(result);
    
    // Use decideMode result to determine if extraction helped
    const tokensSaved = metrics.useOriginal ? 0 : result.meta.rawSizeBytes * 0.5; // Estimated 50% for compressed/hybrid
    
    return {
      success: true,
      tokensSaved,
      rawTokens: result.meta.rawSizeBytes,
    };
  } catch (error) {
    return { success: false, tokensSaved: 0, rawTokens: 0 };
  }
}

function detectRunner(): "codex" | "omx" {
  // TODO: Detect based on availability
  return "codex";
}

// CLI entry - run if executed directly
const isDirectExecution = process.argv[1]?.includes("run");
if (isDirectExecution) {
  const prompt = process.argv[2];
  if (!prompt) {
    console.error("Usage: fooks run <prompt>");
    process.exit(1);
  }
  
  runTask({ prompt }).then(result => {
    if (result.success) {
      console.log(`✓ Done: ${(result.durationMs / 1000).toFixed(1)}s, ${result.reductionPercent}% smaller, ${result.filesProcessed} files`);
    } else {
      console.error(`✗ Failed: ${result.error}`);
      process.exit(1);
    }
  });
}
