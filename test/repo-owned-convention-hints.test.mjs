import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const {
  REPO_OWNED_CONVENTION_HINTS_CLAIM_BOUNDARY,
  REPO_OWNED_CONVENTION_HINTS_SCHEMA_VERSION,
  findRepoOwnedConventionHintsForIssue,
  parseRepoOwnedConventionHintsManifest,
} = require(path.join(repoRoot, "dist", "core", "repo-owned-convention-hints.js"));

const fixturePath = path.join(repoRoot, "test", "fixtures", "repo-owned-convention-hints", "react-web-conventions.json");

function fixtureManifest() {
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

test("repo-owned convention hints parse an internal fixture-backed prototype manifest", () => {
  const manifest = parseRepoOwnedConventionHintsManifest(fixtureManifest());

  assert.equal(manifest.schemaVersion, REPO_OWNED_CONVENTION_HINTS_SCHEMA_VERSION);
  assert.equal(manifest.claimBoundary, REPO_OWNED_CONVENTION_HINTS_CLAIM_BOUNDARY);
  assert.equal(manifest.hints.length, 1);
  assert.deepEqual(manifest.hints.map((hint) => [hint.id, hint.purpose, hint.source, hint.enforcement, hint.publicConfig]), [
    ["react-web.native-label-context", "convention-hint", "internal-prototype-fixture", "none", false],
  ]);

  const hint = manifest.hints[0];
  assert.equal(hint.advisoryOnly, true);
  assert.equal(hint.appliesTo.profile, "react-web");
  assert.ok(hint.appliesTo.issueKinds.includes("react-web.missing-accessible-label"));
  assert.ok(hint.inspectFirst.length >= 2);
  assert.ok(hint.excludedInference.some((entry) => /public repo config contract/.test(entry)));
  assert.ok(hint.excludedInference.some((entry) => /CI or merge policy/.test(entry)));
  assert.doesNotMatch(JSON.stringify(hint), /must-edit|auto-apply|CI gate|merge gate/i);
});

test("repo-owned convention hints match React Web issue facts without public config loading", () => {
  const hints = findRepoOwnedConventionHintsForIssue(
    {
      profile: "react-web",
      issueKind: "react-web.missing-accessible-label",
      element: "input",
      filePath: "test/fixtures/react-web-label-preview/missing-labels.tsx",
    },
    parseRepoOwnedConventionHintsManifest(fixtureManifest()),
  );

  assert.equal(hints.length, 1);
  assert.equal(hints[0].id, "react-web.native-label-context");
  assert.equal(hints[0].advisoryOnly, true);
  assert.equal(hints[0].enforcement, "none");
  assert.equal(hints[0].source, "internal-prototype-fixture");
  assert.match(hints[0].policyBoundary, /Advisory convention hint only/);
  assert.doesNotMatch(JSON.stringify(hints), /must-edit|auto-apply|CI gate|merge gate/i);

  assert.deepEqual(
    findRepoOwnedConventionHintsForIssue({
      profile: "react-web",
      issueKind: "react-web.missing-accessible-label",
      element: "input",
      filePath: "fixtures/example.ts",
    }, parseRepoOwnedConventionHintsManifest(fixtureManifest())),
    [],
  );
});

test("repo-owned convention hints reject enforcement and apply-authority wording", () => {
  const manifest = fixtureManifest();
  manifest.hints[0].summary = "This convention must-edit the file";

  assert.throws(
    () => parseRepoOwnedConventionHintsManifest(manifest),
    /enforcement or apply-authority wording/,
  );

  const enforced = fixtureManifest();
  enforced.hints[0].enforcement = "warning";
  assert.throws(
    () => parseRepoOwnedConventionHintsManifest(enforced),
    /enforcement must be none/,
  );

  const publicConfig = fixtureManifest();
  publicConfig.hints[0].publicConfig = true;
  assert.throws(
    () => parseRepoOwnedConventionHintsManifest(publicConfig),
    /publicConfig must be false/,
  );
});
