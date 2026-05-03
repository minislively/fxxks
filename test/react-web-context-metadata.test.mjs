import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const { extractFile, extractSource } = require(path.join(repoRoot, "dist", "core", "extract.js"));
const { toModelFacingPayload } = require(path.join(repoRoot, "dist", "core", "payload", "model-facing.js"));

function payloadFor(relativeFile, options = {}) {
  const result = extractFile(path.join(repoRoot, relativeFile));
  return toModelFacingPayload(result, repoRoot, options);
}

test("reactWebContext is opt-in and does not change default model-facing payloads", () => {
  const payload = payloadFor("fixtures/compressed/HookEffectPanel.tsx");

  assert.equal("reactWebContext" in payload, false);
  assert.ok(payload.sourceFingerprint);
});

test("React Web opt-in emits context without emitting domainPayload", () => {
  const payload = payloadFor("fixtures/compressed/HookEffectPanel.tsx", {
    includeEditGuidance: true,
    includeReactWebContextMetadata: true,
  });

  assert.equal("domainPayload" in payload, false);
  assert.ok(payload.reactWebContext);
  assert.equal(payload.reactWebContext.schemaVersion, "react-web-context.v0");
  assert.deepEqual(payload.reactWebContext.freshness, payload.sourceFingerprint);
  assert.equal(payload.reactWebContext.scope.kind, "same-component");
  assert.equal(payload.reactWebContext.scope.filePath, path.join("fixtures", "compressed", "HookEffectPanel.tsx"));

  assert.ok(payload.reactWebContext.stateHints.some((item) => item.kind === "effect" && item.deps.includes("loadUser")));
  assert.ok(payload.reactWebContext.stateHints.some((item) => item.kind === "callback" && item.deps.includes("name")));
  assert.ok(payload.reactWebContext.intentTargets.some((item) => item.intent === "handler" && item.source === "editGuidance"));
  assert.ok(payload.reactWebContext.intentTargets.some((item) => item.intent === "style" && item.source === "style"));

  const warnings = payload.reactWebContext.warnings.join("\n");
  assert.match(warnings, /React Web current supported lane only/);
  assert.match(warnings, /Source-derived repeated-read context hints only/);
  assert.match(warnings, /not LSP-backed/);
  assert.match(warnings, /not an accessibility audit/);
  assert.match(warnings, /not proof of runtime\/provider token savings/);
  assert.match(warnings, /Rerun extraction or read current source/);
});

test("React Web opt-in can emit context and domainPayload with stable top-level order", () => {
  const payload = payloadFor("fixtures/compressed/HookEffectPanel.tsx", {
    includeEditGuidance: true,
    includeDesignReviewMetadata: true,
    includeReactWebContextMetadata: true,
    includeDomainPayload: true,
  });

  assert.ok(payload.designReviewMetadata);
  assert.ok(payload.reactWebContext);
  assert.equal(payload.domainPayload.domain, "react-web");

  const keys = Object.keys(payload);
  assert.ok(keys.indexOf("designReviewMetadata") < keys.indexOf("reactWebContext"));
  assert.ok(keys.indexOf("reactWebContext") < keys.indexOf("domainPayload"));
  assert.ok(keys.indexOf("domainPayload") < keys.indexOf("exports"));
});

test("React Web form controls emit source-observed a11y anchors only", () => {
  const payload = payloadFor("fixtures/compressed/FormControls.tsx", {
    includeReactWebContextMetadata: true,
  });

  assert.ok(payload.reactWebContext);
  assert.ok(payload.reactWebContext.a11yAnchors.some((item) => item.kind === "required" && item.label === "input[name=email]"));
  assert.ok(payload.reactWebContext.a11yAnchors.some((item) => item.kind === "disabled" && item.label === "textarea[name=notes]"));
  assert.equal(payload.reactWebContext.warnings.some((item) => item.includes("not an accessibility audit")), true);
});

test("React Web opt-in emits source-observed role aria and readOnly anchors", () => {
  const source = `
    import React from "react";

    type A11yPanelProps = { value: string; readonly?: boolean };

    export function A11yPanel({ value, readonly = true }: A11yPanelProps) {
      return (
        <section className="grid gap-4 rounded-lg border p-4" role="region" aria-label="Account settings">
          <label htmlFor="displayName" className="text-sm font-medium">Display name</label>
          <input
            id="displayName"
            name="displayName"
            className="rounded border px-3 py-2"
            value={value}
            readOnly={readonly}
            aria-invalid="false"
          />
          <p className="text-xs text-slate-500">This compact fixture is intentionally long enough for extraction.</p>
          <p className="text-xs text-slate-500">It keeps role, aria and readOnly as local source-derived anchors.</p>
        </section>
      );
    }
  `;
  const result = extractSource(path.join(repoRoot, "fixtures", "compressed", "A11yPanel.tsx"), source);
  const payload = toModelFacingPayload(result, repoRoot, {
    includeReactWebContextMetadata: true,
  });

  assert.equal(payload.useOriginal, undefined);
  assert.ok(payload.reactWebContext);
  assert.ok(payload.reactWebContext.a11yAnchors.some((item) => item.kind === "role" && item.label === "region"));
  assert.ok(payload.reactWebContext.a11yAnchors.some((item) => item.kind === "aria" && item.label === "aria-label=Account settings"));
  assert.ok(payload.reactWebContext.a11yAnchors.some((item) => item.kind === "aria" && item.label === "aria-invalid=false"));
  assert.ok(payload.reactWebContext.a11yAnchors.some((item) => item.kind === "readonly" && item.label === "input[name=displayName]"));
});

test("React Web wrapper fixture can expose source-observed htmlFor anchor from domain evidence", () => {
  const payload = payloadFor("test/fixtures/frontend-domain-expectations/react-web/custom-form-shell.tsx", {
    includeReactWebContextMetadata: true,
  });

  assert.ok(payload.reactWebContext);
  assert.ok(payload.reactWebContext.a11yAnchors.some((item) => item.kind === "htmlFor"));
});

test("non React Web and raw/useOriginal payloads omit reactWebContext", () => {
  for (const fixture of [
    "test/fixtures/frontend-domain-expectations/rn-primitive-basic.tsx",
    "test/fixtures/frontend-domain-expectations/tui-ink-basic.tsx",
    "test/fixtures/frontend-domain-expectations/webview-boundary-basic.tsx",
  ]) {
    const payload = payloadFor(fixture, { includeReactWebContextMetadata: true });
    assert.equal("reactWebContext" in payload, false, `${fixture} must not emit reactWebContext`);
  }

  const rawPayload = payloadFor("fixtures/raw/SimpleButton.tsx", { includeReactWebContextMetadata: true });
  assert.equal(rawPayload.useOriginal, true);
  assert.equal("reactWebContext" in rawPayload, false);
});
