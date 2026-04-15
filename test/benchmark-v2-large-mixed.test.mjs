import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const repoRoot = process.cwd();
const samplePath = "/home/bellman/Workspace/fooks-test-repos/cal.com/packages/app-store/hitpay/components/EventTypeAppSettingsInterface.tsx";
const require = createRequire(import.meta.url);

function loadTsModule(filePath, cache = new Map()) {
  const resolved = path.resolve(filePath);
  if (cache.has(resolved)) return cache.get(resolved);

  const source = fs.readFileSync(resolved, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: resolved,
  }).outputText;

  const module = { exports: {} };
  cache.set(resolved, module.exports);

  const localRequire = (specifier) => {
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      return loadTsModule(`${path.resolve(path.dirname(resolved), specifier)}.ts`.replace(/\.ts\.ts$/, ".ts"), cache);
    }
    return require(specifier);
  };

  const runner = new Function("require", "module", "exports", "__filename", "__dirname", compiled);
  runner(localRequire, module, module.exports, resolved, path.dirname(resolved));
  cache.set(resolved, module.exports);
  return module.exports;
}

test("benchmark v2 large-mixed extractor stays materially closer to real fooks payload", async (t) => {
  if (!fs.existsSync(samplePath)) {
    t.diagnostic(`sample missing, skipped: ${samplePath}`);
    return;
  }

  const { extractFile } = require(path.join(repoRoot, "dist", "core", "extract.js"));
  const { toModelFacingPayload } = require(path.join(repoRoot, "dist", "core", "payload", "model-facing.js"));
  const { countTokens } = loadTsModule(path.join(repoRoot, "benchmarks", "v2", "src", "token-counter.ts"));
  const { extractFileSimpleV2 } = loadTsModule(path.join(repoRoot, "benchmarks", "v2", "src", "simple-extractor-v2.ts"));

  const fooksResult = extractFile(samplePath);
  const fooksPayload = JSON.stringify(toModelFacingPayload(fooksResult, path.dirname(samplePath)));
  const v2Result = extractFileSimpleV2(samplePath);

  const payloadDeltaPct = Math.abs(Buffer.byteLength(fooksPayload, "utf8") - v2Result.payloadBytes) / Buffer.byteLength(fooksPayload, "utf8");
  const tokenDeltaPct = Math.abs(countTokens(fooksPayload) - v2Result.extractedTokens) / countTokens(fooksPayload);

  assert.equal(fooksResult.mode, "hybrid");
  assert.equal(v2Result.extractionMode, "hybrid");
  assert.match(v2Result.extractedContent, /"behavior"/);
  assert.match(v2Result.extractedContent, /"snippets"/);
  assert.ok(payloadDeltaPct < 0.35, `payload delta too high: ${payloadDeltaPct}`);
  assert.ok(tokenDeltaPct < 0.35, `token delta too high: ${tokenDeltaPct}`);
});
