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
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-validation-schema-concern-"));
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

test("concern-only validation/schema source emits non-authorizing validation/schema concern evidence", () => {
  const source = `
    import { z } from "zod";
    import { zodResolver } from "@hookform/resolvers/zod";

    const signupSchema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    });

    export function ConcernOnlyValidationSchemaNote() {
      const resolver = zodResolver(signupSchema);
      return { resolver, schemaKeys: Object.keys(signupSchema.shape) };
    }
  `;
  const { domainDetection, policy, payload } = buildPayloadForSource(source, "ConcernOnlyValidationSchemaNote.tsx");
  const validationProfile = profileById(payload, "validation-schema");

  assert.equal(domainDetection.classification, "unknown");
  assert.equal(policy.allowed, false);
  assert.equal(payload.reactWebContext, undefined);
  assert.deepEqual(validationProfile, {
    kind: "concern",
    id: "validation-schema",
    claim: "This source contains validation/schema concern evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    schemaKeys: ["email", "password"],
    signals: ["resolver", "same-file-schema-keys", "zod"],
  });
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), {
    allowed: false,
    reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  });
});

test("React Web + form-state + validation/schema keeps concern metadata separate from authorization", () => {
  const source = `
    import { useForm } from "react-hook-form";
    import { z } from "zod";
    import { zodResolver } from "@hookform/resolvers/zod";

    const signupSchema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    });

    export function SignupForm() {
      const { register, handleSubmit } = useForm({
        resolver: zodResolver(signupSchema),
        defaultValues: { email: "", password: "" },
      });
      const onSubmit = handleSubmit(() => undefined);
      return <form onSubmit={onSubmit}><input {...register("email")} /><input {...register("password")} /></form>;
    }
  `;
  const { domainDetection, policy, payload } = buildPayloadForSource(source, "SignupForm.tsx");
  const withoutDomainPayload = { ...payload };
  delete withoutDomainPayload.domainPayload;

  assert.equal(domainDetection.classification, "react-web");
  assert.equal(policy.allowed, true);
  assert.equal(payload.concernProfiles.length, 2);
  assert.equal(profileById(payload, "form-state").claim, "This source contains form-state concern evidence.");
  assert.deepEqual(profileById(payload, "validation-schema"), {
    kind: "concern",
    id: "validation-schema",
    claim: "This source contains validation/schema concern evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    schemaKeys: ["email", "password"],
    signals: ["resolver", "same-file-schema-keys", "zod"],
  });
  assert.ok(payload.domainPayload, "domain payload remains the independent authorization surface");
  assert.equal("concernProfiles" in payload.domainPayload, false, "concern metadata must not leak into domain payload");
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), { allowed: true });
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, withoutDomainPayload, policy).allowed, false);
});

test("validation/schema concern detects yup and valibot imports without broadening authorization", () => {
  const cases = [
    ["yup", `import * as yup from "yup"; const schema = yup.object({ email: yup.string().required() }); export const value = schema;`],
    ["valibot", `import * as v from "valibot"; const schema = v.object({ email: v.string() }); export const value = schema;`],
  ];

  for (const [signal, source] of cases) {
    const { payload } = buildPayloadForSource(source, `${signal}.ts`);
    const validationProfile = profileById(payload, "validation-schema");

    assert.ok(validationProfile, `${signal} source should emit validation/schema concern metadata`);
    assert.ok(validationProfile.signals.includes(signal), `${signal} signal should be present`);
    assert.ok(validationProfile.signals.includes("same-file-schema-keys"), `${signal} same-file schema keys signal should be present`);
    assert.deepEqual(validationProfile.schemaKeys, ["email"]);
  }
});

test("validation/schema concern stays fail-closed for comments, strings, and local schema-shaped noise", () => {
  const source = `
    const schema = "zod resolver validationSchema yup valibot";
    const schemaNotes = { schemaName: "signup" };
    // resolver validationSchema z.object({ email: "not real" })
    export function NotesOnly() {
      return { schema, schemaNotes };
    }
  `;
  const { payload } = buildPayloadForSource(source, "NotesOnly.tsx");

  assert.equal(profileById(payload, "validation-schema"), undefined);
});

test("validation/schema same-file schema keys stay fail-closed under shadowed library bindings", () => {
  const source = `
    import { z } from "zod";
    import { object } from "valibot";

    function shadowed(z) {
      const localSchema = z.object({ leaked: z.string() });
      return localSchema;
    }

    function otherShadow(object) {
      return object({ hidden: true });
    }

    export function NotesOnly() {
      return { shadowed, otherShadow };
    }
  `;
  const { payload } = buildPayloadForSource(source, "ShadowedBindings.tsx");
  const validationProfile = profileById(payload, "validation-schema");

  assert.ok(validationProfile, "library imports still surface validation/schema concern metadata");
  assert.deepEqual(validationProfile.signals, ["valibot", "zod"]);
  assert.equal(validationProfile.schemaKeys, undefined);
});
