// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);

const movedSurfaces = [
  {
    oldPath: ["dist", "core", "react-web-evidence-artifact.js"],
    newPath: ["dist", "reporting", "react-web-evidence-artifact.js"],
    symbol: "readReactWebEvidenceArtifact",
  },
  {
    oldPath: ["dist", "core", "react-web-status.js"],
    newPath: ["dist", "reporting", "react-web-status.js"],
    symbol: "readReactWebStatus",
  },
  {
    oldPath: ["dist", "core", "react-web-activation-mode.js"],
    newPath: ["dist", "reporting", "react-web-activation-mode.js"],
    symbol: "readReactWebActivationMode",
  },
  {
    oldPath: ["dist", "core", "react-web-ranked-bundle.js"],
    newPath: ["dist", "reporting", "react-web-ranked-bundle.js"],
    symbol: "readReactWebRankedBundle",
  },
  {
    oldPath: ["dist", "core", "worktree-evidence.js"],
    newPath: ["dist", "reporting", "worktree-evidence.js"],
    symbol: "currentWorktreeEvidenceStatus",
  },
  {
    oldPath: ["dist", "core", "artifact-audit.js"],
    newPath: ["dist", "ops", "artifact-audit.js"],
    symbol: "auditArtifacts",
  },
  {
    oldPath: ["dist", "core", "operator-activity.js"],
    newPath: ["dist", "ops", "operator-activity.js"],
    symbol: "readOperatorActivitySnapshot",
  },
];

test("moved reporting and ops surfaces keep core compatibility shims", () => {
  for (const surface of movedSurfaces) {
    const oldModule = require(path.join(repoRoot, ...surface.oldPath));
    const newModule = require(path.join(repoRoot, ...surface.newPath));
    assert.equal(
      oldModule[surface.symbol],
      newModule[surface.symbol],
      `${surface.symbol} should be re-exported from the old core path`,
    );
  }
});

test("root package exports continue to expose public reporting and ops APIs", () => {
  const pkg = require(path.join(repoRoot, "dist", "index.js"));
  for (const symbol of [
    "readReactWebStatus",
    "readReactWebActivationMode",
    "readReactWebRankedBundle",
    "currentWorktreeEvidenceStatus",
    "auditArtifacts",
  ]) {
    assert.equal(typeof pkg[symbol], "function", `${symbol} should remain publicly exported`);
  }
});
