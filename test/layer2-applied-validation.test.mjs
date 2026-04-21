import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const { validate } = require(path.join(repoRoot, "benchmarks", "layer2-frontend-task", "validate-r4-applied.js"));
const fixtureRoot = path.join(repoRoot, "benchmarks", "layer2-frontend-task", "fixtures", "r4-applied-pass", "combobox");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

test("R4 applied acceptance validator passes a complete candidate tree", () => {
  const result = validate(fixtureRoot);

  assert.equal(result.status, "applied-acceptance-validated");
  assert.equal(result.summary.requiredGateCount, 5);
  assert.equal(result.summary.passedRequiredGateCount, 5);
  assert.equal(result.gates.find((gate) => gate.name.includes("file tree")).passed, true);
  assert.equal(result.gates.find((gate) => gate.name.includes("TypeScript")).status, "passed");
});

test("R4 applied acceptance validator fails local circular imports", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-r4-cycle-"));
  try {
    copyDir(fixtureRoot, tempRoot);
    fs.appendFileSync(path.join(tempRoot, "types", "combobox-types.ts"), "\nimport '../components/Combobox';\n");

    const result = validate(tempRoot, { typecheck: "skip" });
    const circularGate = result.gates.find((gate) => gate.name.includes("no cycles"));

    assert.equal(result.status, "applied-acceptance-failed");
    assert.equal(circularGate.passed, false);
    assert.ok(circularGate.cycles.some((cycle) => cycle.includes("types/combobox-types.ts")));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
