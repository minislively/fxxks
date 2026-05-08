// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);

const discoverModule = require(path.join(repoRoot, "dist", "core", "discover.js"));
const { discoverProjectFilesWithStats } = discoverModule;

function makeTempProject() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-discover-race-"));
  fs.mkdirSync(path.join(tempDir, "src", "components"), { recursive: true });
  fs.writeFileSync(path.join(tempDir, "src", "components", "RaceWidget.jsx"), 'import "./RaceWidget.types";\nexport function RaceWidget() { return <div />; }\n');
  fs.writeFileSync(path.join(tempDir, "src", "components", "RaceWidget.types.ts"), 'export type RaceWidgetProps = { label: string };\n');
  return tempDir;
}

test("discover tolerates component files that disappear between walk and import read", () => {
  const tempDir = makeTempProject();
  const vanishingFile = path.join(tempDir, "src", "components", "RaceWidget.jsx");
  const originalReadFileSync = fs.readFileSync;

  fs.readFileSync = ((filePath, ...args) => {
    if (typeof filePath === "string" && path.resolve(filePath) === vanishingFile) {
      const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      // @ts-expect-error test shim
      error.code = "ENOENT";
      throw error;
    }
    // @ts-expect-error node overload shim
    return originalReadFileSync.call(fs, filePath, ...args);
  });

  try {
    const result = discoverProjectFilesWithStats(tempDir);
    assert.ok(result.targets.some((target) => target.filePath === vanishingFile && target.kind === "component"));
    assert.ok(!result.targets.some((target) => target.filePath.endsWith("RaceWidget.types.ts") && target.kind === "linked-ts"));
  } finally {
    fs.readFileSync = originalReadFileSync;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
