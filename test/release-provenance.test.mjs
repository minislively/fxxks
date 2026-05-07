import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertReleaseProvenanceGate,
  buildReleaseProvenance,
  renderReleaseProvenanceMarkdown,
} from "../scripts/release-provenance.mjs";

function makePackageRoot(version = "1.2.3") {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-release-provenance-"));
  fs.writeFileSync(path.join(tempRoot, "package.json"), JSON.stringify({ name: "fooks-test", version }, null, 2));
  return tempRoot;
}

function fakeGit(outputs) {
  return (_repoRoot, args) => {
    const key = args.join(" ");
    if (outputs[key] instanceof Error) throw outputs[key];
    return outputs[key] ?? "";
  };
}

test("release provenance is claimable only when the package version tag points at HEAD", () => {
  const repoRoot = makePackageRoot("1.2.3");
  try {
    const provenance = buildReleaseProvenance({
      repoRoot,
      env: { GITHUB_REPOSITORY: "minislively/fooks" },
      runGit: fakeGit({
        "rev-parse HEAD": "abc123",
        "tag --points-at HEAD": "v1.2.3\nlatest",
      }),
    });

    assert.equal(provenance.status, "release-provenance-ready");
    assert.equal(provenance.claimable, true);
    assert.deepEqual(provenance.blockers, []);
    assert.equal(provenance.package.expectedVersionTag, "v1.2.3");
    assert.equal(provenance.git.commitSha, "abc123");
    assert.equal(provenance.git.versionTagPresent, true);
    assert.equal(provenance.github.releaseUrl, "https://github.com/minislively/fooks/releases/tag/v1.2.3");
    assert.doesNotThrow(() => assertReleaseProvenanceGate(provenance));
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("release provenance fails closed when the version tag is missing from HEAD", () => {
  const repoRoot = makePackageRoot("1.2.3");
  try {
    const provenance = buildReleaseProvenance({
      repoRoot,
      env: { GITHUB_REPOSITORY: "minislively/fooks" },
      runGit: fakeGit({
        "rev-parse HEAD": "abc123",
        "tag --points-at HEAD": "v1.2.2",
      }),
    });
    const markdown = renderReleaseProvenanceMarkdown(provenance);

    assert.equal(provenance.status, "release-provenance-blocked");
    assert.equal(provenance.claimable, false);
    assert.ok(provenance.blockers.includes("v1.2.3 does not point at HEAD"));
    assert.throws(() => assertReleaseProvenanceGate(provenance), /v1\.2\.3 does not point at HEAD/);
    assert.match(markdown, /claimable: no/);
    assert.match(markdown, /v1\.2\.3 does not point at HEAD/);
    assert.doesNotMatch(markdown, /Provider billing.*yes/i);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});
