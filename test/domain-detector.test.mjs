// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const { detectDomain, detectDomainFromSource } = require(path.join(repoRoot, "dist", "core", "domain-detector.js"));

const fixtureRoot = path.join(repoRoot, "test", "fixtures", "frontend-domain-expectations");
const manifestPath = path.join(fixtureRoot, "manifest.json");
const forbiddenSupportClaims = /React Native support is available|React Native is supported today|WebView support is available|WebView is supported today|TUI support is available|TUI is supported today|TUI\/Ink is supported today|default WebView compact extraction is enabled/i;

function assertSignals(result, expectedSignals) {
  for (const signal of expectedSignals) {
    assert.ok(result.signals.includes(signal), `missing signal ${signal}`);
  }
}

function assertProfile(result, expected) {
  assert.equal(result.profile.lane, result.classification);
  assert.equal(result.profile.outcome, result.outcome);
  assert.equal(result.profile.claimStatus, expected.claimStatus);
  assert.equal(result.profile.fallbackFirst, expected.fallbackFirst);
  assert.equal(result.profile.claimBoundary, expected.claimBoundary);
  if (expected.boundaryReason !== undefined) {
    assert.equal(result.profile.boundaryReason, expected.boundaryReason);
  } else {
    assert.equal(result.profile.boundaryReason, undefined);
  }
}

function expectedClassificationForLane(lane) {
  if (lane === "react-web") return "react-web";
  if (lane === "tui-ink") return "tui-ink";
  if (lane.startsWith("rn-")) return "react-native";
  if (lane === "webview-boundary") return "webview";
  if (lane === "webview-bridge") return "mixed";
  if (lane === "negative-fallback") return "mixed";
  throw new Error(`No detector classification expectation for lane: ${lane}`);
}


test("detects React Web profile metadata for the current supported lane", () => {
  const result = detectDomain(path.join(repoRoot, "fixtures", "compressed", "FormControls.tsx"));
  assert.equal(result.classification, "react-web");
  assert.equal(result.outcome, "extract");
  assertProfile(result, {
    claimStatus: "current-supported-lane",
    fallbackFirst: false,
    claimBoundary: "react-web-measured-extraction",
  });
  assert.doesNotMatch(JSON.stringify(result), forbiddenSupportClaims);
});

test("detects React Web custom-component className evidence for the current supported lane", () => {
  const result = detectDomainFromSource(
    `import { Button, FieldLabel } from "@/components/ui";
     export function CustomOnlyForm() {
       return <Button className="rounded px-3"><FieldLabel htmlFor="email">Email</FieldLabel></Button>;
     }`,
    "CustomOnlyForm.tsx",
  );

  assert.equal(result.classification, "react-web");
  assert.equal(result.outcome, "extract");
  assertProfile(result, {
    claimStatus: "current-supported-lane",
    fallbackFirst: false,
    claimBoundary: "react-web-measured-extraction",
  });
  assertSignals(result, ["react-web:jsx-attribute:className", "react-web:jsx-attribute:htmlFor"]);
  assert.doesNotMatch(JSON.stringify(result), forbiddenSupportClaims);
});

test("detects React Native evidence signals without support wording", () => {
  const primitive = detectDomain(path.join(fixtureRoot, "rn-primitive-basic.tsx"));
  assert.equal(primitive.classification, "react-native");
  assert.equal(primitive.domain, "react-native");
  assert.equal(primitive.outcome, "fallback");
  assert.equal(primitive.reason, "unsupported-react-native-webview-boundary");
  assertProfile(primitive, { claimStatus: "fallback-boundary", fallbackFirst: true, claimBoundary: "source-reading-boundary", boundaryReason: "unsupported-react-native-webview-boundary" });
  assertSignals(primitive, [
    "react-native:import:react-native",
    "react-native:primitive:View",
    "react-native:primitive:Text",
    "react-native:primitive:TextInput",
    "react-native:primitive:Pressable",
    "react-native:jsx-prop:onChangeText",
    "react-native:jsx-prop:onPress",
  ]);

  const styled = detectDomain(path.join(fixtureRoot, "rn-style-platform-navigation.tsx"));
  assert.equal(styled.classification, "react-native");
  assertSignals(styled, [
    "react-native:primitive:ScrollView",
    "react-native:style-factory:StyleSheet.create",
    "react-native:platform-select:Platform.select",
    "react-native:navigation-import:@react-navigation/native",
    "react-native:navigation-hook:useNavigation",
    "react-native:navigation-hook:useRoute",
    "react-native:navigation-route:route.params",
  ]);

  const image = detectDomain(path.join(fixtureRoot, "rn-image-scrollview.tsx"));
  assert.equal(image.classification, "react-native");
  assertSignals(image, [
    "react-native:primitive:Image",
    "react-native:primitive:ScrollView",
    "react-native:api-call:Dimensions.get",
    "react-native:jsx-prop:pagingEnabled",
    "react-native:style-prop:resizeMode",
  ]);

  const touchable = detectDomain(path.join(fixtureRoot, "rn-interaction-gesture.tsx"));
  assert.equal(touchable.classification, "react-native");
  assertSignals(touchable, [
    "react-native:primitive:TouchableOpacity",
    "react-native:primitive:FlatList",
    "react-native:api-call:PanResponder.create",
    "react-native:jsx-prop:activeOpacity",
  ]);

  assert.doesNotMatch(JSON.stringify([primitive, styled, image, touchable]), forbiddenSupportClaims);
});

test("detects WebView evidence signals without support wording", () => {
  const result = detectDomain(path.join(fixtureRoot, "webview-boundary-basic.tsx"));
  assert.equal(result.classification, "webview");
  assert.equal(result.outcome, "fallback");
  assert.equal(result.reason, "unsupported-react-native-webview-boundary");
  assertProfile(result, { claimStatus: "fallback-boundary", fallbackFirst: true, claimBoundary: "source-reading-boundary", boundaryReason: "unsupported-react-native-webview-boundary" });
  assertSignals(result, [
    "webview:import:react-native-webview",
    "webview:component:WebView",
    "webview:prop:source",
    "webview:source-shape:uri",
    "webview:prop:injectedJavaScript",
    "webview:prop:onMessage",
    "webview:bridge-marker:ReactNativeWebView.postMessage",
  ]);
  assert.doesNotMatch(JSON.stringify(result), forbiddenSupportClaims);
});

test("detects TUI Ink evidence signals without support wording", () => {
  const result = detectDomain(path.join(fixtureRoot, "tui-ink-basic.tsx"));
  assert.equal(result.classification, "tui-ink");
  assert.equal(result.outcome, "extract");
  assertProfile(result, { claimStatus: "evidence-only", fallbackFirst: false, claimBoundary: "domain-evidence-only" });
  assertSignals(result, ["tui-ink:import:ink", "tui-ink:primitive:Box", "tui-ink:primitive:Text", "tui-ink:hook:useInput"]);
  assert.doesNotMatch(JSON.stringify(result), forbiddenSupportClaims);
});

test("classifies mixed and unknown fallback cases", () => {
  const mixed = detectDomain(path.join(fixtureRoot, "negative-rn-webview-boundary.tsx"));
  assert.equal(mixed.classification, "mixed");
  assert.equal(mixed.outcome, "fallback");
  assert.equal(mixed.reason, "unsupported-react-native-webview-boundary");
  assertProfile(mixed, { claimStatus: "fallback-boundary", fallbackFirst: true, claimBoundary: "source-reading-boundary", boundaryReason: "unsupported-react-native-webview-boundary" });
  assert.ok(mixed.signals.some((signal) => signal.startsWith("react-native:")));
  assert.ok(mixed.signals.some((signal) => signal.startsWith("webview:")));

  const unknown = detectDomainFromSource("export const answer = 42;", "utility.ts");
  assert.equal(unknown.classification, "unknown");
  assert.equal(unknown.outcome, "deferred");
  assertProfile(unknown, { claimStatus: "deferred", fallbackFirst: false, claimBoundary: "unknown-deferred" });
  assert.deepEqual(unknown.evidence, []);

  assert.doesNotMatch(JSON.stringify([mixed, unknown]), forbiddenSupportClaims);
});

test("classifies web DOM mixed with non-web frontend signals as fallback", () => {
  const rnDom = detectDomainFromSource(
    `import { View } from "react-native";
     export function Mixed() { return <div><View /></div>; }`,
    "MixedRnDom.tsx",
  );
  assert.equal(rnDom.classification, "mixed");
  assert.equal(rnDom.outcome, "fallback");
  assert.equal(rnDom.reason, "unsupported-react-native-webview-boundary");
  assert.ok(rnDom.signals.includes("react-native:import:react-native"));
  assert.ok(rnDom.signals.includes("react-native:primitive:View"));

  const webviewDom = detectDomainFromSource(
    `import { WebView } from "react-native-webview";
     export function Mixed() { return <form><WebView source={{ html: "<p>checkout</p>" }} /></form>; }`,
    "MixedWebViewDom.tsx",
  );
  assert.equal(webviewDom.classification, "mixed");
  assert.equal(webviewDom.outcome, "fallback");
  assert.equal(webviewDom.reason, "unsupported-react-native-webview-boundary");
  assert.ok(webviewDom.signals.includes("webview:import:react-native-webview"));
  assert.ok(webviewDom.signals.includes("webview:component:WebView"));
  assert.ok(webviewDom.signals.includes("webview:source-shape:html"));

  const tuiDom = detectDomainFromSource(
    `import { Box } from "ink";
     export function Mixed() { return <div><Box /></div>; }`,
    "MixedTuiDom.tsx",
  );
  assert.equal(tuiDom.classification, "mixed");
  assert.equal(tuiDom.outcome, "fallback");
  assert.equal(tuiDom.reason, "unsupported-react-native-webview-boundary");
  assert.ok(tuiDom.signals.includes("tui-ink:import:ink"));
  assert.ok(tuiDom.signals.includes("tui-ink:primitive:Box"));

  const rnClassName = detectDomainFromSource(
    `import { View } from "react-native";
     export function NativeWithClassName() { return <View className="p-2" />; }`,
    "NativeWithClassName.tsx",
  );
  assert.equal(rnClassName.classification, "mixed");
  assert.equal(rnClassName.outcome, "fallback");
  assert.equal(rnClassName.reason, "unsupported-react-native-webview-boundary");
  assert.ok(rnClassName.signals.includes("react-native:primitive:View"));
  assert.ok(rnClassName.signals.includes("react-web:jsx-attribute:className"));

  assert.doesNotMatch(JSON.stringify([rnDom, webviewDom, tuiDom, rnClassName]), forbiddenSupportClaims);
});

test("treats bare WebView JSX as a fallback-first boundary signal", () => {
  const result = detectDomainFromSource(
    `export function Preview() {
       return <WebView source={{ html: "<script>window.ReactNativeWebView.postMessage('ready')</script>" }} onMessage={() => {}} />;
     }`,
    "Preview.tsx",
  );
  assert.equal(result.classification, "webview");
  assert.equal(result.outcome, "fallback");
  assert.equal(result.reason, "unsupported-react-native-webview-boundary");
  assert.ok(result.signals.includes("webview:component:WebView"));
  assert.ok(result.signals.includes("webview:prop:source"));
  assert.ok(result.signals.includes("webview:source-shape:html"));
  assert.ok(result.signals.includes("webview:prop:onMessage"));
  assert.ok(result.signals.includes("webview:bridge-marker:window.ReactNativeWebView"));
});

test("keeps WebView bridge-pair evidence as fallback-only boundary facts", () => {
  const result = detectDomain(path.join(fixtureRoot, "webview", "checkout-bridge-native.tsx"));
  assert.equal(result.classification, "mixed");
  assert.equal(result.outcome, "fallback");
  assert.equal(result.reason, "unsupported-react-native-webview-boundary");
  assert.ok(result.signals.includes("react-native:primitive:View"));
  assert.ok(result.signals.includes("webview:component:WebView"));
  assert.ok(result.signals.includes("webview:prop:source"));
  assert.ok(result.signals.includes("webview:prop:injectedJavaScript"));
  assert.ok(result.signals.includes("webview:prop:onMessage"));
  assert.ok(result.signals.includes("webview:bridge-call:postMessage"));
});



test("detects expanded domain-aware source evidence for web, native, webview, tui, and shared lanes", () => {
  const web = detectDomainFromSource(
    `import Link from "next/link";
     export function AccountRoute() {
       window.localStorage.setItem("visited", "1");
       return <div className="route"><Link href="/account"><label htmlFor="account">Account</label></Link></div>;
     }`,
    "src/app/account/page.tsx",
  );
  assert.equal(web.classification, "react-web");
  assertSignals(web, ["react-web:framework-component:next/link:Link", "react-web:browser-global:window", "react-web:jsx-attribute:className", "react-web:jsx-attribute:htmlFor"]);

  const native = detectDomainFromSource(
    `export default { resolver: { sourceExts: ["tsx"] } };`,
    "metro.config.js",
  );
  assert.equal(native.classification, "react-native");
  assertSignals(native, ["react-native:metro-config:metro.config.js"]);

  const webview = detectDomainFromSource(
    `import { WebView } from "react-native-webview";
     import { Linking } from "react-native";
     export function CheckoutWebView() {
       return <WebView source={{ uri: "myapp://checkout/session" }} onMessage={() => Linking.openURL("myapp://handoff")} />;
     }`,
    "CheckoutWebView.tsx",
  );
  assert.equal(webview.classification, "mixed");
  assertSignals(webview, ["webview:handoff-marker:uri-scheme", "webview:deeplink-call:Linking.openURL"]);

  const tui = detectDomainFromSource(
    `export function renderStatus() {
       if (process.stdout.isTTY) process.stdout.write("golden snapshot");
       process.stderr.write("warning");
     }`,
    "src/tui/status-board.ts",
  );
  assert.equal(tui.classification, "tui-ink");
  assertSignals(tui, ["tui-ink:terminal-stream:process.stdout", "tui-ink:terminal-api:process.stdout.write", "tui-ink:terminal-tty:isTTY", "tui-ink:terminal-api:process.stderr.write"]);

  const shared = detectDomainFromSource(
    `export const designTokens = { color: "red" };
     export type ApiContract = { id: string };
     export const schema = "api contract";`,
    "src/shared/contracts/theme-tokens.ts",
  );
  assert.equal(shared.classification, "shared");
  assert.equal(shared.profile.claimStatus, "evidence-only");
  assertSignals(shared, ["shared:path-segment:shared", "shared:shared-identifier:designTokens", "shared:shared-identifier:ApiContract", "shared:shared-marker:api contract"]);

  assert.doesNotMatch(JSON.stringify([web, native, webview, tui, shared]), forbiddenSupportClaims);
});


test("selected fixture manifest stays aligned with detector classifications and outcomes", () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  for (const item of manifest.selected) {
    const result = detectDomain(path.join(repoRoot, item.path));
    assert.equal(result.classification, expectedClassificationForLane(item.lane), `${item.id} classification must match manifest lane`);
    assert.equal(result.domain, result.classification, `${item.id} deprecated domain alias must mirror classification`);
    assert.equal(result.outcome, item.expectedOutcome, `${item.id} detector outcome must match manifest`);
    assert.equal(result.profile.lane, result.classification, `${item.id} profile lane must mirror classification`);
    assert.equal(result.profile.outcome, result.outcome, `${item.id} profile outcome must mirror detector outcome`);

    if (item.expectedReason !== undefined) {
      assert.equal(result.reason, item.expectedReason, `${item.id} detector fallback reason must match manifest`);
    } else {
      assert.equal(result.reason, undefined, `${item.id} must not invent a fallback reason`);
    }

    if (result.classification !== "react-web") {
      assert.ok(result.evidence.length > 0, `${item.id} detector should keep evidence for non-web lanes`);
    }
    assert.doesNotMatch(JSON.stringify(result), forbiddenSupportClaims, `${item.id} detector evidence must not include support claims`);
  }
});

test("changed detector source does not introduce forbidden support wording", () => {
  const source = fs.readFileSync(path.join(repoRoot, "src", "core", "domain-detector.ts"), "utf8");
  assert.doesNotMatch(source, forbiddenSupportClaims);
});

test("CLI inspect-domain accepts --json before and after the file path", () => {
  const fixture = path.join(fixtureRoot, "webview-boundary-basic.tsx");

  for (const args of [
    ["inspect-domain", "--json", fixture],
    ["inspect-domain", fixture, "--json"],
  ]) {
    const cli = spawnSync(process.execPath, [path.join(repoRoot, "dist", "cli", "index.js"), ...args], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    assert.equal(cli.status, 0, cli.stderr);
    const result = JSON.parse(cli.stdout);
    assert.equal(result.command, "inspect-domain");
    assert.equal(result.filePath, path.relative(repoRoot, fixture));
    assert.equal(result.domainDetection.classification, "webview");
    assert.deepEqual(result.fallbackFirst, { applies: true, reason: "unsupported-react-native-webview-boundary" });
    assert.doesNotMatch(JSON.stringify(result), forbiddenSupportClaims);
  }
});

test("CLI inspect-domain prints detector evidence without support claims", () => {
  const fixture = path.join(fixtureRoot, "webview-boundary-basic.tsx");
  const cli = spawnSync(process.execPath, [path.join(repoRoot, "dist", "cli", "index.js"), "inspect-domain", fixture, "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(cli.status, 0, cli.stderr);
  const result = JSON.parse(cli.stdout);

  assert.equal(result.schemaVersion, 1);
  assert.equal(result.command, "inspect-domain");
  assert.equal(result.filePath, path.relative(repoRoot, fixture));
  assert.deepEqual(Object.keys(result.domainDetection).sort(), ["classification", "evidence"]);
  assert.equal(result.domainDetection.classification, "webview");
  assert.ok(result.domainDetection.evidence.some((item) => item.domain === "webview" && item.signal === "component" && item.detail === "WebView"));
  assert.deepEqual(result.fallbackFirst, { applies: true, reason: "unsupported-react-native-webview-boundary" });
  assert.equal("signals" in result.domainDetection, false);
  assert.doesNotMatch(JSON.stringify(result), forbiddenSupportClaims);
});

test("CLI inspect-domain exposes top-level TUI source metadata only on JSON TUI evidence paths", () => {
  const fixture = path.join(fixtureRoot, "tui-ink-basic.tsx");
  const cli = spawnSync(process.execPath, [path.join(repoRoot, "dist", "cli", "index.js"), "inspect-domain", fixture, "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(cli.status, 0, cli.stderr);
  const result = JSON.parse(cli.stdout);

  assert.equal(result.schemaVersion, 1);
  assert.equal(result.command, "inspect-domain");
  assert.equal(result.filePath, path.relative(repoRoot, fixture));
  assert.deepEqual(Object.keys(result.domainDetection).sort(), ["classification", "evidence"]);
  assert.equal(result.domainDetection.classification, "tui-ink");
  assert.deepEqual(result.fallbackFirst, { applies: false });
  assert.ok(result.tuiSourceMetadata);
  assert.equal(result.tuiSourceMetadata.schemaVersion, 1);
  assert.equal(result.tuiSourceMetadata.mode, "source-only-dry-run");
  assert.equal(result.tuiSourceMetadata.classification, "tui-ink");
  assert.equal(result.tuiSourceMetadata.claimStatus, "evidence-only");
  assert.equal(result.tuiSourceMetadata.nonEmitting, true);
  assert.equal(result.tuiSourceMetadata.modelFacingPayload, false);
  assert.equal(result.tuiSourceMetadata.runtimeOrPreRead, false);
  assert.equal("integration" in result.tuiSourceMetadata, false);
  assert.ok(result.tuiSourceMetadata.terminalLayoutEvidence.includes("primitive:Box"));
  assert.doesNotMatch(JSON.stringify(result), forbiddenSupportClaims);
});

test("CLI inspect-domain exposes bounded RN sourceAnchorBeta visibility only on JSON RN paths", () => {
  const fixture = path.join(fixtureRoot, "rn-primitive-basic.tsx");
  const cli = spawnSync(process.execPath, [path.join(repoRoot, "dist", "cli", "index.js"), "inspect-domain", fixture, "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(cli.status, 0, cli.stderr);
  const result = JSON.parse(cli.stdout);

  assert.equal(result.schemaVersion, 1);
  assert.equal(result.command, "inspect-domain");
  assert.equal(result.filePath, path.relative(repoRoot, fixture));
  assert.deepEqual(Object.keys(result.domainDetection).sort(), ["classification", "evidence"]);
  assert.equal(result.domainDetection.classification, "react-native");
  assert.deepEqual(result.fallbackFirst, { applies: false });
  assert.ok(result.reactNativeSourceAnchorBeta);
  assert.equal(result.reactNativeSourceAnchorBeta.schemaVersion, 1);
  assert.equal(result.reactNativeSourceAnchorBeta.proofSurface, "inspect-domain");
  assert.equal(result.reactNativeSourceAnchorBeta.contractVersion, "rn-source-anchor-beta.v0");
  assert.equal(result.reactNativeSourceAnchorBeta.scope, "local-proof-only");
  assert.equal(result.reactNativeSourceAnchorBeta.runtimeReusePromotion, "not-promoted");
  assert.equal(result.reactNativeSourceAnchorBeta.sourceDerivedOnly, true);
  assert.deepEqual(result.reactNativeSourceAnchorBeta.allowedProofSurfaces, ["extract", "compare", "inspect-domain"]);
  assert.equal(result.reactNativeSourceAnchorBeta.claimBoundary, "source-backed-rn-located-anchor-visibility-only");
  assert.equal(result.reactNativeSourceAnchorBeta.anchors.componentName, "SearchRow");
  assert.equal(result.reactNativeSourceAnchorBeta.anchors.propsName, "SearchRowProps");
  assert.ok(result.reactNativeSourceAnchorBeta.anchors.locatedAnchors.some((item) => item.kind === "rn-primitive-outline" && item.label === "TextInput"));
  assert.equal("reactNativeSourceAnchorBeta" in result.domainDetection, false);
  assert.doesNotMatch(JSON.stringify(result.reactNativeSourceAnchorBeta), forbiddenSupportClaims);
});

test("CLI inspect-domain keeps TUI metadata out of unflagged and non-TUI paths while allowing RN appendix on JSON RN paths", () => {
  const tuiFixture = path.join(fixtureRoot, "tui-ink-basic.tsx");
  const rnFixture = path.join(fixtureRoot, "rn-primitive-basic.tsx");

  const tuiCli = spawnSync(process.execPath, [path.join(repoRoot, "dist", "cli", "index.js"), "inspect-domain", tuiFixture], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(tuiCli.status, 0, tuiCli.stderr);
  const tuiResult = JSON.parse(tuiCli.stdout);
  assert.equal("tuiSourceMetadata" in tuiResult, false);
  assert.equal("reactNativeSourceAnchorBeta" in tuiResult, false);

  const rnCli = spawnSync(process.execPath, [path.join(repoRoot, "dist", "cli", "index.js"), "inspect-domain", rnFixture, "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(rnCli.status, 0, rnCli.stderr);
  const rnResult = JSON.parse(rnCli.stdout);
  assert.equal("tuiSourceMetadata" in rnResult, false);
  assert.ok(rnResult.reactNativeSourceAnchorBeta);
});

test("CLI inspect-domain keeps mixed TUI evidence top-level while preserving domainDetection shape", () => {
  const fixture = path.join(fixtureRoot, "tui-ink-web-dom-mixed.tsx");
  const cli = spawnSync(process.execPath, [path.join(repoRoot, "dist", "cli", "index.js"), "inspect-domain", fixture, "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(cli.status, 0, cli.stderr);
  const result = JSON.parse(cli.stdout);

  assert.deepEqual(Object.keys(result.domainDetection).sort(), ["classification", "evidence"]);
  assert.equal(result.domainDetection.classification, "mixed");
  assert.ok(result.tuiSourceMetadata);
  assert.equal(result.tuiSourceMetadata.classification, "mixed");
  assert.equal(result.tuiSourceMetadata.claimStatus, "fallback-boundary");
  assert.ok(result.tuiSourceMetadata.terminalMixedBoundaryEvidence.includes("mixed-with:react-web"));
  assert.equal("tuiSourceMetadata" in result.domainDetection, false);
});

test("CLI inspect-domain keeps non-WebView fixture output as evidence-only non-fallback inspection", () => {
  const fixture = path.join(fixtureRoot, "rn-primitive-basic.tsx");
  const cli = spawnSync(process.execPath, [path.join(repoRoot, "dist", "cli", "index.js"), "inspect-domain", fixture], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(cli.status, 0, cli.stderr);
  const result = JSON.parse(cli.stdout);
  assert.equal(result.domainDetection.classification, "react-native");
  assert.deepEqual(result.fallbackFirst, { applies: false });
  assert.ok(result.domainDetection.evidence.some((item) => item.domain === "react-native" && item.signal === "primitive" && item.detail === "View"));
  assert.doesNotMatch(JSON.stringify(result), forbiddenSupportClaims);
});
