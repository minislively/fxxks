// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docsRoots = ["README.md", "docs"];

const forbiddenRoutingConcernClaims = [
  {
    label: "route-existence-proof",
    pattern: /\b(?:next\/navigation|next\/link|react-router|react-router-dom|Link|useNavigate|useRouter|route params?|search params?)\b[^\n]{0,100}\b(?:proves?|guarantees?|means|establishes?)\b[^\n]{0,100}\b(?:route exists?|valid route|existing route)\b/i,
  },
  {
    label: "runtime-navigation-proof",
    pattern: /\b(?:next\/navigation|next\/link|react-router|react-router-dom|Link|useNavigate|useRouter|route params?|search params?)\b[^\n]{0,100}\b(?:proves?|guarantees?|means|establishes?)\b[^\n]{0,100}\b(?:navigation works?|runtime navigation|redirect works?|router works?)\b/i,
  },
  {
    label: "app-pages-router-verification",
    pattern: /\b(?:next\/navigation|next\/link|react-router|react-router-dom|useRouter|route params?|search params?)\b[^\n]{0,100}\b(?:proves?|guarantees?|means|establishes?)\b[^\n]{0,100}\b(?:App Router|Pages Router)\b/i,
  },
  {
    label: "authorization-broadening",
    pattern: /\b(?:next\/navigation|next\/link|react-router|react-router-dom|Link|useNavigate|useRouter|route params?|search params?)\b[^\n]{0,100}\b(?:authorizes?|unlocks?|allows?|counts\s+as|proves?)\b[^\n]{0,100}\b(?:compact\s+payload|payload\s+reuse|React\s*Web)\b/i,
  },
];

const boundedClaimBoundary = /\b(?:same-file|claim boundary|does not|do not|not|no|without|cannot|must not|only|metadata|non-authorizing|fail-closed)\b/i;

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

function findForbiddenRoutingConcernClaims(text, relativePath) {
  const findings = [];
  const lines = text.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const normalized = line.replace(/\s+/g, " ").trim();
    if (!normalized) continue;

    for (const rule of forbiddenRoutingConcernClaims) {
      if (rule.pattern.test(normalized) && !boundedClaimBoundary.test(normalized)) {
        findings.push(`${relativePath}:${index + 1} [${rule.label}] ${normalized}`);
      }
    }
  }

  return findings;
}

test("routing concern docs stay inside the metadata-only claim boundary", () => {
  const markdownFiles = docsRoots.flatMap(collectMarkdownFiles).sort();
  const findings = markdownFiles.flatMap((file) => {
    const relativePath = path.relative(repoRoot, file);
    return findForbiddenRoutingConcernClaims(fs.readFileSync(file, "utf8"), relativePath);
  });

  assert.deepEqual(findings, [], `forbidden routing concern claims found:\n${findings.join("\n")}`);
});

test("routing concern docs explicitly forbid route/runtime/authorization overreach", () => {
  const contract = fs.readFileSync(path.join(repoRoot, "docs", "frontend-domain-contract.md"), "utf8");
  const architecture = fs.readFileSync(path.join(repoRoot, "docs", "domain-payload-architecture.md"), "utf8");
  const combined = `${contract}\n${architecture}`;

  assert.match(combined, /Next\/React Router imports, `Link`, `useNavigate`, `useRouter`, or same-file route\/search param usage/);
  assert.match(combined, /not\*\* route-existence proof, runtime navigation proof, App Router\/Pages Router verification, or compact-payload authorization by itself/i);
  assert.match(combined, /Current concern-profile extraction may surface bounded metadata such as form-state, validation\/schema, allowlisted client-state, or routing evidence\./);
});

test("routing concern claim audit rejects broad examples but allows bounded examples", () => {
  assert.deepEqual(
    findForbiddenRoutingConcernClaims("useRouter proves the route exists and navigation works.", "synthetic.md"),
    [
      "synthetic.md:1 [route-existence-proof] useRouter proves the route exists and navigation works.",
      "synthetic.md:1 [runtime-navigation-proof] useRouter proves the route exists and navigation works.",
    ],
  );
  assert.deepEqual(
    findForbiddenRoutingConcernClaims("react-router authorizes compact payload reuse and proves App Router behavior.", "synthetic.md"),
    [
      "synthetic.md:1 [app-pages-router-verification] react-router authorizes compact payload reuse and proves App Router behavior.",
      "synthetic.md:1 [authorization-broadening] react-router authorizes compact payload reuse and proves App Router behavior.",
    ],
  );
  assert.deepEqual(
    findForbiddenRoutingConcernClaims(
      "same-file route/search param usage is metadata only; it does not prove route existence, runtime navigation, or compact payload authorization.",
      "synthetic.md",
    ),
    [],
  );
});
