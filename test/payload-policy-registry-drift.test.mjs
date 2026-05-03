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

function listSourceFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(absolutePath);
    if (!entry.isFile() || !absolutePath.endsWith(".ts")) return [];
    return [absolutePath];
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function laneOwnedAssessorNames() {
  return FRONTEND_PAYLOAD_POLICY_REGISTRY.map((entry) => entry.assess.name).filter(Boolean).sort();
}

function importsLaneOwnedAssessor(sourceText, assessorNames) {
  const assessorPattern = assessorNames.map(escapeRegExp).join("|");
  const laneAssessorImport = new RegExp(
    `import\\s*\\{[^}]*\\b(?:${assessorPattern})\\b[^}]*\\}\\s*from\\s*["'][^"']*\\/payload-policy\\/[^"']+["']`,
  );

  return laneAssessorImport.test(sourceText);
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
  const assessorNames = laneOwnedAssessorNames();
  assert.ok(assessorNames.length > 0, "payload-policy registry must expose lane-owned assessor functions");

  const bypasses = listSourceFiles(path.join(repoRoot, "src"))
    .map((absolutePath) => path.relative(repoRoot, absolutePath))
    .filter((relativePath) => !relativePath.startsWith(path.join("src", "core", "payload-policy") + path.sep))
    .filter((relativePath) => importsLaneOwnedAssessor(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"), assessorNames));

  assert.deepEqual(
    bypasses,
    [],
    "runtime source outside src/core/payload-policy must delegate through core/payload-policy/registry instead of importing lane-owned assessors",
  );
});
