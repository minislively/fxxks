import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export type DomainLabel = "react-web" | "react-native" | "webview" | "tui-ink" | "mixed" | "unknown";
export type FrontendDomainClassification = DomainLabel;

export type FrontendDomainEvidence = {
  domain: Exclude<DomainLabel, "mixed" | "unknown">;
  signal: string;
  detail: string;
};

export type DomainDetectionResult = {
  classification: FrontendDomainClassification;
  /** @deprecated Use classification. */
  domain: DomainLabel;
  evidence: FrontendDomainEvidence[];
  /** @deprecated Use evidence. */
  signals: string[];
};

const FRONTEND_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js"]);
const RN_MODULE = "react-native";
const WEBVIEW_MODULE = "react-native-webview";
const INK_MODULE = "ink";
const RN_PRIMITIVES = new Set(["View", "Text", "Image", "ScrollView", "Pressable", "TouchableOpacity"]);
const WEB_DOM_TAGS = new Set(["div", "span", "form", "input", "button", "select", "textarea", "label"]);
const WEBVIEW_PROPS = new Set(["source", "injectedJavaScript", "onMessage"]);
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

function classify(evidence: FrontendDomainEvidence[], hasWebDom: boolean): DomainDetectionResult {
  const domainEvidence = ["react-native", "webview", "tui-ink"] as const;
  const matched = domainEvidence.filter((domain) => hasEvidence(evidence, domain));
  let classification: DomainLabel;
  if (matched.length > 1) {
    classification = "mixed";
  } else if (matched.length === 1) {
    classification = matched[0];
  } else if (hasWebDom) {
    classification = "react-web";
  } else {
    classification = "unknown";
  }

  return {
    classification,
    domain: classification,
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
  let hasWebDom = false;

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
        if (tag === "WebView" && hasImportedName(WEBVIEW_MODULE, tag)) addEvidence(evidence, "webview", "component", tag);
        if (TUI_PRIMITIVES.has(tag) && hasImportedName(INK_MODULE, tag)) addEvidence(evidence, "tui-ink", "primitive", tag);
        if (WEB_DOM_TAGS.has(tag)) hasWebDom = true;
      }
    }

    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && WEBVIEW_PROPS.has(node.name.text) && hasEvidence(evidence, "webview")) {
      addEvidence(evidence, "webview", "prop", node.name.text);
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
    }

    if (ts.isIdentifier(node) && TUI_HOOKS.has(node.text) && hasImportedName(INK_MODULE, node.text)) {
      addEvidence(evidence, "tui-ink", "hook", node.text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return classify(evidence, hasWebDom);
}

export function detectDomain(filePath: string): DomainDetectionResult {
  const sourceText = FRONTEND_EXTENSIONS.has(path.extname(filePath).toLowerCase()) ? fs.readFileSync(filePath, "utf8") : "";
  return detectDomainFromSource(sourceText, filePath);
}
