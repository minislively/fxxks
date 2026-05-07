// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const { detectDomainFromSource } = require(path.join(repoRoot, "dist", "core", "domain-detector.js"));
const { extractFile } = require(path.join(repoRoot, "dist", "core", "extract.js"));
const { toModelFacingPayload } = require(path.join(repoRoot, "dist", "core", "payload", "model-facing.js"));
const { assessFrontendPayloadPolicy, toFrontendPayloadBuildOptions } = require(path.join(repoRoot, "dist", "core", "payload-policy", "registry.js"));
const { assessFrontendProfilePayloadReuse } = require(path.join(repoRoot, "dist", "core", "payload-policy", "profile-gate.js"));
const { UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON } = require(path.join(repoRoot, "dist", "core", "payload-policy", "fallback.js"));

function buildPayloadForSource(source, fileName, options = {}) {
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-styling-concern-"));
  try {
    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, source);
    const domainDetection = detectDomainFromSource(source, filePath);
    const policy = assessFrontendPayloadPolicy(domainDetection);
    const payload = toModelFacingPayload(extractFile(filePath), tempDir, {
      includeEditGuidance: false,
      includeReactWebContextMetadata: true,
      ...toFrontendPayloadBuildOptions(policy),
      ...options,
    });
    return { domainDetection, policy, payload };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function profileById(payload, id) {
  return payload.concernProfiles?.find((profile) => profile.id === id);
}

test("concern-only clsx source emits non-authorizing styling concern evidence", () => {
  const source = `
    import clsx from "clsx";
    const isActive = true;
    export const buttonClass = clsx("rounded-md", "px-3", isActive && "bg-blue-600");
    export const stylingNote = [
      "This source stays non-tiny so the styling concern can be emitted without relying on the tiny raw original-source lane.",
      "The extra descriptive text is fixture ballast only and must not affect concern authorization.",
      "The concern remains metadata only and does not imply React Web domain authorization by itself.",
    ].join(" ");
  `;
  const { domainDetection, policy, payload } = buildPayloadForSource(source, "ConcernOnlyStylingNote.tsx");

  assert.equal(domainDetection.classification, "unknown");
  assert.equal(policy.allowed, false);
  assert.equal(payload.reactWebContext, undefined);
  assert.deepEqual(profileById(payload, "styling"), {
    kind: "concern",
    id: "styling",
    claim: "This source contains styling concern evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    signals: ["clsx"],
  });
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), {
    allowed: false,
    reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  });
});

test("concern-only cva source emits non-authorizing styling concern evidence", () => {
  const source = `
    import { cva } from "class-variance-authority";
    export const button = cva("inline-flex rounded-md px-3", {
      variants: { tone: { primary: "bg-blue-600 text-white" } },
    });
    export const stylingNote = "This source stays non-tiny so the styling concern can be emitted without relying on the tiny raw original-source lane.";
  `;
  const { domainDetection, policy, payload } = buildPayloadForSource(source, "ConcernOnlyCvaNote.ts");

  assert.equal(domainDetection.classification, "unknown");
  assert.equal(policy.allowed, false);
  assert.deepEqual(profileById(payload, "styling"), {
    kind: "concern",
    id: "styling",
    claim: "This source contains styling concern evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    signals: ["cva"],
  });
});

test("Tailwind-like utility evidence emits styling concern without moving concern metadata into domain payload", () => {
  const source = `
    export function UtilityPanel() {
      return (
        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 text-sm">
          <p>Utility-only styling evidence must remain metadata only.</p>
          <p>This extra content keeps the fixture out of the tiny raw original-source lane.</p>
          <p>The concern must not prove visual correctness or authorize compact payload reuse.</p>
          <p>Another neutral sentence keeps the file large enough for compact extraction.</p>
          <p>One more neutral sentence avoids relying on the raw original-source fallback path.</p>
        </section>
      );
    }
    export const utilityPanelNote = [
      "Tailwind-like utility evidence is allowed as styling concern metadata.",
      "It still does not prove visual correctness, design-system compliance, or runtime behavior.",
      "This ballast text exists only to keep the fixture out of the tiny raw original-source lane.",
    ].join(" ");
  `;
  const { domainDetection, policy, payload } = buildPayloadForSource(source, "UtilityPanel.tsx");

  assert.equal(domainDetection.classification, "react-web");
  assert.equal(policy.allowed, true);
  assert.deepEqual(profileById(payload, "styling"), {
    kind: "concern",
    id: "styling",
    claim: "This source contains styling concern evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    signals: ["tailwind-utility"],
  });
  assert.ok(payload.domainPayload);
  assert.equal("concernProfiles" in payload.domainPayload, false);
});

test("React Web plus styling concern keeps concern metadata separate from authorization", () => {
  const source = `
    import clsx from "clsx";
    export function StyledForm({ active }) {
      return <form><button className={clsx("rounded px-3", active ? "bg-blue-600" : "bg-slate-200")}>Save</button></form>;
    }
    export const stylingNote = "This source stays non-tiny so the styling concern can be emitted without relying on the tiny raw original-source lane.";
  `;
  const { domainDetection, policy, payload } = buildPayloadForSource(source, "StyledForm.tsx");
  const withoutDomainPayload = { ...payload };
  delete withoutDomainPayload.domainPayload;

  assert.equal(domainDetection.classification, "react-web");
  assert.equal(policy.allowed, true);
  assert.deepEqual(profileById(payload, "styling"), {
    kind: "concern",
    id: "styling",
    claim: "This source contains styling concern evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    signals: ["clsx"],
  });
  assert.ok(payload.domainPayload);
  assert.equal("concernProfiles" in payload.domainPayload, false);
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), { allowed: true });
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, withoutDomainPayload, policy).allowed, false);
});

test("styling concern stays fail-closed for generic className and inline-style weak signals", () => {
  const cases = [
    [
      "generic-classname",
      `export function GenericClassOnly() { return <div className="card shell primary">Content</div>; }`,
    ],
    [
      "generic-classname-expression",
      `export function GenericBranchOnly({ active }) { return <div className={active ? "card primary" : "card secondary"}>Content</div>; }`,
    ],
    [
      "generic-classname-plus-inline-style",
      `export function GenericStyleCombo({ active }) { return <div className={active ? "card primary" : "card secondary"} style={{ opacity: active ? 1 : 0.5 }}>Content</div>; }`,
    ],
    [
      "inline-style-only",
      `export function InlineStyleOnly() { return <div style={{ color: "red", padding: 12 }}>Content</div>; }`,
    ],
  ];

  for (const [label, source] of cases) {
    const { payload } = buildPayloadForSource(source, `${label}.tsx`);
    assert.equal(profileById(payload, "styling"), undefined, `${label} should stay fail-closed`);
  }
});

test("styling concern stays fail-closed for comments, strings, and adjacent style systems", () => {
  const cases = [
    [
      "comments-and-strings",
      `
        const note = "clsx cva grid gap-4 rounded bg-blue-600";
        // clsx("rounded") cva("px-2") className="grid gap-2"
        export const value = note;
      `,
    ],
    [
      "css-modules",
      `
        import styles from "./Button.module.css";
        export function CssModuleButton() { return <button className={styles.primary}>Save</button>; }
      `,
    ],
    [
      "styled-components",
      "import styled from \"styled-components\"; const Button = styled.button`color: red;`; export function StyledButton() { return <Button>Save</Button>; }",
    ],
    [
      "design-token-style",
      `
        import { tokens } from "./design-tokens";
        export function TokenButton() { return <button style={{ color: tokens.primary }}>Save</button>; }
      `,
    ],
    [
      "cross-file-style-graphing",
      `
        import { buttonClass } from "./styles";
        export function ImportedClassButton() { return <button className={buttonClass}>Save</button>; }
      `,
    ],
    [
      "local-clsx-helper",
      `
        function clsx(...items) { return items.filter(Boolean).join(" "); }
        export const classes = clsx("card", "primary");
      `,
    ],
    [
      "bare-local-cva-helper",
      `
        const cva = (...items) => items.join(" ");
        export const button = cva("inline-flex", "rounded-md", "px-3");
      `,
    ],
  ];

  for (const [label, source] of cases) {
    const { payload } = buildPayloadForSource(source, `${label}.tsx`);
    assert.equal(profileById(payload, "styling"), undefined, `${label} should stay fail-closed`);
  }
});
