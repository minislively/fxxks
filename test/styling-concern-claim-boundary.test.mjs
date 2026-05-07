// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docsRoots = ["README.md", "docs"];

const forbiddenStylingConcernClaims = [
  {
    label: "visual-correctness-proof",
    pattern: /\b(?:clsx|cva|tailwind|styling\s+concern|style\s+evidence)\b[^\n]{0,100}\b(?:proves?|guarantees?|means|establishes?)\b[^\n]{0,100}\b(?:visual\s+correctness|ui\s+looks\s+correct|visual\s+result)\b/i,
  },
  {
    label: "design-system-compliance-proof",
    pattern: /\b(?:clsx|cva|tailwind|styling\s+concern|style\s+evidence)\b[^\n]{0,100}\b(?:proves?|guarantees?|means|establishes?)\b[^\n]{0,100}\b(?:design\s+system|design-system|compliance|correctness)\b/i,
  },
  {
    label: "a11y-style-quality-proof",
    pattern: /\b(?:clsx|cva|tailwind|styling\s+concern|style\s+evidence)\b[^\n]{0,100}\b(?:proves?|guarantees?|means|establishes?)\b[^\n]{0,100}\b(?:a11y|accessibility|style\s+quality)\b/i,
  },
  {
    label: "authorization-broadening",
    pattern: /\b(?:clsx|cva|tailwind|styling\s+concern|style\s+evidence)\b[^\n]{0,100}\b(?:authorizes?|unlocks?|allows?|counts\s+as|proves?)\b[^\n]{0,100}\b(?:compact\s+payload|payload\s+reuse|React\s*Web)\b/i,
  },
  {
    label: "cross-file-style-understanding",
    pattern: /\b(?:imported\s+styles?|cross-file\s+styles?|style\s+references?)\b[^\n]{0,100}\b(?:proves?|guarantees?|means|establishes?)\b[^\n]{0,100}\b(?:style\s+is\s+understood|styling\s+is\s+understood|style\s+resolution)\b/i,
  },
];

const boundedClaimBoundary = /\b(?:same-file|claim boundary|does not|do not|not|no|without|cannot|must not|only|metadata|non-authorizing|fail-closed|out-of-scope)\b/i;

function collectMarkdownFiles(entry) {
  const absolute = path.join(repoRoot, entry);
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];

  const files = [];
  for (const name of fs.readdirSync(absolute)) {
    const child = path.join(absolute, name);
    const childStat = fs.statSync(child);
    if (childStat.isDirectory()) {
      files.push(...collectMarkdownFiles(path.relative(repoRoot, child)));
    } else if (name.endsWith(".md")) {
      files.push(child);
    }
  }
  return files;
}

function findForbiddenStylingConcernClaims(text, relativePath) {
  const findings = [];
  const lines = text.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const normalized = line.replace(/\s+/g, " ").trim();
    if (!normalized) continue;

    for (const rule of forbiddenStylingConcernClaims) {
      if (rule.pattern.test(normalized) && !boundedClaimBoundary.test(normalized)) {
        findings.push(`${relativePath}:${index + 1} [${rule.label}] ${normalized}`);
      }
    }
  }

  return findings;
}

test("styling concern docs stay inside the metadata-only claim boundary", () => {
  const markdownFiles = docsRoots.flatMap(collectMarkdownFiles).sort();
  const findings = markdownFiles.flatMap((file) => {
    const relativePath = path.relative(repoRoot, file);
    return findForbiddenStylingConcernClaims(fs.readFileSync(file, "utf8"), relativePath);
  });

  assert.deepEqual(findings, [], `forbidden styling concern claims found:\n${findings.join("\n")}`);
});

test("styling concern docs explicitly forbid visual/design/authorization overreach", () => {
  const contract = fs.readFileSync(path.join(repoRoot, "docs", "frontend-domain-contract.md"), "utf8");
  const architecture = fs.readFileSync(path.join(repoRoot, "docs", "domain-payload-architecture.md"), "utf8");
  const combined = `${contract}\n${architecture}`;

  assert.match(combined, /Concern evidence such as `clsx`, `cva`, or same-file Tailwind-like utility evidence`?/i);
  assert.match(combined, /not\*\* visual correctness, design-system compliance, accessibility\/style-quality proof, imported-style-resolution proof, cross-file styling proof, or compact-payload authorization by itself/i);
  assert.match(combined, /Current concern-profile extraction may surface bounded metadata such as form-state, validation\/schema, allowlisted client-state, routing, or styling evidence\./);
  assert.match(combined, /generic `className` alone, generic `className` \+ inline `style`, inline `style` alone, CSS modules, styled-components, design-token style evidence, and imported style references remain fail-closed or future\/deferred/i);
});

test("styling concern claim audit rejects broad examples but allows bounded examples", () => {
  assert.deepEqual(
    findForbiddenStylingConcernClaims("clsx proves the UI looks correct and the visual result is verified.", "synthetic.md"),
    [
      "synthetic.md:1 [visual-correctness-proof] clsx proves the UI looks correct and the visual result is verified.",
    ],
  );
  assert.deepEqual(
    findForbiddenStylingConcernClaims("tailwind utility evidence authorizes compact payload reuse and proves design-system compliance.", "synthetic.md"),
    [
      "synthetic.md:1 [design-system-compliance-proof] tailwind utility evidence authorizes compact payload reuse and proves design-system compliance.",
      "synthetic.md:1 [authorization-broadening] tailwind utility evidence authorizes compact payload reuse and proves design-system compliance.",
    ],
  );
  assert.deepEqual(
    findForbiddenStylingConcernClaims("imported styles prove the styling is understood across files.", "synthetic.md"),
    ["synthetic.md:1 [cross-file-style-understanding] imported styles prove the styling is understood across files."],
  );
  assert.deepEqual(
    findForbiddenStylingConcernClaims(
      "same-file Tailwind-like utility evidence is metadata only; it does not prove visual correctness, design-system compliance, or compact payload authorization.",
      "synthetic.md",
    ),
    [],
  );
});
