import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { CacheResilience } from "../dist/core/cache-resilience.js";

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
