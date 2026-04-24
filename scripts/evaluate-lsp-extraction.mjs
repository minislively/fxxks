#!/usr/bin/env node
/**
 * LSP-backed frontend context extraction evaluation
 * Issue #110 — Evaluate LSP-backed frontend context extraction
 *
 * This script evaluates whether integrating a Language Server Protocol
 * (LSP) client could improve fooks extract quality beyond the current
 * AST-based static analysis.
 */

import { execSync } from "node:child_process";

function checkCommand(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const hasTSServer = checkCommand("typescript-language-server");
const hasTSC = checkCommand("tsc");

console.log("LSP Frontend Context Extraction Evaluation");
console.log("==========================================");
console.log("");
console.log(`typescript-language-server available: ${hasTSServer}`);
console.log(`tsc available:                        ${hasTSC}`);
console.log("");
console.log("Current fooks extract: AST-based static analysis");
console.log("");
console.log("Potential LSP benefits:");
console.log("- Accurate cross-file symbol resolution");
console.log("- Precise type information at extraction point");
console.log("- Rename/refactoring intelligence");
console.log("- Diagnostics-aware context pruning");
console.log("");
console.log("Blockers for LSP integration:");
console.log("- Requires tsserver / typescript-language-server installation");
console.log("- Startup latency: ~500ms – 2s per project");
console.log("- tsconfig.json dependency and path mapping complexity");
console.log("- Memory overhead for large monorepos");
console.log("- Not portable to non-TS frontend (plain JS without tsconfig)");
console.log("");
console.log("Recommendation:");
console.log("Keep AST-based extract as the default lightweight path.");
console.log("LSP enhancement as optional advanced mode for TS projects only.");
console.log("");
console.log("Next step: prototype tsserver wrapper in src/adapters/lsp-extract.ts");
