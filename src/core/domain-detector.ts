import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export type DomainLabel = "react-web" | "react-native" | "webview" | "tui-ink" | "mixed" | "unknown";
export type FrontendDomainClassification = DomainLabel;
export type FrontendDomainOutcome = "extract" | "fallback" | "deferred" | "unsupported";
export type FrontendDomainProfileClaimStatus = "current-supported-lane" | "evidence-only" | "fallback-boundary" | "deferred";
export type FrontendDomainProfileClaimBoundary =
  | "react-web-measured-extraction"
  | "domain-evidence-only"
  | "source-reading-boundary"
  | "unknown-deferred";

export const FRONTEND_DOMAIN_BOUNDARY_REASON = "unsupported-react-native-webview-boundary";

export type FrontendDomainEvidence = {
  domain: Exclude<DomainLabel, "mixed" | "unknown">;
  signal: string;
  detail: string;
};

export type FrontendDomainProfileMetadata = {
  lane: DomainLabel;
  outcome: FrontendDomainOutcome;
  claimStatus: FrontendDomainProfileClaimStatus;
  fallbackFirst: boolean;
  boundaryReason?: string;
  claimBoundary: FrontendDomainProfileClaimBoundary;
};

export type DomainDetectionResult = {
  classification: FrontendDomainClassification;
  /** @deprecated Use classification. */
  domain: DomainLabel;
  outcome: FrontendDomainOutcome;
  reason?: string;
  profile: FrontendDomainProfileMetadata;
  evidence: FrontendDomainEvidence[];
  /** @deprecated Use evidence. */
  signals: string[];
};

const FRONTEND_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js"]);
const RN_MODULE = "react-native";
const RN_NAVIGATION_MODULE = "@react-navigation/native";
const WEBVIEW_MODULE = "react-native-webview";
const INK_MODULE = "ink";
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

function outcomeForClassification(classification: DomainLabel): Pick<DomainDetectionResult, "outcome" | "reason"> {
  switch (classification) {
    case "react-web":
    case "tui-ink":
      return { outcome: "extract" };
    case "react-native":
    case "webview":
    case "mixed":
      return { outcome: "fallback", reason: FRONTEND_DOMAIN_BOUNDARY_REASON };
    case "unknown":
      return { outcome: "deferred" };
  }
}

function profileForClassification(
  classification: DomainLabel,
  outcome: FrontendDomainOutcome,
  reason?: string,
): FrontendDomainProfileMetadata {
  switch (classification) {
    case "react-web":
      return {
        lane: classification,
        outcome,
        claimStatus: "current-supported-lane",
        fallbackFirst: false,
        claimBoundary: "react-web-measured-extraction",
      };
    case "react-native":
    case "webview":
    case "mixed":
      return {
        lane: classification,
        outcome,
        claimStatus: "fallback-boundary",
        fallbackFirst: true,
        boundaryReason: reason,
        claimBoundary: "source-reading-boundary",
      };
    case "tui-ink":
      return {
        lane: classification,
        outcome,
        claimStatus: "evidence-only",
        fallbackFirst: false,
        claimBoundary: "domain-evidence-only",
      };
    case "unknown":
      return {
        lane: classification,
        outcome,
        claimStatus: "deferred",
        fallbackFirst: false,
        claimBoundary: "unknown-deferred",
      };
  }
}

function classify(evidence: FrontendDomainEvidence[], hasWebDom: boolean): DomainDetectionResult {
  const domainEvidence = ["react-native", "webview", "tui-ink"] as const;
  const matched = domainEvidence.filter((domain) => hasEvidence(evidence, domain));
  let classification: DomainLabel;
  if (matched.length > 1 || (matched.length === 1 && hasWebDom)) {
    classification = "mixed";
  } else if (matched.length === 1) {
    classification = matched[0];
  } else if (hasWebDom) {
    classification = "react-web";
  } else {
    classification = "unknown";
  }

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

    if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      addWebViewBridgeMarkerEvidence(evidence, node.text);
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
