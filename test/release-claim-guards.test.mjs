// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  assertNoForbiddenPublicClaims,
  assertPublicSurfaceClaimBoundaries,
} from "../scripts/release-claim-guards.mjs";

const repoRoot = process.cwd();

function assertGuardRejects(text, expectedMessage) {
  assert.throws(
    () => assertNoForbiddenPublicClaims("synthetic benchmark/provider surface", text),
    expectedMessage,
  );
}

test("release claim guard rejects benchmark/provider positive savings claims offline", () => {
  assertGuardRejects(
    "Benchmark evidence shows provider usage/billing-token reduction for users.",
    /provider usage\/billing-token reduction/,
  );
  assertGuardRejects(
    "Provider cost savings are available from this benchmark.",
    /provider cost savings/,
  );
  assertGuardRejects(
    "The result is a ccusage replacement for provider billing review.",
    /unbounded ccusage replacement wording/,
  );
});

test("release claim guard allows explicit benchmark/provider boundaries without broadening claims", () => {
  assertNoForbiddenPublicClaims(
    "bounded benchmark/provider surface",
    [
      "Benchmark evidence is local estimated payload evidence only; it does not prove provider usage/billing-token reduction.",
      "This is not provider usage/billing tokens, invoices, dashboards, charged costs, or a ccusage replacement.",
      "claimability flags stayed false: provider cost savings remain out of scope.",
    ].join("\n"),
  );
});

test("release claim guard keeps internal .omx state out of product surfaces", () => {
  assertGuardRejects(
    "Users can inspect product state in .omx/state after the benchmark run.",
    /exposes \.omx as product state/,
  );
  assertNoForbiddenPublicClaims(
    "bounded harness surface",
    "The release harness may write internal .omx/state planning artifacts during tests.",
  );
});

test("release public surface guard reports the offending surface label", () => {
  assert.throws(
    () => assertPublicSurfaceClaimBoundaries({
      "docs/benchmark-evidence.md": "Provider cost savings are guaranteed.",
    }),
    /docs\/benchmark-evidence\.md contains forbidden positive claim/,
  );
});

test("release claim guard requires launch-contract evidence for domain-parallel launch readiness", () => {
  assertGuardRejects(
    "Domain-parallel worktree launch is ready for implementation.",
    /domain-parallel launch readiness claim without launch-contract evidence/,
  );
  assertNoForbiddenPublicClaims(
    "bounded domain-parallel launch surface",
    [
      "A domain-parallel team wave may launch when the launch contract lists the required fields and status disjoint-domain-writers.",
      "Until a launch contract names one of those statuses and lists the required fields above, domain-parallel work remains planning-only and no implementation worktree is authorized.",
    ].join("\n"),
  );
});

test("release-facing docs keep domain-parallel launch readiness tied to launch contracts", () => {
  const surfaces = {
    "docs/release.md": fs.readFileSync(path.join(repoRoot, "docs", "release.md"), "utf8"),
    "docs/release-readiness.md": fs.readFileSync(path.join(repoRoot, "docs", "release-readiness.md"), "utf8"),
  };

  assertPublicSurfaceClaimBoundaries(surfaces);
  assert.match(surfaces["docs/release.md"], /domain-parallel worktree\/team\/PR wave readiness wording must cite a launch contract/);
  assert.match(surfaces["docs/release-readiness.md"], /Domain-parallel worktree\/team\/PR wave readiness remains planning-only unless a launch contract lists the required fields/);
});
