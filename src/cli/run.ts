#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { scanProject } from "../core/scan.js";
import { extractFile } from "../core/extract.js";
import { decideMode } from "../core/decide.js";
import { discoverProjectFiles } from "../core/discover.js";
import { discoverRelevantFilesByPolicy } from "../core/context-policy.js";
import { prepareExecutionContext } from "../adapters/codex.js";

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

function shellQuote(value: string): string {
  return JSON.stringify(value);
}

export async function runTask(options: RunOptions): Promise<RunResult> {
  const startTime = Date.now();
  
  try {
    // 1. Scan if stale
    const cwd = process.cwd();
    scanProject(cwd);
    
    // 2. Discover relevant files
    const allFiles = discoverProjectFiles(cwd);
    const selection = discoverRelevantFilesByPolicy(options.prompt, allFiles, cwd);
    const relevantFiles = selection.files;
    
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
    
    // 4. Prepare execution context (handoff pattern)
    const runner = (options.runner === "auto" || !options.runner) ? detectRunner() : options.runner;

    let executionContext;
    if (runner === "codex" || runner === "omx") {
      executionContext = await prepareExecutionContext(options.prompt, processedFiles, cwd, selection.policy);
      const quotedContextPath = shellQuote(executionContext.contextPath);
      console.log("\n=== Shared Handoff Context ===");
      console.log(`Context ready: ${executionContext.contextPath}`);
      console.log(`Files: ${executionContext.fileCount}, Size: ${(executionContext.totalSize / 1024).toFixed(1)}KB`);
      console.log(`Context mode: ${executionContext.contextMode} (${executionContext.contextModeReason})`);
      console.log(`Prompt: "${executionContext.prompt}"`);
      console.log("\nManual next steps:");
      console.log(`Inspect the shared context: cat ${quotedContextPath}`);
      console.log(`Codex: start \`codex\` in this repo, then paste your prompt and the context from ${quotedContextPath}`);
      console.log(`Claude: start \`claude\` in this repo, then paste your prompt and the context from ${quotedContextPath}`);
      console.log("\nNext: Open this context with your preferred runtime (codex, claude, omx, etc.)");
      console.log(`Context file: ${executionContext.contextPath}`);
      console.log("======================\n");
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
      modifiedFiles: [],
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

function codexHome(): string {
  return process.env.FOOKS_CODEX_HOME || path.join(os.homedir(), ".codex");
}

function hasCodexAuth(): boolean {
  return fs.existsSync(path.join(codexHome(), "auth.json"));
}

function commandExists(command: string): boolean {
  const result = spawnSync(command, ["--version"], { stdio: "ignore" });
  return !result.error;
}

export function detectRunner(): "codex" | "omx" {
  if (hasCodexAuth()) {
    return "codex";
  }

  if (commandExists("omx")) {
    return "omx";
  }

  return "codex";
}

// CLI entry - run if executed directly
const isDirectExecution = process.argv[1]?.endsWith("run.js");
if (isDirectExecution) {
  const prompt = process.argv[2];
  if (!prompt) {
    console.error("Usage: fooks run <prompt>");
    process.exit(1);
  }
  
  runTask({ prompt }).then(result => {
    if (result.success) {
      console.log(`✓ Done: ${(result.durationMs / 1000).toFixed(1)}s, processed ${result.filesProcessed} files, estimated extraction opportunity ${result.reductionPercent}%`);
    } else {
      console.error(`✗ Failed: ${result.error}`);
      process.exit(1);
    }
  });
}
