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
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-client-state-concern-"));
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

test("concern-only allowlisted client-state source emits non-authorizing client-state concern evidence", () => {
  const source = `
    import { create } from "zustand";
    export const useDraftStore = create((set) => ({
      query: "",
      setQuery: (value) => set({ query: value }),
    }));
  `;
  const { domainDetection, policy, payload } = buildPayloadForSource(source, "ConcernOnlyClientStateNote.tsx");

  assert.equal(domainDetection.classification, "unknown");
  assert.equal(policy.allowed, false);
  assert.equal(payload.reactWebContext, undefined);
  assert.deepEqual(profileById(payload, "client-state"), {
    kind: "concern",
    id: "client-state",
    claim: "This source contains client-state concern evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    signals: ["zustand"],
  });
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), {
    allowed: false,
    reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  });
});

test("Jotai and Redux allowlisted imports emit client-state concern without broadening authorization", () => {
  const cases = [
    ["jotai", `import { atom } from "jotai"; export const queryAtom = atom("");`, ["jotai"]],
    ["redux", `import { configureStore } from "@reduxjs/toolkit"; export const store = configureStore({ reducer: {} });`, ["redux"]],
    ["react-redux", `import { useSelector, useDispatch } from "react-redux"; export function Hooks() { return { useSelector, useDispatch }; }`, ["redux"]],
    ["multi", `import { atom } from "jotai"; import { create } from "zustand"; const queryAtom = atom(""); export const useStore = create(() => ({ queryAtom }));`, ["jotai", "zustand"]],
  ];

  for (const [label, source, expectedSignals] of cases) {
    const { domainDetection, policy, payload } = buildPayloadForSource(source, `${label}.ts`);
    const clientStateProfile = profileById(payload, "client-state");

    assert.equal(domainDetection.classification, "unknown");
    assert.equal(policy.allowed, false);
    assert.ok(clientStateProfile, `${label} source should emit client-state concern metadata`);
    assert.deepEqual(clientStateProfile.signals, expectedSignals);
  }
});

test("React Web plus client-state concern keeps concern metadata separate from authorization", () => {
  const source = `
    import { create } from "zustand";
    const useDraftStore = create(() => ({ query: "" }));
    export function SearchForm() {
      return <form><input defaultValue={useDraftStore.getState().query} /></form>;
    }
  `;
  const { domainDetection, policy, payload } = buildPayloadForSource(source, "SearchForm.tsx");
  const withoutDomainPayload = { ...payload };
  delete withoutDomainPayload.domainPayload;

  assert.equal(domainDetection.classification, "react-web");
  assert.equal(policy.allowed, true);
  assert.deepEqual(profileById(payload, "client-state"), {
    kind: "concern",
    id: "client-state",
    claim: "This source contains client-state concern evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    signals: ["zustand"],
  });
  assert.ok(payload.domainPayload, "React Web domain payload remains the independent authorization surface");
  assert.equal("concernProfiles" in payload.domainPayload, false, "concern metadata must not leak into domain payload");
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), { allowed: true });
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, withoutDomainPayload, policy).allowed, false);
});

test("client-state concern stays fail-closed for generic hooks, local names, comments, and strings", () => {
  const source = `
    import { useReducer, useState } from "react";
    const notes = "zustand jotai redux create atom useSelector useDispatch";
    // store selector dispatch create atom redux zotand jotai
    export function NotesOnly() {
      const [value, setValue] = useState("");
      const [state, dispatch] = useReducer((current) => current, {});
      const store = { selector: "dispatch", create: "atom" };
      return { value, setValue, state, dispatch, store, notes };
    }
  `;
  const { payload } = buildPayloadForSource(source, "NotesOnly.tsx");

  assert.equal(profileById(payload, "client-state"), undefined);
});
