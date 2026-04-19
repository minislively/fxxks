import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { CacheResilience } from "../dist/core/cache-resilience.js";
import { CacheMonitor } from "../dist/core/cache-monitor.js";

function makeTempCacheDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fooks-cache-test-"));
}

test("CacheResilience: read empty cache returns null", () => {
  const cacheDir = makeTempCacheDir();
  const resilience = new CacheResilience(cacheDir);
  
  const result = resilience.readIndexSafe();
  
  assert.strictEqual(result, null, "Should return null for non-existent cache");
  
  fs.rmSync(cacheDir, { recursive: true });
});

test("CacheResilience: write and read valid cache", () => {
  const cacheDir = makeTempCacheDir();
  const resilience = new CacheResilience(cacheDir);
  
  const validIndex = {
    version: "1.0.0",
    entries: {
      "file1.ts": { hash: "abc123", timestamp: Date.now(), path: "/test/file1.ts" }
    }
  };
  
  resilience.writeIndexSafe(validIndex);
  const result = resilience.readIndexSafe();
  
  assert.notStrictEqual(result, null, "Should read valid cache");
  assert.strictEqual(result.version, "1.0.0");
  assert.strictEqual(Object.keys(result.entries).length, 1);
  
  fs.rmSync(cacheDir, { recursive: true });
});

test("CacheResilience: corrupted cache returns null and regenerates", () => {
  const cacheDir = makeTempCacheDir();
  
  // Create corrupted cache
  fs.writeFileSync(path.join(cacheDir, "index.json"), "{ invalid json");
  
  const resilience = new CacheResilience(cacheDir);
  const result = resilience.readIndexSafe();
  
  // Should return null (graceful fallback)
  assert.strictEqual(result, null, "Should return null for corrupted cache");
  
  fs.rmSync(cacheDir, { recursive: true });
});

test("CacheResilience: atomic write prevents partial writes", () => {
  const cacheDir = makeTempCacheDir();
  const resilience = new CacheResilience(cacheDir);
  
  const validIndex = {
    version: "1.0.0",
    entries: { "test.ts": { hash: "xyz", timestamp: 12345, path: "/test.ts" } }
  };
  
  resilience.writeIndexSafe(validIndex);
  
  // Verify no temp file left behind
  const tempExists = fs.existsSync(path.join(cacheDir, "index.json.tmp"));
  assert.strictEqual(tempExists, false, "Should not leave temp file after atomic write");
  
  // Verify actual file exists
  const indexExists = fs.existsSync(path.join(cacheDir, "index.json"));
  assert.strictEqual(indexExists, true, "Should have written index.json");
  
  fs.rmSync(cacheDir, { recursive: true });
});

test("CacheMonitor: missing index reports empty instead of corrupted", () => {
  const cacheDir = makeTempCacheDir();
  const monitor = new CacheMonitor(cacheDir);

  const report = monitor.healthReport();
  const stats = monitor.efficiencyStats();

  assert.equal(report.status, "empty");
  assert.equal(report.indexExists, false);
  assert.equal(report.indexValid, false);
  assert.equal(report.entryCount, 0);
  assert.equal(stats.hitRate, null);
  assert.equal(stats.recommendation, "Initialize cache with first scan");

  fs.rmSync(cacheDir, { recursive: true });
});

test("CacheMonitor: valid entries index reports healthy entry count", () => {
  const cacheDir = makeTempCacheDir();
  const resilience = new CacheResilience(cacheDir);
  resilience.writeIndexSafe({
    version: "1.0.0",
    entries: {
      "file1.ts": { hash: "abc123", timestamp: Date.now(), path: "/test/file1.ts" },
      "file2.ts": { hash: "def456", timestamp: Date.now(), path: "/test/file2.ts" },
    },
  });

  const monitor = new CacheMonitor(cacheDir);
  const report = monitor.healthReport();

  assert.equal(report.status, "healthy");
  assert.equal(report.indexExists, true);
  assert.equal(report.indexValid, true);
  assert.equal(report.entryCount, 2);

  fs.rmSync(cacheDir, { recursive: true });
});

test("CacheMonitor: valid scan files index reports healthy entry count", () => {
  const cacheDir = makeTempCacheDir();
  fs.writeFileSync(
    path.join(cacheDir, "index.json"),
    JSON.stringify({
      projectRoot: "/tmp/project",
      scannedAt: new Date().toISOString(),
      files: [
        { filePath: "file1.ts", fileHash: "abc123", kind: "component" },
        { filePath: "file2.ts", fileHash: "def456", kind: "component" },
      ],
      reusedCacheEntries: 0,
      refreshedEntries: 2,
    }),
  );

  const monitor = new CacheMonitor(cacheDir);
  const report = monitor.healthReport();

  assert.equal(report.status, "healthy");
  assert.equal(report.indexExists, true);
  assert.equal(report.indexValid, true);
  assert.equal(report.entryCount, 2);

  fs.rmSync(cacheDir, { recursive: true });
});

test("CacheMonitor: invalid index reports corrupted when no recovery event exists", () => {
  const cacheDir = makeTempCacheDir();
  fs.writeFileSync(path.join(cacheDir, "index.json"), "{ invalid json");

  const monitor = new CacheMonitor(cacheDir);
  const report = monitor.healthReport();

  assert.equal(report.status, "corrupted");
  assert.equal(report.indexExists, true);
  assert.equal(report.indexValid, false);

  fs.rmSync(cacheDir, { recursive: true });
});

test("CacheMonitor: prior corruption without valid backup stays corrupted", () => {
  const cacheDir = makeTempCacheDir();
  fs.writeFileSync(path.join(cacheDir, "index.json"), "{ invalid json");
  fs.writeFileSync(
    path.join(cacheDir, ".metrics.json"),
    JSON.stringify({ corruptionEvents: 2, lastCorruption: new Date().toISOString() }, null, 2),
  );

  const monitor = new CacheMonitor(cacheDir);
  const report = monitor.healthReport();
  const stats = monitor.efficiencyStats();

  assert.equal(report.status, "corrupted");
  assert.equal(report.backupAvailable, false);
  assert.equal(stats.recommendation, "Cache index is corrupted; rerun scan to regenerate");

  fs.rmSync(cacheDir, { recursive: true });
});

test("CacheMonitor: valid index after corruption reports recovered", () => {
  const cacheDir = makeTempCacheDir();
  const resilience = new CacheResilience(cacheDir);
  resilience.writeIndexSafe({
    version: "1.0.0",
    entries: {
      "file1.ts": { hash: "abc123", timestamp: Date.now(), path: "/test/file1.ts" },
    },
  });
  fs.writeFileSync(
    path.join(cacheDir, ".metrics.json"),
    JSON.stringify({ corruptionEvents: 1, lastCorruption: new Date().toISOString() }, null, 2),
  );

  const monitor = new CacheMonitor(cacheDir);
  const report = monitor.healthReport();
  const stats = monitor.efficiencyStats();

  assert.equal(report.status, "recovered");
  assert.equal(report.indexValid, true);
  assert.equal(stats.recommendation, "Cache operating normally after recovery");

  fs.rmSync(cacheDir, { recursive: true });
});

test("CacheResilience: second write creates a usable backup artifact", () => {
  const cacheDir = makeTempCacheDir();
  const resilience = new CacheResilience(cacheDir);

  resilience.writeIndexSafe({
    version: "1.0.0",
    entries: { "first.ts": { hash: "one", timestamp: 1, path: "/first.ts" } },
  });
  resilience.writeIndexSafe({
    version: "1.0.0",
    entries: { "second.ts": { hash: "two", timestamp: 2, path: "/second.ts" } },
  });

  const backupPath = path.join(cacheDir, ".backups", "index.json.bak");
  assert.equal(fs.existsSync(backupPath), true);
  const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  assert.deepEqual(Object.keys(backup.entries), ["first.ts"]);

  fs.rmSync(cacheDir, { recursive: true });
});

test("CacheMonitor: valid backup alone does not imply recovered", () => {
  const cacheDir = makeTempCacheDir();
  const resilience = new CacheResilience(cacheDir);
  resilience.writeIndexSafe({
    version: "1.0.0",
    entries: { "first.ts": { hash: "one", timestamp: 1, path: "/first.ts" } },
  });
  resilience.writeIndexSafe({
    version: "1.0.0",
    entries: { "second.ts": { hash: "two", timestamp: 2, path: "/second.ts" } },
  });

  const monitor = new CacheMonitor(cacheDir);
  const report = monitor.healthReport();

  assert.equal(report.backupAvailable, true);
  assert.equal(report.indexValid, true);
  assert.equal(report.status, "healthy");

  fs.rmSync(cacheDir, { recursive: true });
});
