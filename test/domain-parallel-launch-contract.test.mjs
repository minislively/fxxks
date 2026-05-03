// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const contractPath = path.join(repoRoot, "docs", "domain-parallel-first-wave-launch-contract.md");

function readContract() {
  return fs.readFileSync(contractPath, "utf8");
}

test("first domain-parallel wave launch contract names disjoint lanes and shared seams", () => {
  const contract = readContract();

  assert.match(contract, /# Domain Parallel First-Wave Launch Contract/);
  assert.match(contract, /Minimum base commit: `d64154e`/);
  assert.match(contract, /Status \| `disjoint-domain-writers`/);
  assert.match(contract, /Shared-seam owner \| `none`/);
  assert.match(contract, /Contract only; no lane implementation worktree is part of this PR/);

  for (const lanePrefix of [
    "`lane/react-web-*` / `fooks-react-web-*`",
    "`lane/rn-*` / `fooks-rn-*`",
    "`lane/webview-*` / `fooks-webview-*`",
    "`lane/tui-ink-*` / `fooks-tui-ink-*`",
  ]) {
    assert.ok(contract.includes(lanePrefix), `${lanePrefix} must stay in the launch lane table`);
  }

  for (const sharedSeam of [
    "src/core/domain-detector.ts",
    "src/core/domain-profiles/registry.ts",
    "src/core/payload-policy/registry.ts",
    "src/core/payload/domain-payload.ts",
    "src/core/payload/readiness.ts",
    "src/adapters/pre-read.ts",
    "test/fooks.test.mjs",
    "test/fixtures/frontend-domain-expectations/manifest.json",
    "docs/frontend-domain-contract.md",
  ]) {
    assert.ok(contract.includes(sharedSeam), `${sharedSeam} must stay in the forbidden shared seam list`);
  }
});

test("first domain-parallel wave contract keeps launch evidence and stop rules explicit", () => {
  const contract = readContract();

  for (const requiredPhrase of [
    "Disjoint-file proof format",
    "Forbidden shared seams touched: none",
    "Leader aggregate verification needed after merge: yes",
    "build/typecheck preflight evidence",
    "ownership/scope evidence",
    "Before any lane prompt, review inbox, or implementation handoff",
    "support-claim grep remains required over `docs` and `src`",
    "A branch with any forbidden shared seam in `Files changed` stops being a disjoint-domain writer",
  ]) {
    assert.ok(contract.includes(requiredPhrase), `${requiredPhrase} must stay in the launch contract`);
  }

  for (const stopRule of [
    "a lane touches a forbidden shared seam",
    "claim-boundary wording drifts for RN, WebView, TUI/Ink, Mixed, or Unknown",
    "WebView stops being fallback-first",
    "RN expands beyond the measured F1 primitive/input narrow gate",
    "TUI/Ink wording implies terminal correctness or runtime-token savings",
    "build/typecheck preflight evidence is missing",
    "ownership/scope evidence is missing",
    "lane verification or aggregate verification fails",
  ]) {
    assert.ok(contract.includes(stopRule), `${stopRule} must stay in the stop rules`);
  }
});
