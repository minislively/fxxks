import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupMetricSessions } from "./metric-cleanup.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const { sessionsDir, sessionsSummaryPath } = await import(path.join(repoRoot, "dist", "core", "paths.js"));

test("metric cleanup keeps large local session stores on the bounded fast path", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-metric-cleanup-large-store-"));
  const previousLimit = process.env.FOOKS_TEST_METRIC_CLEANUP_REBUILD_LIMIT;
  try {
    fs.symlinkSync(path.join(repoRoot, "dist"), path.join(tempDir, "dist"), "dir");
    const root = sessionsDir(tempDir);
    fs.mkdirSync(path.join(root, "target-session"), { recursive: true });
    fs.mkdirSync(path.join(root, "kept-session"), { recursive: true });
    fs.writeFileSync(sessionsSummaryPath(tempDir), JSON.stringify({ sentinel: "preserve-large-store-summary" }));

    process.env.FOOKS_TEST_METRIC_CLEANUP_REBUILD_LIMIT = "0";
    await cleanupMetricSessions(tempDir, ["target-"]);

    assert.equal(fs.existsSync(path.join(root, "target-session")), false);
    assert.equal(fs.existsSync(path.join(root, "kept-session")), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(sessionsSummaryPath(tempDir), "utf8")), {
      sentinel: "preserve-large-store-summary",
    });
  } finally {
    if (previousLimit === undefined) {
      delete process.env.FOOKS_TEST_METRIC_CLEANUP_REBUILD_LIMIT;
    } else {
      process.env.FOOKS_TEST_METRIC_CLEANUP_REBUILD_LIMIT = previousLimit;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
