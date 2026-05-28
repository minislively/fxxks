// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import {
  FACT_GRAPH_REPORT_CLAIM_BOUNDARY,
  FACT_GRAPH_REPORT_NON_CLAIMS,
  FACT_GRAPH_REPORT_SCHEMA_VERSION,
  buildFactGraphMetrics,
  buildFactGraphReport,
} from "../dist/index.js";

const sourceRef = {
  filePath: "src/components/UserForm.tsx",
  loc: { startLine: 10, endLine: 18 },
  fingerprint: { fileHash: "sha256:abc123", lineCount: 120 },
  extractor: { id: "test.extractor", version: "1.0.0" },
};

const freshness = {
  status: "fresh",
  staleWhen: ["source fingerprint changes", "extractor version changes"],
  sourceFingerprints: [{ fileHash: "sha256:abc123", lineCount: 120 }],
  extractorVersions: { "test.extractor": "1.0.0" },
};

const nodes = [
  {
    id: "component:UserForm",
    domain: "react-web",
    kind: "component",
    label: "UserForm",
    confidence: "known",
    sourceRefs: [sourceRef],
    evidence: ["function UserForm"],
  },
  {
    id: "field:email",
    domain: "react-web",
    kind: "field-role",
    label: "email",
    confidence: "candidate",
    sourceRefs: [sourceRef],
    evidence: ["Controller name=\"email\""],
    properties: { name: "email", repeated: false, priority: 1, aliases: ["user.email"] },
  },
  {
    id: "field:legacy",
    domain: "react-web",
    kind: "field-role",
    label: "legacy",
    confidence: "unsupported",
    sourceRefs: [sourceRef],
    evidence: ["unclassified custom field wrapper"],
  },
];

const edges = [
  {
    id: "edge:email-validates-schema",
    domain: "react-web",
    kind: "validates",
    from: "field:email",
    to: "schema:email",
    confidence: "known",
    sourceRefs: [sourceRef],
    evidence: ["z.object({ email"],
  },
];

test("fact graph metrics count nodes, edges, and confidence classes", () => {
  const metrics = buildFactGraphMetrics(nodes, edges);

  assert.equal(metrics.nodeCount, 3);
  assert.equal(metrics.edgeCount, 1);
  assert.equal(metrics.knownCount, 2);
  assert.equal(metrics.candidateCount, 1);
  assert.equal(metrics.unsupportedCount, 1);
});

test("fact graph report preserves report-only policy and explicit non-claims", () => {
  const report = buildFactGraphReport({
    generatedAt: "2026-05-28T00:00:00.000Z",
    scope: { files: ["src/components/UserForm.tsx"], domain: "react-web" },
    freshness,
    nodes,
    edges,
  });

  assert.equal(report.schemaVersion, FACT_GRAPH_REPORT_SCHEMA_VERSION);
  assert.equal(report.producer, "fooks");
  assert.equal(report.claimBoundary, FACT_GRAPH_REPORT_CLAIM_BOUNDARY);
  assert.equal(report.policy.reportOnly, true);
  assert.equal(report.policy.runtimeAuthorized, false);
  assert.equal(report.policy.candidatesAuthorizeRuntime, false);
  assert.ok(report.nonClaims.includes("does not authorize runtime reuse"));
  assert.ok(report.nonClaims.includes("does not authorize pre-read reuse"));
  assert.ok(report.nonClaims.includes("does not authorize model-facing payload reuse"));
  assert.ok(report.nonClaims.some((claim) => /token, cost, latency/.test(claim)));
  assert.ok(report.nonClaims.some((claim) => /does not promote frontend, backend, database/.test(claim)));
  assert.deepEqual(report.nonClaims, [...FACT_GRAPH_REPORT_NON_CLAIMS]);
});

test("fact graph report does not allow caller overrides to weaken boundary text", () => {
  const report = buildFactGraphReport({
    scope: { files: ["src/components/UserForm.tsx"], domain: "react-web" },
    freshness,
    // @ts-expect-error Runtime JS may pass stale/custom fields; the builder must ignore them.
    claimBoundary: "runtime reuse is allowed",
    nonClaims: ["claims token savings"],
  });

  assert.equal(report.claimBoundary, FACT_GRAPH_REPORT_CLAIM_BOUNDARY);
  assert.deepEqual(report.nonClaims, [...FACT_GRAPH_REPORT_NON_CLAIMS]);
});

test("fact graph core represents React Web role strings without frontend enums or runtime eligibility", () => {
  const report = buildFactGraphReport({
    scope: { files: ["src/components/UserForm.tsx"], domain: "react-web" },
    freshness,
    nodes,
    edges,
  });

  assert.equal(report.nodes[1].domain, "react-web");
  assert.equal(report.nodes[1].kind, "field-role");
  assert.equal(report.edges[0].kind, "validates");
  assert.equal(Object.hasOwn(report.nodes[1], "runtimeEligibility"), false);
  assert.equal(Object.hasOwn(report.edges[0], "runtimeEligibility"), false);
});

test("fact graph source refs and freshness use relative files and extractor versions", () => {
  const report = buildFactGraphReport({
    scope: { files: ["src/components/UserForm.tsx"], domain: "react-web" },
    freshness,
    nodes,
    edges,
  });

  assert.equal(report.scope.files[0], "src/components/UserForm.tsx");
  assert.equal(report.nodes[0].sourceRefs[0].filePath, "src/components/UserForm.tsx");
  assert.deepEqual(report.nodes[0].sourceRefs[0].loc, { startLine: 10, endLine: 18 });
  assert.deepEqual(report.nodes[0].sourceRefs[0].fingerprint, { fileHash: "sha256:abc123", lineCount: 120 });
  assert.deepEqual(report.freshness.sourceFingerprints, [{ fileHash: "sha256:abc123", lineCount: 120 }]);
  assert.equal(report.freshness.extractorVersions["test.extractor"], "1.0.0");
});
