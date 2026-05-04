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
  assert.deepEqual(
    payload.reactWebContext.editTargetRouting.map((item) => ({
      kind: item.kind,
      label: item.label,
      priority: item.priority,
      loc: item.loc,
      source: item.source,
    })),
    [
      {
        kind: "primary-component",
        label: "HookEffectPanel",
        priority: 1,
        loc: { startLine: 9, endLine: 51 },
        source: "editGuidance.patchTargets",
      },
      {
        kind: "props-contract",
        label: "HookEffectPanelProps",
        priority: 2,
        loc: { startLine: 3, endLine: 7 },
        source: "editGuidance.patchTargets",
      },
      {
        kind: "effect",
        label: "useEffect deps:[loadUser, userId]",
        priority: 3,
        loc: { startLine: 12, endLine: 28 },
        source: "editGuidance.patchTargets",
      },
      {
        kind: "callback",
        label: "useMemo deps:[name]",
        priority: 4,
        loc: { startLine: 30, endLine: 32 },
        source: "editGuidance.patchTargets",
      },
      {
        kind: "callback",
        label: "useCallback deps:[loadUser, userId]",
        priority: 5,
        loc: { startLine: 34, endLine: 38 },
        source: "editGuidance.patchTargets",
      },
      {
        kind: "event-handler",
        label: "handleRefresh",
        priority: 6,
        loc: { startLine: 34, endLine: 38 },
        source: "editGuidance.patchTargets",
      },
      {
        kind: "event-handler",
        label: "handleRefresh",
        priority: 7,
        loc: { startLine: 44, endLine: 44 },
        source: "editGuidance.patchTargets",
      },
      {
        kind: "conditional-region",
        label: "useEffect",
        priority: 8,
        loc: { startLine: 12, endLine: 28 },
        source: "editGuidance.patchTargets",
      },
    ],
  );
  assert.deepEqual(payload.reactWebContext.editTargetRouting[0].evidence, ["editGuidance.patchTargets.component"]);

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

test("React Web edit-target routing is compact and keeps broad intent targets separate", () => {
  const payload = payloadFor("fixtures/compressed/FormControls.tsx", {
    includeEditGuidance: true,
    includeReactWebContextMetadata: true,
  });

  assert.ok(payload.reactWebContext);
  assert.equal(payload.reactWebContext.editTargetRouting.length, 8);
  assert.deepEqual(
    payload.reactWebContext.editTargetRouting.map((item) => [item.kind, item.label, item.priority, item.source]),
    [
      ["primary-component", "FormControls", 1, "editGuidance.patchTargets"],
      ["event-handler", "onSubmit", 2, "editGuidance.patchTargets"],
      ["event-handler", "() => undefined", 3, "editGuidance.patchTargets"],
      ["form-control", "form", 4, "editGuidance.patchTargets"],
      ["form-control", "input[name=email]", 5, "editGuidance.patchTargets"],
      ["form-control", "select[name=role]", 6, "editGuidance.patchTargets"],
      ["form-control", "textarea[name=notes]", 7, "editGuidance.patchTargets"],
      ["form-control", "Controller[name=email]", 8, "editGuidance.patchTargets"],
    ],
  );
  assert.ok(payload.reactWebContext.editTargetRouting.every((item) => item.loc));
  assert.ok(payload.reactWebContext.intentTargets.some((item) => item.intent === "form" && item.label === "useForm"));
});

test("React Web edit-target routing can use lower-priority range-less style facts", () => {
  const payload = payloadFor("fixtures/compressed/HookEffectPanel.tsx", {
    includeReactWebContextMetadata: true,
  });

  assert.ok(payload.reactWebContext);
  assert.deepEqual(payload.reactWebContext.editTargetRouting, [
    {
      kind: "style-region",
      label: "tailwind",
      priority: 1,
      source: "style",
      evidence: ["style"],
    },
  ]);
});

test("React Web edit-target routing skips broad-only patch targets but keeps lower-priority source facts", () => {
  const payload = payloadFor("fixtures/compressed/FormSection.tsx", {
    includeEditGuidance: true,
    includeReactWebContextMetadata: true,
  });

  assert.ok(payload.reactWebContext);
  assert.deepEqual(
    payload.reactWebContext.editTargetRouting.map((item) => ({
      kind: item.kind,
      label: item.label,
      priority: item.priority,
      source: item.source,
      loc: item.loc,
    })),
    [
      {
        kind: "style-region",
        label: "tailwind",
        priority: 1,
        source: "style",
        loc: undefined,
      },
      {
        kind: "repeated-block",
        label: "array-map-render",
        priority: 2,
        source: "structure",
        loc: undefined,
      },
    ],
  );
  assert.ok(payload.reactWebContext.intentTargets.some((item) => item.intent === "component" && item.label === "FormSection"));
  assert.ok(payload.reactWebContext.intentTargets.some((item) => item.intent === "props" && item.label === "FormSectionProps"));
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

test("React Web formStateFlow links controlled controls submit and state conditions", () => {
  const source = `
    import React, { useCallback, useMemo, useState } from "react";

    export function SignupForm() {
      const [email, setEmail] = useState("");
      const [accepted, setAccepted] = useState(false);
      const [saving, setSaving] = useState(false);
      const [error, setError] = useState("");
      const canSubmit = useMemo(() => email.includes("@") && accepted, [email, accepted]);
      const handleEmailChange = useCallback((event) => setEmail(event.target.value), []);
      const handleSubmit = useCallback((event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
      }, [email, canSubmit]);

      return (
        <form onSubmit={handleSubmit}>
          <input id="email" name="email" value={email} onChange={handleEmailChange} />
          <input
            name="accepted"
            type="checkbox"
            checked={accepted}
            onChange={() => setAccepted(!accepted)}
          />
          <button type="submit" disabled={saving || !canSubmit}>Save</button>
          {error ? <p role="alert">{error}</p> : null}
        </form>
      );
    }
  `;
  const result = extractSource(path.join(repoRoot, "fixtures", "compressed", "SignupForm.tsx"), source);
  const payload = toModelFacingPayload(result, repoRoot, {
    includeEditGuidance: true,
    includeReactWebContextMetadata: true,
  });

  assert.ok(payload.reactWebContext);
  const flow = payload.reactWebContext.formStateFlow;
  assert.ok(flow);
  assert.ok(flow.length <= 10);
  assert.ok(
    flow.some(
      (item) =>
        item.kind === "controlled-control" &&
        item.control?.tag === "input" &&
        item.control?.name === "email" &&
        item.control?.id === "email" &&
        item.control?.valueExpr === "email" &&
        item.control?.onChangeExpr === "handleEmailChange" &&
        item.loc,
    ),
  );
  assert.ok(
    flow.some(
      (item) =>
        item.kind === "controlled-control" &&
        item.control?.name === "accepted" &&
        item.control?.checkedExpr === "accepted" &&
        item.control?.onChangeExpr.includes("setAccepted"),
    ),
  );
  assert.ok(
    flow.some(
      (item) =>
        item.kind === "submit-flow" &&
        item.submit?.onSubmitExpr === "handleSubmit" &&
        !item.submit?.disabledExpr,
    ),
  );
  assert.ok(
    flow.some(
      (item) =>
        item.kind === "state-condition" &&
        item.condition?.role === "loading" &&
        item.condition?.expr === "saving || !canSubmit",
    ),
  );
  assert.ok(flow.some((item) => item.kind === "state-condition" && item.condition?.role === "error"));
  assert.ok(
    flow.some(
      (item) =>
        item.kind === "derived-state" &&
        item.hook?.hook === "useMemo" &&
        item.hook?.deps.includes("email") &&
        item.hook?.relatesTo?.includes("accepted"),
    ),
  );
  assert.ok(
    flow.some(
      (item) =>
        item.kind === "hook-dependency-link" &&
        item.hook?.hook === "useCallback" &&
        item.hook?.deps.includes("canSubmit") &&
        item.hook?.relatesTo?.includes("email") &&
        item.hook?.relatesTo?.includes("canSubmit"),
    ),
  );
  assert.equal(
    flow.filter((item) => item.kind === "state-condition" && item.condition?.expr === "saving || !canSubmit").length,
    1,
  );
  assert.equal(
    flow.filter((item) => item.kind === "hook-dependency-link" || item.kind === "derived-state").length <
      payload.reactWebContext.stateHints.length,
    true,
  );
  assert.notDeepEqual(
    flow.map((item) => [item.kind, item.label]),
    payload.reactWebContext.editTargetRouting.map((item) => [item.kind, item.label]),
  );
});

test("React Web formStateFlow is omitted without form or relational state-flow facts", () => {
  const payload = payloadFor("fixtures/compressed/FormSection.tsx", {
    includeReactWebContextMetadata: true,
  });

  assert.ok(payload.reactWebContext);
  assert.equal("formStateFlow" in payload.reactWebContext, false);
});

test("React Web formStateFlow dedupes multiline disabled control conditions", () => {
  const source = `
    import React, { useState } from "react";

    export function DisabledPanel() {
      const [saving, setSaving] = useState(false);
      const [email, setEmail] = useState("");

      return (
        <form>
          <p className="text-sm text-slate-500">
            This fixture is intentionally long enough for compressed extraction while keeping the disabled condition local.
          </p>
          <input
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={saving}
          />
          <p className="text-sm text-slate-500">
            The second paragraph keeps this fixture in compressed mode for React Web context metadata.
          </p>
        </form>
      );
    }
  `;
  const result = extractSource(path.join(repoRoot, "fixtures", "compressed", "DisabledPanel.tsx"), source);
  const payload = toModelFacingPayload(result, repoRoot, {
    includeReactWebContextMetadata: true,
  });

  assert.ok(payload.reactWebContext?.formStateFlow);
  assert.equal(
    payload.reactWebContext.formStateFlow.filter(
      (item) => item.kind === "state-condition" && item.condition?.expr === "saving",
    ).length,
    1,
  );
});

test("React Web formStateFlow does not link hooks from uncontrolled name or id tokens", () => {
  const source = `
    import React, { useEffect } from "react";

    export function UncontrolledEmail({ email }) {
      useEffect(() => {
        console.log(email);
      }, [email]);

      return (
        <form>
          <input id="email" name="email" onChange={() => undefined} />
          <p className="text-sm text-slate-500">
            This fixture is long enough for compressed React Web metadata while staying uncontrolled.
          </p>
          <p className="text-sm text-slate-500">
            The hook dep matches only the field name/id, not a value or checked expression.
          </p>
        </form>
      );
    }
  `;
  const result = extractSource(path.join(repoRoot, "fixtures", "compressed", "UncontrolledEmail.tsx"), source);
  const payload = toModelFacingPayload(result, repoRoot, {
    includeReactWebContextMetadata: true,
  });

  assert.ok(payload.reactWebContext);
  assert.equal(
    payload.reactWebContext.formStateFlow?.some(
      (item) => item.kind === "hook-dependency-link" && item.hook?.deps.includes("email"),
    ) ?? false,
    false,
  );
});


test("React Web import role hints summarize source-only dependency roles", () => {
  const source = `
    import React from "react";
    import { useForm } from "react-hook-form";
    import { z } from "zod";
    import Link from "next/link";
    import { Button } from "@/components/ui/button";
    import { Mail } from "lucide-react";
    import FieldShell from "./FieldShell";
    import { format } from "date-fns";

    type ImportRolePanelProps = { email: string };

    export function ImportRolePanel({ email }: ImportRolePanelProps) {
      const form = useForm();
      const schema = z.object({ email: z.string() });
      return (
        <FieldShell className="grid gap-3 rounded-lg border p-4">
          <Button type="button" className="inline-flex items-center gap-2">
            <Mail aria-hidden="true" />
            {email}
          </Button>
          <Link href="/settings" className="text-sm underline">Settings</Link>
          <p className="text-xs text-slate-500">{format(new Date(), "yyyy-MM-dd")}</p>
          <p className="text-xs text-slate-500">Import role hints are source facts only, not runtime library behavior.</p>
          <p className="text-xs text-slate-500">This fixture is intentionally long enough for compressed metadata.</p>
        </FieldShell>
      );
    }
  `;
  const result = extractSource(path.join(repoRoot, "fixtures", "compressed", "ImportRolePanel.tsx"), source);
  const payload = toModelFacingPayload(result, repoRoot, {
    includeReactWebContextMetadata: true,
  });

  assert.equal(payload.useOriginal, undefined);
  assert.ok(payload.reactWebContext);
  assert.deepEqual(
    payload.reactWebContext.importRoleHints.map((item) => ({
      role: item.role,
      moduleSpecifier: item.moduleSpecifier,
      importedSymbols: item.importedSymbols,
      evidence: item.evidence,
    })),
    [
      {
        role: "form-library",
        moduleSpecifier: "react-hook-form",
        importedSymbols: ["useForm"],
        evidence: ["structure.imports"],
      },
      {
        role: "validation-library",
        moduleSpecifier: "zod",
        importedSymbols: ["z"],
        evidence: ["structure.imports"],
      },
      {
        role: "routing",
        moduleSpecifier: "next/link",
        importedSymbols: ["Link"],
        evidence: ["structure.imports"],
      },
      {
        role: "ui-kit",
        moduleSpecifier: "@/components/ui/button",
        importedSymbols: ["Button"],
        evidence: ["structure.imports"],
      },
      {
        role: "icon-library",
        moduleSpecifier: "lucide-react",
        importedSymbols: ["Mail"],
        evidence: ["structure.imports"],
      },
      {
        role: "local-component",
        moduleSpecifier: "./FieldShell",
        importedSymbols: ["FieldShell"],
        evidence: ["structure.imports"],
      },
    ],
  );
  assert.equal(
    payload.reactWebContext.importRoleHints.some((item) => item.moduleSpecifier === "date-fns"),
    false,
  );
});

test("React Web import role hints are omitted without recognized source evidence", () => {
  const source = `
    import React from "react";
    import { format } from "date-fns";

    export function UnknownImportPanel() {
      return (
        <section className="grid gap-3 rounded-lg border p-4">
          <p className="text-xs text-slate-500">{format(new Date(), "yyyy-MM-dd")}</p>
          <p className="text-xs text-slate-500">Unknown imports should not become guessed dependency role hints.</p>
          <p className="text-xs text-slate-500">This fixture is intentionally long enough for compressed metadata.</p>
        </section>
      );
    }
  `;
  const result = extractSource(path.join(repoRoot, "fixtures", "compressed", "UnknownImportPanel.tsx"), source);
  const payload = toModelFacingPayload(result, repoRoot, {
    includeReactWebContextMetadata: true,
  });

  assert.equal(payload.useOriginal, undefined);
  assert.ok(payload.reactWebContext);
  assert.equal("importRoleHints" in payload.reactWebContext, false);
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



test("React Web a11y anchors expose source-derived semantic relationships", () => {
  const source = `
    import React from "react";

    type ContactFormProps = { email: string; invalid: boolean; onEmailChange(value: string): void };

    export function ContactForm({ email, invalid, onEmailChange }: ContactFormProps) {
      return (
        <form className="grid gap-3 rounded-lg border p-4">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input
            id="email"
            name="email"
            value={email}
            onChange={(event) => onEmailChange(event.currentTarget.value)}
            aria-invalid={invalid}
            aria-describedby="email-error email-help missing-id"
            aria-labelledby="email-label"
          />
          <span id="email-label" className="sr-only">Primary email address</span>
          <p id="email-error" role="alert" className="text-sm text-red-600">Email is required</p>
          <p id="email-help" className="text-xs text-slate-500">Use your work email for account recovery.</p>
          <p className="text-xs text-slate-500">This source is intentionally long enough to stay in compressed mode.</p>
          <p className="text-xs text-slate-500">A11y relations remain source-derived facts, not runtime DOM validation.</p>
        </form>
      );
    }
  `;
  const result = extractSource(path.join(repoRoot, "fixtures", "compressed", "ContactForm.tsx"), source);
  const payload = toModelFacingPayload(result, repoRoot, {
    includeReactWebContextMetadata: true,
  });

  assert.equal(payload.useOriginal, undefined);
  assert.ok(payload.reactWebContext);

  const anchors = payload.reactWebContext.a11yAnchors;
  assert.ok(
    anchors.some(
      (item) => item.kind === "htmlFor" && item.label === "email" && item.relation?.kind === "label-control" && item.relation.targetId === "email",
    ),
  );
  assert.ok(
    anchors.some(
      (item) =>
        item.kind === "aria" &&
        item.label.startsWith("aria-describedby=email-error email-help") &&
        item.relation?.kind === "aria-idrefs" &&
        item.relation.resolvedIds.includes("email-error") &&
        !item.relation.resolvedIds.includes("missing-id"),
    ),
  );
  assert.ok(
    anchors.some(
      (item) =>
        item.kind === "aria" &&
        item.label === "aria-labelledby=email-label" &&
        item.relation?.kind === "aria-idrefs" &&
        item.relation.resolvedIds.includes("email-label"),
    ),
  );
  assert.ok(
    anchors.some((item) => item.kind === "aria" && item.label === "aria-invalid=invalid" && item.relation?.kind === "invalid-state"),
  );
  assert.ok(
    anchors.some((item) => item.kind === "role" && item.label === "alert" && item.relation?.kind === "alert-region" && item.relation.sourceId === "email-error"),
  );
});

test("React Web a11y id-ref relations require matching source ids", () => {
  const source = `
    import React from "react";

    export function MissingA11yRelation() {
      return (
        <form className="grid gap-3 rounded-lg border p-4">
          <label htmlFor="missing-email" className="text-sm font-medium">Email</label>
          <input
            id="email"
            name="email"
            aria-describedby="missing-help"
            className="rounded border px-3 py-2"
          />
          <p className="text-xs text-slate-500">This fixture is intentionally long enough for compressed metadata.</p>
          <p className="text-xs text-slate-500">Missing source ids must not become resolved semantic relations.</p>
        </form>
      );
    }
  `;
  const result = extractSource(path.join(repoRoot, "fixtures", "compressed", "MissingA11yRelation.tsx"), source);
  const payload = toModelFacingPayload(result, repoRoot, {
    includeReactWebContextMetadata: true,
  });

  assert.equal(payload.useOriginal, undefined);
  assert.ok(payload.reactWebContext);

  const anchors = payload.reactWebContext.a11yAnchors;
  assert.ok(anchors.some((item) => item.kind === "htmlFor" && item.label === "missing-email"));
  assert.equal(
    anchors.some((item) => item.kind === "htmlFor" && item.label === "missing-email" && item.relation?.kind === "label-control"),
    false,
  );
  assert.ok(anchors.some((item) => item.kind === "aria" && item.label === "aria-describedby=missing-help"));
  assert.equal(
    anchors.some((item) => item.kind === "aria" && item.label === "aria-describedby=missing-help" && item.relation?.kind === "aria-idrefs"),
    false,
  );
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
