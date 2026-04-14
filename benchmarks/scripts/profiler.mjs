#!/usr/bin/env node
/**
 * Fooks Scanner Performance Profiler
 * Phase 2 P0: CLI/Runtime Overhead 실체 파악
 */

import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

function now() {
  return performance.now();
}

function elapsed(start) {
  return Number((now() - start).toFixed(2));
}

function runProfiledScan(cwd) {
  const timings = {
    processSpawn: 0,
    jsonParse: 0,
    total: 0,
    scanCoreInternal: 0,
  };

  const totalStart = now();

  const spawnStart = now();
  const stdout = execFileSync(process.execPath, [cliPath, "scan"], {
    cwd,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  timings.processSpawn = elapsed(spawnStart);

  const parseStart = now();
  const result = JSON.parse(stdout);
  timings.jsonParse = elapsed(parseStart);

  timings.total = elapsed(totalStart);
  timings.scanCoreInternal = result.observability?.timingsMs?.total ?? 0;

  const overheadMs = Number((timings.total - timings.scanCoreInternal).toFixed(2));

  return {
    timings,
    overheadMs,
    result,
    stdoutLength: stdout.length,
  };
}

function measureNodeBootstrap() {
  const samples = [];
  for (let i = 0; i < 5; i++) {
    const start = now();
    execFileSync(process.execPath, ["-e", "console.log('{}')"], { encoding: "utf8" });
    samples.push(elapsed(start));
  }
  return Number((samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(2));
}

function makeMinimalProject() {
  const tempDir = fs.mkdtempSync(path.join(repoRoot, "../", "fooks-profiler-"));
  const srcDir = path.join(tempDir, "src", "components");
  fs.mkdirSync(srcDir, { recursive: true });

  fs.writeFileSync(
    path.join(srcDir, "Button.tsx"),
    `export function Button({ label }: { label: string }) {
  return <button>{label}</button>;
}
`
  );

  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ name: "profiler-test" }, null, 2)
  );

  return tempDir;
}

function runProfiling() {
  console.log("🔬 Fooks Scanner Performance Profiler - Phase 2 P0\n");

  console.log("📊 1. Node.js Bootstrap Baseline");
  const nodeBootstrap = measureNodeBootstrap();
  console.log(`   Average: ${nodeBootstrap}ms (empty script execution)`);

  const projectDir = makeMinimalProject();
  console.log(`\n📁 2. Test Project: ${projectDir}`);

  console.log("\n❄️  3. Cold Scan (no .fooks cache)");
  const cold = runProfiledScan(projectDir);

  console.log("\n🔥 4. Warm Scan (with cache)");
  const warm = runProfiledScan(projectDir);

  console.log("\n" + "=".repeat(60));
  console.log("📈 RESULTS: CLI Wall Time vs Scan Core Time");
  console.log("=".repeat(60));

  const scenarios = [
    { name: "Cold", data: cold },
    { name: "Warm", data: warm },
  ];

  for (const { name, data } of scenarios) {
    console.log(`\n[${name}]`);
    console.log(`  CLI Wall Time:        ${data.timings.total}ms`);
    console.log(`  Scan Core Internal:   ${data.scanCoreInternal}ms`);
    console.log(`  ─────────────────────────────────`);
    console.log(`  OVERHEAD:             ${data.overheadMs}ms (${((data.overheadMs / data.timings.total) * 100).toFixed(1)}%)`);
    console.log(`    - JSON Parse:       ${data.timings.jsonParse}ms`);
    console.log(`    - Unaccounted:      ${(data.overheadMs - data.timings.jsonParse).toFixed(2)}ms`);
    console.log(`    - stdout Length:    ${data.stdoutLength.toLocaleString()} chars`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("🔍 KEY FINDINGS");
  console.log("=".repeat(60));

  const warmCoreRatio = warm.scanCoreInternal / warm.timings.total;
  const coldCoreRatio = cold.scanCoreInternal / cold.timings.total;

  console.log(`\n1. Warm Scan Core Ratio: ${(warmCoreRatio * 100).toFixed(1)}%`);
  console.log(`   → ${warmCoreRatio < 0.1 ? '⚠️ CRITICAL: Core < 10%, overhead dominates' : '✓ Acceptable'}`);

  console.log(`\n2. Node Bootstrap Baseline: ${nodeBootstrap}ms`);
  console.log(`   → Warm overhead is ${(warm.overheadMs / nodeBootstrap).toFixed(1)}x bootstrap time`);

  const report = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: `${process.platform}-${process.arch}`,
    nodeBootstrapMs: nodeBootstrap,
    scenarios: {
      cold: {
        cliWallMs: cold.timings.total,
        scanCoreMs: cold.scanCoreInternal,
        overheadMs: cold.overheadMs,
        overheadPct: Number(((cold.overheadMs / cold.timings.total) * 100).toFixed(1)),
        jsonParseMs: cold.timings.jsonParse,
        stdoutLength: cold.stdoutLength,
      },
      warm: {
        cliWallMs: warm.timings.total,
        scanCoreMs: warm.scanCoreInternal,
        overheadMs: warm.overheadMs,
        overheadPct: Number(((warm.overheadMs / warm.timings.total) * 100).toFixed(1)),
        jsonParseMs: warm.timings.jsonParse,
        stdoutLength: warm.stdoutLength,
      },
    },
    findings: {
      warmCoreRatio: Number(warmCoreRatio.toFixed(4)),
      coldCoreRatio: Number(coldCoreRatio.toFixed(4)),
      overheadDominates: warmCoreRatio < 0.1,
    },
  };

  const resultsDir = path.join(repoRoot, "benchmarks", "results");
  fs.mkdirSync(resultsDir, { recursive: true });

  const jsonPath = path.join(resultsDir, `profiler-${Date.now()}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Report saved: ${jsonPath}`);

  fs.rmSync(projectDir, { recursive: true, force: true });

  return report;
}

const report = runProfiling();

// 마크다운 리포트 저장
function generateMarkdownReport(report) {
  const repoRootForPath = path.resolve(fileURLToPath(import.meta.url), "../..");
  const md = `# Fooks Scanner Performance Profile

**Generated:** ${report.timestamp}  
**Node:** ${report.nodeVersion} | **Platform:** ${report.platform}

---

## Executive Summary

| Metric | Cold Scan | Warm Scan |
|--------|-----------|-----------|
| CLI Wall Time | ${report.scenarios.cold.cliWallMs}ms | ${report.scenarios.warm.cliWallMs}ms |
| Scan Core Time | ${report.scenarios.cold.scanCoreMs}ms | ${report.scenarios.warm.scanCoreMs}ms |
| **Overhead** | **${report.scenarios.cold.overheadMs}ms** (${report.scenarios.cold.overheadPct}%) | **${report.scenarios.warm.overheadMs}ms** (${report.scenarios.warm.overheadPct}%) |
| Core Ratio | ${(report.findings.coldCoreRatio * 100).toFixed(1)}% | ${(report.findings.warmCoreRatio * 100).toFixed(1)}% |

---

## Critical Finding

${report.findings.overheadDominates
  ? `⚠️ **WARM SCAN OVERHEAD DOMINATES**: Core scan is only ${(report.findings.warmCoreRatio * 100).toFixed(1)}% of total time`
  : `✓ Core scan efficiency is acceptable`}

**Node.js Bootstrap Baseline:** ${report.nodeBootstrapMs}ms

---

## Phase 2 P0 Optimization Targets

### P0.1: JSON Serialization
- Cold stdout: ${report.scenarios.cold.stdoutLength.toLocaleString()} chars
- Warm stdout: ${report.scenarios.warm.stdoutLength.toLocaleString()} chars
- JSON Parse Time: ${Math.max(report.scenarios.cold.jsonParseMs, report.scenarios.warm.jsonParseMs)}ms

**Action:** Remove pretty-print, stream output

### P0.2: Process Bootstrap
- Current overhead: ${Math.min(report.scenarios.cold.overheadMs, report.scenarios.warm.overheadMs)}ms
- Node bootstrap: ${report.nodeBootstrapMs}ms
- Module load gap: ${(Math.min(report.scenarios.cold.overheadMs, report.scenarios.warm.overheadMs) - report.nodeBootstrapMs).toFixed(1)}ms

### P0.3: Unaccounted Time
- ${(Math.max(report.scenarios.cold.overheadMs - report.scenarios.cold.jsonParseMs, report.scenarios.warm.overheadMs - report.scenarios.warm.jsonParseMs)).toFixed(1)}ms not captured
- Likely: module resolution, fs operations, require() overhead

---

## Recommendations

1. **Immediate:** Disable pretty-print JSON output
2. **Short-term:** Add granular timing to CLI entry → scan() boundary
3. **Medium-term:** Consider worker_thread or persistent process mode

---

*Raw data: \`${jsonPath}\`*
`;

  const mdPath = path.join(resultsDir, `profile-report-${Date.now()}.md`);
  fs.writeFileSync(mdPath, md);
  console.log(`📝 Markdown report saved: ${mdPath}`);
  return mdPath;
}

const mdPath = generateMarkdownReport(report);
