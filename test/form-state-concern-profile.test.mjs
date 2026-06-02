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
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-form-state-concern-"));
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

test("concern-only form-state source emits non-authorizing form-state concern evidence", () => {
  const source = `
    import { useForm } from "react-hook-form";
    export function ConcernOnlyFormStateNote() {
      const { register, control, handleSubmit } = useForm({
        defaultValues: { email: "", password: "" },
      });
      const onSubmit = handleSubmit(() => undefined);
      return { register, control, onSubmit, errors: { email: "Required" } };
    }
  `;
  const { domainDetection, policy, payload } = buildPayloadForSource(source, "ConcernOnlyFormStateNote.tsx");

  assert.equal(domainDetection.classification, "unknown");
  assert.equal(policy.allowed, false);
  assert.equal(payload.reactWebContext, undefined);
  assert.deepEqual(payload.concernProfiles, [
    {
      kind: "concern",
      id: "form-state",
      claim: "This source contains form-state concern evidence.",
      nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
      signals: ["control", "default-values", "error-display", "handleSubmit", "react-hook-form", "register", "submit-handler", "useForm"],
    },
  ]);
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), {
    allowed: false,
    reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  });
});

test("form-state concern profile records useFieldArray without authorizing domain reuse", () => {
  const source = `
    import { useFieldArray, useForm } from "react-hook-form";
    export function ConcernOnlyFieldArrayNote() {
      const { control } = useForm({ defaultValues: { contacts: [] } });
      const { fields, append } = useFieldArray({ control, name: "contacts" });
      return { fields, append };
    }
  `;
  const { domainDetection, policy, payload } = buildPayloadForSource(source, "ConcernOnlyFieldArrayNote.tsx");

  assert.equal(domainDetection.classification, "unknown");
  assert.equal(policy.allowed, false);
  assert.equal(payload.reactWebContext, undefined);
  assert.ok(payload.concernProfiles?.[0].signals.includes("useFieldArray"));
  assert.ok(payload.concernProfiles?.[0].signals.includes("useForm"));
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), {
    allowed: false,
    reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  });
});

test("React Web plus form-state concern keeps concern metadata separate from authorization", () => {
  const source = `
    import { useForm } from "react-hook-form";
    export function SignupForm() {
      const { register, handleSubmit } = useForm({
        defaultValues: { email: "" },
      });
      const onSubmit = handleSubmit(() => undefined);
      return <form onSubmit={onSubmit}><input {...register("email")} /></form>;
    }
  `;
  const { domainDetection, policy, payload } = buildPayloadForSource(source, "SignupForm.tsx");
  const withoutDomainPayload = { ...payload };
  delete withoutDomainPayload.domainPayload;

  assert.equal(domainDetection.classification, "react-web");
  assert.equal(policy.allowed, true);
  assert.ok(Array.isArray(payload.concernProfiles));
  assert.equal(payload.concernProfiles[0].claim, "This source contains form-state concern evidence.");
  assert.ok(payload.concernProfiles[0].signals.includes("register"));
  assert.ok(payload.concernProfiles[0].signals.includes("handleSubmit"));
  assert.ok(payload.concernProfiles[0].signals.includes("default-values"));
  assert.ok(payload.concernProfiles[0].signals.includes("controlled-input"));
  assert.ok(payload.concernProfiles[0].signals.includes("submit-handler"));
  assert.ok(payload.domainPayload, "React Web domain payload remains the independent authorization surface");
  assert.equal("concernProfiles" in payload.domainPayload, false, "concern metadata must not leak into domain payload");
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), { allowed: true });
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, withoutDomainPayload, policy).allowed, false);
});

test("React Native state/action concern profile stays source-only and separate from RN payload authorization", () => {
  const source = `
    import { useReducer, useState } from "react";
    import { Pressable, Text, TextInput, View } from "react-native";
    function reducer(state, action) {
      return action.type === "submit" ? { submitted: true } : state;
    }
    export function NativeStateActionCard() {
      const [query, setQuery] = useState("");
      const [status, dispatch] = useReducer(reducer, { submitted: false });
      const submitQuery = () => {
        setQuery((current) => current.trim());
        dispatch({ type: "submit" });
      };
      return (
        <View>
          <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => dispatch({ type: "submit" })} />
          <Pressable onPress={submitQuery}><Text>{status.submitted ? "Submitted" : "Submit"}</Text></Pressable>
        </View>
      );
    }
  `;
  const { domainDetection, policy, payload } = buildPayloadForSource(source, "NativeStateActionCard.tsx");

  assert.equal(domainDetection.classification, "react-native");
  assert.equal(policy.allowed, true);
  assert.ok(Array.isArray(payload.concernProfiles));
  assert.deepEqual(payload.concernProfiles.find((row) => row.id === "rn-state-action"), {
    kind: "concern",
    id: "rn-state-action",
    claim: "This source contains RN state/action concern evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    signals: ["rn-local-dispatch", "rn-local-setter", "rn-same-file-handler", "rn-useReducer", "rn-useState"],
  });
  assert.equal("concernProfiles" in payload.domainPayload, false);
  assert.equal(payload.domainPayload.claimBoundary, "rn-primitive-input-narrow-payload-only");
});
