// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const { FRONTEND_DOMAIN_PROFILE_REGISTRY } = require(path.join(repoRoot, "dist", "core", "domain-profiles", "registry.js"));

const DOMAIN_PROFILE_PAYLOAD_POLICY_COVERAGE = {
  "react-web": {
    profileSource: "src/core/domain-profiles/react-web.ts",
    policySource: "src/core/payload-policy/react-web.ts",
    policyTest: "test/payload-policy-react-web.test.mjs",
    assessFunction: "assessReactWebPayloadPolicy",
    policyConstant: "REACT_WEB_CURRENT_SUPPORTED_PAYLOAD_POLICY",
    preReadDelegationAssertion: "preRead.assessFrontendPayloadPolicy(domainDetection)",
  },
  "react-native": {
    profileSource: "src/core/domain-profiles/react-native.ts",
    policySource: "src/core/payload-policy/react-native.ts",
    policyTest: "test/payload-policy-react-native.test.mjs",
    assessFunction: "assessReactNativePayloadPolicy",
    policyConstant: "RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY",
    preReadDelegationAssertion: "preRead.assessFrontendPayloadPolicy(domainDetection)",
  },
  webview: {
    profileSource: "src/core/domain-profiles/webview.ts",
    policySource: "src/core/payload-policy/webview.ts",
    policyTest: "test/payload-policy-webview.test.mjs",
    assessFunction: "assessWebViewPayloadPolicy",
    policyConstant: "WEBVIEW_BOUNDARY_FALLBACK_POLICY",
    preReadDelegationAssertion: "preRead.assessFrontendPayloadPolicy(domainDetection)",
  },
  "tui-ink": {
    profileSource: "src/core/domain-profiles/tui-ink.ts",
    policySource: "src/core/payload-policy/tui-ink.ts",
    policyTest: "test/payload-policy-tui-ink.test.mjs",
    assessFunction: "assessTuiInkPayloadPolicy",
    policyConstant: "TUI_INK_EVIDENCE_ONLY_PAYLOAD_POLICY",
    preReadDelegationAssertion: "preRead.assessFrontendPayloadPolicy(domainDetection)",
  },
  mixed: {
    profileSource: "src/core/domain-profiles/registry.ts",
    policySource: null,
    policyTest: "test/domain-profiles.test.mjs",
    terminalProfileReason: "synthetic mixed fallback profile; no payload is authorized from mixed-domain evidence",
  },
  unknown: {
    profileSource: "src/core/domain-profiles/registry.ts",
    policySource: null,
    policyTest: "test/domain-profiles.test.mjs",
    terminalProfileReason: "synthetic unknown deferred profile; no payload policy is owned until domain evidence exists",
  },
};

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("registered domain profiles have audited payload-policy seam coverage", () => {
  const registeredLanes = FRONTEND_DOMAIN_PROFILE_REGISTRY.map((profile) => profile.lane);
  const auditedLanes = Object.keys(DOMAIN_PROFILE_PAYLOAD_POLICY_COVERAGE);

  assert.deepEqual(auditedLanes.sort(), [...registeredLanes].sort(), "every registered profile needs an audit row");

  for (const lane of registeredLanes) {
    const coverage = DOMAIN_PROFILE_PAYLOAD_POLICY_COVERAGE[lane];
    assert.ok(coverage, `${lane} is missing payload-policy coverage metadata`);
    assert.ok(fs.existsSync(path.join(repoRoot, coverage.profileSource)), `${lane} profile source must exist`);
    assert.ok(fs.existsSync(path.join(repoRoot, coverage.policyTest)), `${lane} regression test/documentation lock must exist`);

    const policyTest = read(coverage.policyTest);
    if (coverage.policySource) {
      assert.ok(fs.existsSync(path.join(repoRoot, coverage.policySource)), `${lane} policy seam source must exist`);
      const policySource = read(coverage.policySource);
      assert.match(policySource, new RegExp(`export function ${coverage.assessFunction}\\b`), `${lane} must own an exported assess seam`);
      assert.match(policySource, new RegExp(`export const ${coverage.policyConstant}\\b`), `${lane} must own a stable policy identifier`);
      assert.match(policyTest, new RegExp(`\\b${coverage.assessFunction}\\b`), `${lane} regression test must import/exercise the seam`);
      assert.match(policyTest, new RegExp(`\\b${coverage.policyConstant}\\b`), `${lane} regression test must lock the policy identifier`);
      assert.ok(
        policyTest.includes(coverage.preReadDelegationAssertion),
        `${lane} regression test must lock pre-read delegation through the payload-policy seam`,
      );
    } else {
      assert.ok(coverage.terminalProfileReason, `${lane} terminal profile must document why it has no owned payload policy seam`);
      assert.match(policyTest, new RegExp(`"${lane}"`), `${lane} terminal profile status must stay covered by domain-profile tests`);
    }
  }
});
