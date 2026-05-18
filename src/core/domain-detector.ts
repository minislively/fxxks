import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { outcomeForClassification, profileForClassification, resolveDomainClassification } from "./domain-profiles/registry";
import type { DomainDetectionResult, FrontendDomainEvidence } from "./domain-profiles/types";

export { FRONTEND_DOMAIN_BOUNDARY_REASON } from "./domain-profiles/types";
export type {
  DomainDetectionResult,
  DomainLabel,
  FrontendDomainClassification,
  FrontendDomainEvidence,
  FrontendDomainOutcome,
  FrontendDomainProfileClaimBoundary,
  FrontendDomainProfileClaimStatus,
  FrontendDomainProfileMetadata,
} from "./domain-profiles/types";

const FRONTEND_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js"]);
const RN_MODULE = "react-native";
const RN_NAVIGATION_MODULE = "@react-navigation/native";
const WEBVIEW_MODULE = "react-native-webview";
const INK_MODULE = "ink";
const REACT_WEB_MODULES = new Set(["react-dom", "react-router-dom", "next", "next/link", "next/navigation"]);
const SHARED_PATH_SEGMENTS = new Set(["shared", "common", "design-system", "tokens", "contracts", "schemas"]);
const WEBVIEW_BRIDGE_MARKERS = [
  ["ReactNativeWebView.postMessage", "ReactNativeWebView.postMessage"],
  ["window.ReactNativeWebView", "window.ReactNativeWebView"],
] as const;
const RN_PRIMITIVES = new Set([
  "View",
  "Text",
  "TextInput",
  "Image",
  "ScrollView",
  "FlatList",
  "Pressable",
  "TouchableOpacity",
  "TouchableHighlight",
  "TouchableNativeFeedback",
  "TouchableWithoutFeedback",
]);
const WEB_DOM_TAGS = new Set(["div", "span", "form", "input", "button", "select", "textarea", "label"]);
const WEB_REACT_ATTRIBUTES = new Set(["className", "htmlFor"]);
const WEBVIEW_PROPS = new Set(["source", "injectedJavaScript", "onMessage"]);
const RN_JSX_PROPS = new Set(["activeOpacity", "onChangeText", "onPress", "pagingEnabled"]);
const RN_STYLE_PROPS = new Set(["resizeMode"]);
const RN_API_CALLS = new Map([
  ["Dimensions", new Set(["get"])],
  ["PanResponder", new Set(["create"])],
]);
const RN_NAVIGATION_HOOKS = new Set(["useNavigation", "useRoute"]);
const TUI_PRIMITIVES = new Set(["Box", "Text"]);
const TUI_HOOKS = new Set(["useInput"]);
const TUI_MODULES = new Set(["ink", "blessed", "readline", "readline/promises", "cli-table3"]);
const TUI_TEXT_MARKERS = ["process.stdin", "process.stdout", "process.stderr", "isTTY", "setRawMode", "readline.emitKeypressEvents", "stdin.on(\"keypress", "stdout.write", "stderr.write"] as const;
const SHARED_TEXT_MARKERS = ["design token", "designTokens", "createTheme", "api contract", "ApiContract", "shared state", "createStore"] as const;

function getScriptKind(filePath: string): ts.ScriptKind {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".tsx") return ts.ScriptKind.TSX;
  if (ext === ".jsx") return ts.ScriptKind.JSX;
  if (ext === ".js") return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function addEvidence(
  evidence: FrontendDomainEvidence[],
  domain: FrontendDomainEvidence["domain"],
  signal: string,
  detail: string,
): void {
  if (evidence.some((item) => item.domain === domain && item.signal === signal && item.detail === detail)) return;
  evidence.push({ domain, signal, detail });
}

function hasEvidence(evidence: FrontendDomainEvidence[], domain: FrontendDomainEvidence["domain"]): boolean {
  return evidence.some((item) => item.domain === domain);
}

function signalList(evidence: FrontendDomainEvidence[]): string[] {
  return evidence.map((item) => `${item.domain}:${item.signal}:${item.detail}`);
}

function addWebViewSourceShapeEvidence(evidence: FrontendDomainEvidence[], initializer: ts.JsxAttribute["initializer"]): void {
  if (!initializer || !ts.isJsxExpression(initializer) || !initializer.expression) return;

  const expression = initializer.expression;
  if (!ts.isObjectLiteralExpression(expression)) return;

  for (const property of expression.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = property.name;
    const propertyName = ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;
    if (propertyName === "html" || propertyName === "uri") {
      addEvidence(evidence, "webview", "source-shape", propertyName);
    }
  }
}

function addWebViewBridgeMarkerEvidence(evidence: FrontendDomainEvidence[], text: string): void {
  if (!hasEvidence(evidence, "webview")) return;

  for (const [marker, detail] of WEBVIEW_BRIDGE_MARKERS) {
    if (text.includes(marker)) {
      addEvidence(evidence, "webview", "bridge-marker", detail);
    }
  }
}

function classify(evidence: FrontendDomainEvidence[], hasWebDom: boolean): DomainDetectionResult {
  const classification = resolveDomainClassification(evidence, hasWebDom);
  const outcome = outcomeForClassification(classification);
  return {
    classification,
    domain: classification,
    ...outcome,
    profile: profileForClassification(classification, outcome.outcome, outcome.reason),
    evidence,
    signals: signalList(evidence),
  };
}

export function detectDomainFromSource(sourceText: string, filePath = "source.tsx"): DomainDetectionResult {
  if (!FRONTEND_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    return classify([], false);
  }

  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, getScriptKind(filePath));
  const importedNamesByModule = new Map<string, Set<string>>();
  const evidence: FrontendDomainEvidence[] = [];
  let hasReactWebEvidence = false;

  const normalizedPathSegments = filePath.toLowerCase().split(/[\\/_.-]+/u).filter(Boolean);
  if (normalizedPathSegments.some((segment) => SHARED_PATH_SEGMENTS.has(segment))) {
    addEvidence(evidence, "shared", "path-segment", normalizedPathSegments.find((segment) => SHARED_PATH_SEGMENTS.has(segment)) ?? "shared");
  }
  if (/\b(?:ios|android)\b/iu.test(filePath)) {
    addEvidence(evidence, "react-native", "platform-path", /\bios\b/iu.test(filePath) ? "ios" : "android");
  }
  if (/metro\.config\.[cm]?[jt]s$/iu.test(filePath)) {
    addEvidence(evidence, "react-native", "metro-config", path.basename(filePath));
  }

  function rememberImportedName(moduleName: string, name: string): void {
    const names = importedNamesByModule.get(moduleName) ?? new Set<string>();
    names.add(name);
    importedNamesByModule.set(moduleName, names);
  }

  function hasImportedName(moduleName: string, name: string): boolean {
    return importedNamesByModule.get(moduleName)?.has(name) === true;
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const moduleName = node.moduleSpecifier.text;
      if (moduleName === RN_MODULE || moduleName.startsWith(`${RN_MODULE}/`)) {
        addEvidence(evidence, "react-native", "import", moduleName);
      }
      if (moduleName === RN_NAVIGATION_MODULE) {
        addEvidence(evidence, "react-native", "navigation-import", moduleName);
      }
      if (moduleName === WEBVIEW_MODULE) {
        addEvidence(evidence, "webview", "import", moduleName);
      }
      if (moduleName === INK_MODULE) {
        addEvidence(evidence, "tui-ink", "import", moduleName);
      }
      // React Web framework imports are remembered below, but imports alone are concern evidence;
      // they become domain evidence only when paired with DOM JSX, browser globals, or JSX component use.
      if (TUI_MODULES.has(moduleName)) {
        addEvidence(evidence, "tui-ink", "terminal-import", moduleName);
      }
      if (/\b(?:tokens|design-system|shared|contracts)\b/iu.test(moduleName)) {
        addEvidence(evidence, "shared", "shared-import", moduleName);
      }

      const importClause = node.importClause;
      if (importClause?.name) rememberImportedName(moduleName, importClause.name.text);
      if (importClause?.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
        for (const element of importClause.namedBindings.elements) {
          rememberImportedName(moduleName, element.name.text);
        }
      }
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "require") {
      const [specifier] = node.arguments;
      if (specifier && ts.isStringLiteral(specifier)) {
        const moduleName = specifier.text;
        if (moduleName === RN_MODULE || moduleName.startsWith(`${RN_MODULE}/`)) addEvidence(evidence, "react-native", "require", moduleName);
        if (moduleName === WEBVIEW_MODULE) addEvidence(evidence, "webview", "require", moduleName);
        if (moduleName === INK_MODULE) addEvidence(evidence, "tui-ink", "require", moduleName);
        if (TUI_MODULES.has(moduleName)) addEvidence(evidence, "tui-ink", "terminal-require", moduleName);
      }
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName;
      const tag = ts.isIdentifier(tagName) ? tagName.text : ts.isPropertyAccessExpression(tagName) ? tagName.name.text : undefined;
      if (tag) {
        if (RN_PRIMITIVES.has(tag) && hasImportedName(RN_MODULE, tag)) addEvidence(evidence, "react-native", "primitive", tag);
        if (tag === "WebView") addEvidence(evidence, "webview", "component", tag);
        if (TUI_PRIMITIVES.has(tag) && hasImportedName(INK_MODULE, tag)) addEvidence(evidence, "tui-ink", "primitive", tag);
        if (WEB_DOM_TAGS.has(tag)) {
          hasReactWebEvidence = true;
          addEvidence(evidence, "react-web", "dom-tag", tag);
        }
        for (const moduleName of REACT_WEB_MODULES) {
          if (hasImportedName(moduleName, tag)) {
            hasReactWebEvidence = true;
            addEvidence(evidence, "react-web", "framework-component", `${moduleName}:${tag}`);
          }
        }
      }
    }

    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
      const attributeName = node.name.text;
      if (WEB_REACT_ATTRIBUTES.has(attributeName)) {
        hasReactWebEvidence = true;
        addEvidence(evidence, "react-web", "jsx-attribute", attributeName);
      }
      if (RN_JSX_PROPS.has(attributeName) && hasEvidence(evidence, "react-native")) {
        addEvidence(evidence, "react-native", "jsx-prop", attributeName);
      }
      if (WEBVIEW_PROPS.has(attributeName) && hasEvidence(evidence, "webview")) {
        addEvidence(evidence, "webview", "prop", attributeName);
        if (attributeName === "source") {
          addWebViewSourceShapeEvidence(evidence, node.initializer);
        }
      }
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const expression = node.expression.expression;
      const property = node.expression.name.text;
      if (ts.isIdentifier(expression) && expression.text === "StyleSheet" && property === "create") {
        addEvidence(evidence, "react-native", "style-factory", "StyleSheet.create");
      }
      if (ts.isIdentifier(expression) && expression.text === "Platform" && property === "select") {
        addEvidence(evidence, "react-native", "platform-select", "Platform.select");
      }
      if (
        ts.isIdentifier(expression) &&
        RN_API_CALLS.get(expression.text)?.has(property) === true &&
        hasImportedName(RN_MODULE, expression.text)
      ) {
        addEvidence(evidence, "react-native", "api-call", `${expression.text}.${property}`);
      }
      if (hasEvidence(evidence, "webview") && property === "postMessage") {
        addEvidence(evidence, "webview", "bridge-call", "postMessage");
      }
      if (ts.isIdentifier(expression) && expression.text === "Linking" && property === "openURL" && hasEvidence(evidence, "webview")) {
        addEvidence(evidence, "webview", "deeplink-call", "Linking.openURL");
      }
      if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression) && expression.expression.text === "process") {
        const stream = expression.name.text;
        if ((stream === "stdout" || stream === "stderr" || stream === "stdin") && (property === "write" || property === "on")) {
          addEvidence(evidence, "tui-ink", "terminal-api", `process.${stream}.${property}`);
        }
      }
    }

    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "process") {
      const property = node.name.text;
      if (property === "stdout" || property === "stderr" || property === "stdin") {
        addEvidence(evidence, "tui-ink", "terminal-stream", `process.${property}`);
      }
    }

    if (ts.isPropertyAccessExpression(node) && node.name.text === "isTTY") {
      addEvidence(evidence, "tui-ink", "terminal-tty", "isTTY");
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const callName = node.expression.text;
      if (RN_NAVIGATION_HOOKS.has(callName) && hasImportedName(RN_NAVIGATION_MODULE, callName)) {
        addEvidence(evidence, "react-native", "navigation-hook", callName);
      }
    }

    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "route" &&
      node.name.text === "params" &&
      hasEvidence(evidence, "react-native")
    ) {
      addEvidence(evidence, "react-native", "navigation-route", "route.params");
    }

    if (ts.isPropertyAssignment(node) && hasEvidence(evidence, "react-native")) {
      const name = node.name;
      const propertyName = ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;
      if (propertyName && RN_STYLE_PROPS.has(propertyName)) {
        addEvidence(evidence, "react-native", "style-prop", propertyName);
      }
    }

    if (ts.isIdentifier(node) && TUI_HOOKS.has(node.text) && hasImportedName(INK_MODULE, node.text)) {
      addEvidence(evidence, "tui-ink", "hook", node.text);
    }

    if (ts.isIdentifier(node) && (node.text === "window" || node.text === "document" || node.text === "localStorage")) {
      hasReactWebEvidence = true;
      addEvidence(evidence, "react-web", "browser-global", node.text);
    }

    if (ts.isIdentifier(node) && /^(?:tokens|designTokens|theme|contract|sharedState|ApiContract)$/u.test(node.text)) {
      addEvidence(evidence, "shared", "shared-identifier", node.text);
    }

    if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      addWebViewBridgeMarkerEvidence(evidence, node.text);
      for (const marker of TUI_TEXT_MARKERS) {
        if (node.text.includes(marker)) addEvidence(evidence, "tui-ink", "terminal-marker", marker);
      }
      if (hasEvidence(evidence, "webview") && /(?:deeplink|deep link|session handoff|app container|[a-z][a-z0-9+.-]*:\/\/)/iu.test(node.text)) {
        addEvidence(evidence, "webview", "handoff-marker", node.text.includes("://") ? "uri-scheme" : "handoff-text");
      }
      for (const marker of SHARED_TEXT_MARKERS) {
        if (node.text.includes(marker)) addEvidence(evidence, "shared", "shared-marker", marker);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return classify(evidence, hasReactWebEvidence);
}

export function detectDomain(filePath: string): DomainDetectionResult {
  const sourceText = FRONTEND_EXTENSIONS.has(path.extname(filePath).toLowerCase()) ? fs.readFileSync(filePath, "utf8") : "";
  return detectDomainFromSource(sourceText, filePath);
}
