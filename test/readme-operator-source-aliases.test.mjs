// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");

function sectionBetween(markdown, startHeading, nextHeading) {
  const start = markdown.indexOf(startHeading);
  assert.notEqual(start, -1, `missing ${startHeading}`);
  const end = markdown.indexOf(nextHeading, start + startHeading.length);
  assert.notEqual(end, -1, `missing ${nextHeading}`);
  return markdown.slice(start, end);
}

const operatorSection = sectionBetween(readme, "## Everyday commands", "## opencode support");

test("README operator section points source checkout dogfood operators to npm aliases", () => {
  for (const required of [
    "Source-checkout dogfood operators",
    "`npm run -s check -- --json`",
    "`npm run -s status:activity -- --json`",
    "Those aliases build first",
    "read-only operator command",
  ]) {
    assert.ok(operatorSection.includes(required), `missing README operator alias wording: ${required}`);
  }
});

test("README operator source-checkout handoff does not prefer setup docs or direct dist paths", () => {
  assert.match(operatorSection, /source-checkout handoffs should cite the aliases instead of sending maintainers to `docs\/setup\.md` or a direct `dist\/cli\/index\.js` path/);
});
