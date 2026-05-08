import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const reportPath = path.join(process.cwd(), "docs", "react-native-source-only-guidance-report.md");

function readReport() {
  return fs.readFileSync(reportPath, "utf8");
}

test("RN source-only guidance report locks the slot taxonomy boundary", () => {
  const report = readReport();

  assert.match(report, /`F1`, `F13`, `F14`, and `F15` are the only RN slots that may emit narrow payload evidence\./);
  assert.match(report, /`F16`, `F2`, `F9`, and `F10` remain fallback\/readiness lanes with source-only concern or boundary metadata\./);
  assert.match(report, /Located-anchor hardening is already complete; RN `sourceAnchorBeta` should now be treated as closeout\/frozen until a new `extract` \/ `compare` \/ `inspect-domain` visibility plan is explicitly approved\./);
  assert.match(report, /`F1` \/ `F13` \/ `F14` \/ `F15` primitive\/input[\s\S]*`rn-primitive-input-narrow-payload`/);
  assert.match(report, /`F16` adjacent inline-callback boundary[\s\S]*alternate action primitives such as `TouchableOpacity` or `Button`/);
  assert.match(report, /`F2` style\/platform\/navigation[\s\S]*Must not claim route existence, navigation success/);
  assert.match(report, /`F9` interaction\/list[\s\S]*Must not claim gesture correctness, runtime safety, list virtualization success/);
  assert.match(report, /`F10` media\/layout[\s\S]*Must not claim image loading correctness, layout correctness/);
});

test("RN source-only guidance report enumerates current forbidden claims", () => {
  const report = readReport();

  assert.match(report, /Do not claim broad React Native support\./);
  assert.match(report, /Do not claim runtime correctness or mobile UI success\./);
  assert.match(report, /Do not claim that a route exists, navigation succeeds, or stack\/back\/focus behavior is verified\./);
  assert.match(report, /Do not claim that the app was run on a device or simulator\./);
  assert.match(report, /Do not claim that RN primitives are equivalent to DOM controls or React Web form semantics\./);
  assert.match(report, /Do not claim WebView support, TUI support, or React Web equivalence from RN evidence\./);
});

test("RN source-only guidance report includes the reviewer checklist and contract pointers", () => {
  const report = readReport();

  assert.match(report, /1\. `F1` \/ `F13` \/ `F14` \/ `F15` are still the only narrow payload-capable RN slots\./);
  assert.match(report, /2\. `F16` \/ `F2` \/ `F9` \/ `F10` are still described as fallback\/readiness lanes with source-only concern or boundary metadata\./);
  assert.match(report, /frontend-domain-contract/);
  assert.match(report, /frontend-domain-fixture-expectations/);
  assert.match(report, /frontend-fixture-boundary-regression-map/);
  assert.match(report, /domain-payload-architecture/);
});
