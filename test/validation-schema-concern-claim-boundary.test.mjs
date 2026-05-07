// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docsRoots = ["README.md", "docs"];

const forbiddenValidationConcernClaims = [
  {
    label: "schema-correctness-proof",
    pattern: /\b(?:zod|yup|valibot|schema|resolver)\b[^\n]{0,100}\b(?:proves?|guarantees?|means|establishes?)\b[^\n]{0,100}\b(?:schema\s+is\s+correct|correct\s+schema|validation\s+is\s+correct)\b/i,
  },
  {
    label: "runtime-validation-proof",
    pattern: /\b(?:zod|yup|valibot|schema|resolver)\b[^\n]{0,100}\b(?:proves?|guarantees?|means|establishes?)\b[^\n]{0,100}\b(?:runtime\s+validation|validation\s+passes?|submit\s+flow)\b/i,
  },
  {
    label: "backend-contract-proof",
    pattern: /\b(?:zod|yup|valibot|schema|resolver)\b[^\n]{0,100}\b(?:proves?|guarantees?|means|establishes?)\b[^\n]{0,100}\b(?:backend\s+contract|api\s+contract)\b/i,
  },
  {
    label: "authorization-broadening",
    pattern: /\b(?:zod|yup|valibot|schema|resolver)\b[^\n]{0,100}\b(?:authorizes?|unlocks?|allows?|counts\s+as|proves?)\b[^\n]{0,100}\b(?:compact\s+payload|payload\s+reuse|React\s*Web)\b/i,
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

function isBounded(line) {
  return boundedClaimBoundary.test(line);
}

function findForbiddenValidationConcernClaims(text, relativePath) {
  const findings = [];
  const lines = text.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const normalized = line.replace(/\s+/g, " ").trim();
    if (!normalized) continue;

    for (const rule of forbiddenValidationConcernClaims) {
      if (rule.pattern.test(normalized) && !isBounded(normalized)) {
        findings.push(`${relativePath}:${index + 1} [${rule.label}] ${normalized}`);
      }
    }
  }

  return findings;
}

test("validation/schema concern docs stay inside the metadata-only claim boundary", () => {
  const markdownFiles = docsRoots.flatMap(collectMarkdownFiles).sort();
  const findings = markdownFiles.flatMap((file) => {
    const relativePath = path.relative(repoRoot, file);
    return findForbiddenValidationConcernClaims(fs.readFileSync(file, "utf8"), relativePath);
  });

  assert.deepEqual(findings, [], `forbidden validation/schema concern claims found:\n${findings.join("\n")}`);
});

test("validation/schema concern docs explicitly forbid correctness and authorization overreach", () => {
  const contract = fs.readFileSync(path.join(repoRoot, "docs", "frontend-domain-contract.md"), "utf8");
  const architecture = fs.readFileSync(path.join(repoRoot, "docs", "domain-payload-architecture.md"), "utf8");
  const combined = `${contract}\n${architecture}`;

  assert.match(combined, /Zod\/Yup\/Valibot imports, resolver usage, or same-file schema keys/);
  assert.match(combined, /not\*\* runtime validation proof, backend-contract proof, or compact-payload authorization by itself/i);
  assert.match(combined, /Current concern-profile extraction may surface bounded metadata such as form-state, validation\/schema, allowlisted client-state evidence, or routing evidence\./);
});

test("validation/schema concern claim audit rejects broad examples but allows bounded examples", () => {
  assert.deepEqual(
    findForbiddenValidationConcernClaims("zod proves the schema is correct and runtime validation passes.", "synthetic.md"),
    [
      "synthetic.md:1 [schema-correctness-proof] zod proves the schema is correct and runtime validation passes.",
      "synthetic.md:1 [runtime-validation-proof] zod proves the schema is correct and runtime validation passes.",
    ],
  );
  assert.deepEqual(
    findForbiddenValidationConcernClaims("resolver proves the backend contract and allows compact payload reuse.", "synthetic.md"),
    [
      "synthetic.md:1 [backend-contract-proof] resolver proves the backend contract and allows compact payload reuse.",
      "synthetic.md:1 [authorization-broadening] resolver proves the backend contract and allows compact payload reuse.",
    ],
  );
  assert.deepEqual(
    findForbiddenValidationConcernClaims(
      "same-file schema keys are metadata only; they do not prove runtime validation, backend contracts, or compact payload authorization.",
      "synthetic.md",
    ),
    [],
  );
});
