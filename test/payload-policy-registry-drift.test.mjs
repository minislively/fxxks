// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const { FRONTEND_DOMAIN_PROFILE_REGISTRY } = require(path.join(repoRoot, "dist", "core", "domain-profiles", "registry.js"));
const { FRONTEND_PAYLOAD_POLICY_REGISTRY } = require(path.join(repoRoot, "dist", "core", "payload-policy", "registry.js"));

const FALLBACK_POLICY_LANE_COVERAGE = {
  fallback: ["mixed", "unknown"],
};

const LANE_OWNED_PAYLOAD_POLICY_MODULES = new Set([
  path.join("src", "core", "payload-policy", "react-web.ts"),
  path.join("src", "core", "payload-policy", "react-native.ts"),
  path.join("src", "core", "payload-policy", "webview.ts"),
  path.join("src", "core", "payload-policy", "tui-ink.ts"),
  path.join("src", "core", "payload-policy", "fallback.ts"),
  path.join("src", "core", "payload-policy", "registry.ts"),
]);

const LANE_SPECIFIC_ASSESSOR_IMPORT = /import\s*\{[^}]*\bassess(?:ReactWeb|ReactNative|WebView|TuiInk|Fallback)PayloadPolicy\b[^}]*\}\s*from\s*["'][^"']*\/payload-policy\/(?:react-web|react-native|webview|tui-ink|fallback)["']/;

function listSourceFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(absolutePath);
    if (!entry.isFile() || !absolutePath.endsWith(".ts")) return [];
    return [absolutePath];
  });
}

test("payload policy registry accounts for every registered frontend profile lane", () => {
  const profileLanes = FRONTEND_DOMAIN_PROFILE_REGISTRY.map((profile) => profile.lane).sort();
  const routedLanes = FRONTEND_PAYLOAD_POLICY_REGISTRY.flatMap((entry) => {
    if (entry.lane === "fallback") return FALLBACK_POLICY_LANE_COVERAGE.fallback;
    return [entry.lane];
  }).sort();

  assert.deepEqual(
    routedLanes,
    profileLanes,
    "new frontend domain profile lanes must be added to the payload-policy registry or explicitly routed through the fallback policy",
  );
});

test("runtime source cannot bypass the payload policy registry with lane-owned assessors", () => {
  const bypasses = listSourceFiles(path.join(repoRoot, "src"))
    .map((absolutePath) => path.relative(repoRoot, absolutePath))
    .filter((relativePath) => !LANE_OWNED_PAYLOAD_POLICY_MODULES.has(relativePath))
    .filter((relativePath) => LANE_SPECIFIC_ASSESSOR_IMPORT.test(fs.readFileSync(path.join(repoRoot, relativePath), "utf8")));

  assert.deepEqual(
    bypasses,
    [],
    "runtime source outside src/core/payload-policy must delegate through core/payload-policy/registry instead of importing lane-owned assessors",
  );
});
