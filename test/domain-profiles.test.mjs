// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const {
  FRONTEND_DOMAIN_PROFILE_REGISTRY,
  getDomainProfileDefinition,
  outcomeForClassification,
  profileForClassification,
  resolveDomainClassification,
} = require(path.join(repoRoot, "dist", "core", "domain-profiles", "registry.js"));

const forbiddenSupportClaims = /React Native support is available|React Native is supported today|WebView support is available|WebView is supported today|TUI support is available|TUI is supported today|TUI\/Ink is supported today|default WebView compact extraction is enabled/i;

function evidence(domain, signal = "import", detail = domain) {
  return [{ domain, signal, detail }];
}

test("domain profile registry exposes behavior-neutral lane ownership metadata", () => {
  assert.deepEqual(
    FRONTEND_DOMAIN_PROFILE_REGISTRY.map((profile) => profile.lane),
    ["react-web", "react-native", "webview", "tui-ink", "mixed", "unknown"],
  );

  assert.deepEqual(getDomainProfileDefinition("react-web"), {
    lane: "react-web",
    evidenceDomain: "react-web",
    outcome: "extract",
    claimStatus: "current-supported-lane",
    fallbackFirst: false,
    claimBoundary: "react-web-measured-extraction",
  });

  assert.equal(getDomainProfileDefinition("react-native").boundaryReason, "unsupported-react-native-webview-boundary");
  assert.equal(getDomainProfileDefinition("webview").fallbackFirst, true);
  assert.equal(getDomainProfileDefinition("tui-ink").claimStatus, "evidence-only");
});

test("domain profile registry preserves existing detector classification outcomes", () => {
  assert.equal(resolveDomainClassification([], false), "unknown");
  assert.equal(resolveDomainClassification([], true), "react-web");
  assert.equal(resolveDomainClassification(evidence("react-native"), false), "react-native");
  assert.equal(resolveDomainClassification(evidence("webview"), false), "webview");
  assert.equal(resolveDomainClassification(evidence("tui-ink"), false), "tui-ink");
  assert.equal(resolveDomainClassification(evidence("react-native"), true), "mixed");
  assert.equal(resolveDomainClassification([...evidence("react-native"), ...evidence("webview")], false), "mixed");

  assert.deepEqual(outcomeForClassification("react-web"), { outcome: "extract" });
  assert.deepEqual(outcomeForClassification("react-native"), { outcome: "fallback", reason: "unsupported-react-native-webview-boundary" });
  assert.deepEqual(outcomeForClassification("webview"), { outcome: "fallback", reason: "unsupported-react-native-webview-boundary" });
  assert.deepEqual(outcomeForClassification("mixed"), { outcome: "fallback", reason: "unsupported-react-native-webview-boundary" });
  assert.deepEqual(outcomeForClassification("unknown"), { outcome: "deferred" });
});

test("domain profile metadata remains evidence and policy boundary, not support wording", () => {
  const rnOutcome = outcomeForClassification("react-native");
  assert.deepEqual(profileForClassification("react-native", rnOutcome.outcome, rnOutcome.reason), {
    lane: "react-native",
    outcome: "fallback",
    claimStatus: "fallback-boundary",
    fallbackFirst: true,
    boundaryReason: "unsupported-react-native-webview-boundary",
    claimBoundary: "source-reading-boundary",
  });

  const tuiOutcome = outcomeForClassification("tui-ink");
  assert.deepEqual(profileForClassification("tui-ink", tuiOutcome.outcome, tuiOutcome.reason), {
    lane: "tui-ink",
    outcome: "extract",
    claimStatus: "evidence-only",
    fallbackFirst: false,
    claimBoundary: "domain-evidence-only",
  });

  for (const file of [
    "src/core/domain-profiles/types.ts",
    "src/core/domain-profiles/registry.ts",
    "src/core/domain-profiles/react-web.ts",
    "src/core/domain-profiles/react-native.ts",
    "src/core/domain-profiles/webview.ts",
    "src/core/domain-profiles/tui-ink.ts",
  ]) {
    assert.doesNotMatch(fs.readFileSync(path.join(repoRoot, file), "utf8"), forbiddenSupportClaims, `${file} must not add support claims`);
  }
});
