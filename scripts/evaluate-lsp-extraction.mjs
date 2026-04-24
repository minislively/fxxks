#!/usr/bin/env node
/**
 * LSP-backed frontend context extraction evaluation
 * Issue #110 — Evaluate LSP-backed frontend context extraction
 *
 * Internal evaluation helper: summarizes whether a Language Server Protocol
 * (LSP) client could improve fooks extract quality beyond the current
 * AST-based static analysis. It is not wired into runtime extraction, package
 * scripts, fooks extract, or fooks compare.
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
console.log("Recommendation / issue #110 decision:");
console.log("Keep AST-based extract and compare as the default lightweight product path.");
console.log("Treat LSP as optional evaluation/proof work only; do not add a runtime dependency or background server by default.");
console.log("See docs/lsp-extraction-boundary.md for the public decision boundary.");
