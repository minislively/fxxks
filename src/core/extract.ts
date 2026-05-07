import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { hashText } from "./hash";
import { decideMode } from "./decide";
import { detectDomainFromSource } from "./domain-detector";
import type {
  A11yAnchorSignal,
  ExtractionResult,
  FormSurface,
  ImportSignal,
  Language,
  ReactNativeAccessibilityTestAnchorSignal,
  ReactNativeListRenderingConcernSignal,
  ReactNativeMediaLayoutConcernSignal,
  ReactNativeNavigationConcernSignal,
  ReactNativePrimitiveActionBindingSignal,
  ReactNativePrimitiveConstraintActionReadinessSignal,
  ReactNativePrimitiveInputBindingSignal,
  ReactNativePrimitiveInputConstraintSignal,
  ReactNativePrimitiveStateActionRelationSignal,
  ReactNativeStateActionConcernSignal,
  ReactNativeStylePlatformConcernSignal,
  ReactNativeRelationExpressionKind,
  ReactNativeRelationSource,
  SourceRange,
  StyleSystem,
  StyleVariantSignal,
} from "./schema";

const HOOK_NAMES = new Set(["useState", "useEffect", "useMemo", "useCallback", "useRef", "useReducer", "useLayoutEffect", "useContext", "useId", "useTransition"]);
const EFFECT_HOOK_NAMES = new Set(["useEffect", "useLayoutEffect"]);
const CALLBACK_HOOK_NAMES = new Set(["useMemo", "useCallback"]);
const FORM_CONTROL_TAGS = new Set(["form", "input", "select", "textarea"]);
const CONTROL_PROP_NAMES = new Set(["id", "name", "type", "value", "defaultValue", "required", "disabled", "readOnly", "checked", "defaultChecked"]);
const MAX_EFFECT_SIGNALS = 8;
const MAX_CALLBACK_SIGNALS = 8;
const MAX_EVENT_HANDLER_SIGNALS = 12;
const MAX_FORM_CONTROLS = 16;
const MAX_FORM_ANCHORS = 8;
const MAX_DEPENDENCIES = 8;
const MAX_CONTROL_PROPS = 8;
const MAX_TEXT_LENGTH = 48;
const STYLE_VARIANT_PROP_NAMES = new Set(["variant", "size", "tone", "intent", "disabled", "selected", "loading", "compact"]);
const MAX_STYLE_VARIANT_SIGNALS = 16;
const MAX_RN_PRIMITIVE_BINDINGS = 8;
const RN_ACTION_PRIMITIVE_TAGS = new Set<ReactNativePrimitiveActionBindingSignal["primitive"]>(["Pressable", "Button", "TouchableOpacity"]);
const RN_NAVIGATION_MODULE = "@react-navigation/native";
const RN_NAVIGATION_HOOK_NAMES = new Set<Extract<ReactNativeNavigationConcernSignal, { kind: "navigation-hook" }>["hook"]>(["useNavigation", "useRoute"]);

function getLanguage(filePath: string): Language {
  const ext = path.extname(filePath);
  if (ext === ".tsx") return "tsx";
  if (ext === ".jsx") return "jsx";
  if (ext === ".js") return "js";
  return "ts";
}

function getScriptKind(language: Language): ts.ScriptKind {
  if (language === "tsx") return ts.ScriptKind.TSX;
  if (language === "jsx") return ts.ScriptKind.JSX;
  if (language === "js") return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function textOf(sourceFile: ts.SourceFile, node: ts.Node): string {
  return sourceFile.text.slice(node.getStart(sourceFile), node.getEnd());
}

function sourceRangeOf(sourceFile: ts.SourceFile, node: ts.Node): SourceRange {
  const startPosition = node.getStart(sourceFile);
  const endPosition = Math.max(startPosition, node.getEnd() - 1);
  const start = sourceFile.getLineAndCharacterOfPosition(startPosition);
  const end = sourceFile.getLineAndCharacterOfPosition(endPosition);
  return {
    startLine: start.line + 1,
    endLine: Math.max(start.line + 1, end.line + 1),
  };
}

function compactText(value: string, maxLength = MAX_TEXT_LENGTH): string {
  const compacted = value.replace(/\s+/g, " ").trim();
  return compacted.length > maxLength ? compacted.slice(0, maxLength) : compacted;
}

function stylePropertyValue(styleExpr: string | undefined, propertyName: string): string | undefined {
  if (!styleExpr) return undefined;
  const escaped = propertyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styleExpr.match(new RegExp(`${escaped}\\s*:\\s*([^,}]+)`));
  return match?.[1]?.trim();
}
function callShortName(node: ts.CallExpression): string {
  const callName = node.expression.getText();
  return callName.split(".").pop() ?? callName;
}

function dependencyTexts(node: ts.CallExpression): string[] | undefined {
  const deps = node.arguments[1];
  if (!deps || !ts.isArrayLiteralExpression(deps) || deps.elements.length === 0) return undefined;
  return deps.elements.map((element) => compactText(element.getText(), 60)).filter(Boolean).slice(0, MAX_DEPENDENCIES);
}

function firstCallbackArgument(node: ts.CallExpression): ts.ArrowFunction | ts.FunctionExpression | undefined {
  const callback = node.arguments[0];
  if (!callback || (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))) return undefined;
  return callback;
}

function containsReturnStatement(node: ts.Node): boolean {
  if (ts.isBlock(node)) {
    return node.statements.some((statement) => ts.isReturnStatement(statement) && Boolean(statement.expression));
  }

  let found = false;
  const visit = (child: ts.Node): void => {
    if (found) return;
    if (ts.isFunctionLike(child) && child !== node) return;
    if (ts.isReturnStatement(child)) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

function containsAsyncWork(node: ts.Node): boolean {
  let found = false;
  const visit = (child: ts.Node): void => {
    if (found) return;
    if (ts.isAwaitExpression(child)) {
      found = true;
      return;
    }
    if (ts.isCallExpression(child) && ts.isPropertyAccessExpression(child.expression)) {
      const property = child.expression.name.text;
      if (property === "then" || property === "catch" || property === "finally") {
        found = true;
        return;
      }
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

function collectBindingNames(name: ts.BindingName, names: Set<string>): void {
  if (ts.isIdentifier(name)) {
    names.add(name.text);
    return;
  }
  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) continue;
    collectBindingNames(element.name, names);
  }
}

function dedupeBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function collectExports(sourceFile: ts.SourceFile): ExtractionResult["exports"] {
  const exports: ExtractionResult["exports"] = [];

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      const modifiers = ts.getModifiers(statement) ?? [];
      const hasExport = modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      const hasDefault = modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
      if (hasExport && statement.name) {
        exports.push({
          name: statement.name.text,
          kind: hasDefault ? "default" : "named",
          type: ts.isFunctionDeclaration(statement) ? "function" : "class",
        });
      }
    }

    if (ts.isVariableStatement(statement)) {
      const modifiers = ts.getModifiers(statement) ?? [];
      const hasExport = modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      const hasDefault = modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
      if (hasExport) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) {
            exports.push({
              name: declaration.name.text,
              kind: hasDefault ? "default" : "named",
              type: "variable",
            });
          }
        }
      }
    }

    if (ts.isExportAssignment(statement)) {
      const expr = statement.expression;
      const name = ts.isIdentifier(expr) ? expr.text : "default";
      exports.push({ name, kind: "default", type: expr.kind === ts.SyntaxKind.ArrowFunction ? "function" : undefined });
    }
  }

  return exports;
}

function isPascal(name: string | undefined): boolean {
  return Boolean(name && /^[A-Z]/.test(name));
}

function getComponentName(exports: ExtractionResult["exports"]): string | undefined {
  const defaultExport = exports.find((item) => item.kind === "default" && isPascal(item.name));
  if (defaultExport) return defaultExport.name;
  return exports.find((item) => isPascal(item.name))?.name;
}

function collectImports(sourceFile: ts.SourceFile): ImportSignal[] {
  const imports: ImportSignal[] = [];

  const addImport = (moduleSpecifier: string, importedSymbols: string[], node: ts.Node): void => {
    const compacted = compactText(moduleSpecifier, 80);
    if (!compacted) return;
    imports.push({
      moduleSpecifier: compacted,
      ...(importedSymbols.length ? { importedSymbols: [...new Set(importedSymbols)].slice(0, 12) } : {}),
      loc: sourceRangeOf(sourceFile, node),
    });
  };

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const symbols: string[] = [];
    const clause = statement.importClause;
    if (clause?.name) symbols.push(clause.name.text);
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        symbols.push(element.name.text);
      }
    }
    if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      symbols.push(clause.namedBindings.name.text);
    }
    addImport(statement.moduleSpecifier.text, symbols, statement);
  }

  return dedupeBy(imports, (item) => `${item.moduleSpecifier}:${item.importedSymbols?.join(",") ?? ""}:${item.loc?.startLine ?? ""}`).slice(0, 24);
}

function collectModuleDeclarations(sourceFile: ts.SourceFile): NonNullable<NonNullable<ExtractionResult["structure"]>["moduleDeclarations"]> {
  const declarations: NonNullable<NonNullable<ExtractionResult["structure"]>["moduleDeclarations"]> = [];

  const addDeclaration = (
    kind: NonNullable<NonNullable<ExtractionResult["structure"]>["moduleDeclarations"]>[number]["kind"],
    value: string | undefined,
    node: ts.Node,
    exported = false,
  ): void => {
    if (!value) return;
    const compacted = compactText(value);
    if (!compacted) return;
    declarations.push({
      kind,
      value: compacted,
      ...(exported ? { exported: true } : {}),
      loc: sourceRangeOf(sourceFile, node),
    });
  };

  const isExported = (node: ts.Node): boolean =>
    ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      addDeclaration("function", statement.name.text, statement, isExported(statement));
      continue;
    }
    if (ts.isClassDeclaration(statement) && statement.name) {
      addDeclaration("class", statement.name.text, statement, isExported(statement));
      continue;
    }
    if (ts.isInterfaceDeclaration(statement)) {
      addDeclaration("interface", statement.name.text, statement, isExported(statement));
      continue;
    }
    if (ts.isTypeAliasDeclaration(statement)) {
      addDeclaration("type", statement.name.text, statement, isExported(statement));
      continue;
    }
    if (ts.isEnumDeclaration(statement)) {
      addDeclaration("enum", statement.name.text, statement, isExported(statement));
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      const exported = isExported(statement);
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          addDeclaration("variable", declaration.name.text, declaration, exported);
        }
      }
    }
  }

  return dedupeBy(declarations, (item) => `${item.kind}:${item.value}:${item.loc?.startLine ?? ""}`).slice(0, 12);
}

function findDeclarationByName(sourceFile: ts.SourceFile, name: string): ts.Node | undefined {
  for (const statement of sourceFile.statements) {
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) && statement.name?.text === name) {
      return statement;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
          return declaration;
        }
      }
    }
  }
  return undefined;
}

function getPropsInfo(sourceFile: ts.SourceFile, componentName?: string): ExtractionResult["contract"] {
  if (!componentName) return undefined;
  const declaration = findDeclarationByName(sourceFile, componentName);
  let propsName: string | undefined;
  let propsLoc: SourceRange | undefined;
  const propsSummary: string[] = [];

  const collectBindingSummary = (name: ts.BindingName): void => {
    if (!ts.isObjectBindingPattern(name)) return;
    for (const element of name.elements) {
      if (ts.isIdentifier(element.name)) {
        propsSummary.push(`${element.name.text}${element.initializer ? "?" : ""}: unknown`);
      }
    }
  };

  if (declaration && ts.isFunctionDeclaration(declaration)) {
    const firstParam = declaration.parameters[0];
    let hasTypedPropsReference = false;
    if (firstParam?.type && ts.isTypeReferenceNode(firstParam.type) && ts.isIdentifier(firstParam.type.typeName)) {
      propsName = firstParam.type.typeName.text;
      propsLoc = sourceRangeOf(sourceFile, firstParam);
      hasTypedPropsReference = true;
    }
    if (firstParam && ts.isObjectBindingPattern(firstParam.name)) {
      if (!propsName) {
        propsName = "props";
        propsLoc = sourceRangeOf(sourceFile, firstParam);
      }
      if (!hasTypedPropsReference) collectBindingSummary(firstParam.name);
    }
  }

  if (declaration && ts.isVariableDeclaration(declaration)) {
    const initializer = declaration.initializer;
    if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
      const firstParam = initializer.parameters[0];
      let hasTypedPropsReference = false;
      if (firstParam?.type && ts.isTypeReferenceNode(firstParam.type) && ts.isIdentifier(firstParam.type.typeName)) {
        propsName = firstParam.type.typeName.text;
        propsLoc = sourceRangeOf(sourceFile, firstParam);
        hasTypedPropsReference = true;
      }
      if (firstParam && ts.isObjectBindingPattern(firstParam.name)) {
        if (!propsName) {
          propsName = "props";
          propsLoc = sourceRangeOf(sourceFile, firstParam);
        }
        if (!hasTypedPropsReference) collectBindingSummary(firstParam.name);
      }
    }
  }

  if (propsName) {
    const propsDecl = findDeclarationByName(sourceFile, propsName);
    if (propsDecl && ts.isInterfaceDeclaration(propsDecl)) {
      propsLoc = sourceRangeOf(sourceFile, propsDecl);
      for (const member of propsDecl.members) {
        if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
          propsSummary.push(`${member.name.text}${member.questionToken ? "?" : ""}: ${member.type ? member.type.getText(sourceFile) : "unknown"}`);
        }
      }
    }
    if (propsDecl && ts.isTypeAliasDeclaration(propsDecl) && ts.isTypeLiteralNode(propsDecl.type)) {
      propsLoc = sourceRangeOf(sourceFile, propsDecl);
      for (const member of propsDecl.type.members) {
        if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
          propsSummary.push(`${member.name.text}${member.questionToken ? "?" : ""}: ${member.type ? member.type.getText(sourceFile) : "unknown"}`);
        }
      }
    }
  }

  const sourceText = sourceFile.text;
  const hasForwardRef = /(?:React\.)?forwardRef\s*\(/.test(sourceText);
  return { propsName, propsSummary, hasForwardRef, propsLoc };
}

function detectStyleSystem(sourceFile: ts.SourceFile): ExtractionResult["style"] {
  const imports = sourceFile.statements.filter(ts.isImportDeclaration).map((item) => item.moduleSpecifier.getText(sourceFile));
  let system: StyleSystem = "unknown";
  const summary: string[] = [];
  const sourceText = sourceFile.text;
  const variantSignals: StyleVariantSignal[] = [];

  if (imports.some((spec) => spec.includes(".module.css") || spec.includes(".module.scss"))) {
    system = "css-modules";
    summary.push("css-module-imports");
  }
  if (/styled\.[A-Za-z]+`/.test(sourceText) || /styled\([^)]*\)`/.test(sourceText)) {
    system = "styled-components";
    summary.push("styled-components-tagged-template");
  }
  if (/class(Name)?=/.test(sourceText)) {
    const classNameMatches = [...sourceText.matchAll(/className\s*=\s*["'`]([^"'`]+)["'`]/g)].map((match) => match[1]);
    if (classNameMatches.some((value) => /\b(?:px-|py-|mx-|my-|flex|grid|text-|bg-|rounded|gap-|items-|justify-)/.test(value))) {
      system = "tailwind";
      summary.push("tailwind-like-utility-classes");
    }
  }
  if (/style\s*=\s*\{/.test(sourceText)) {
    if (system === "unknown") system = "inline-style";
    summary.push("inline-style-prop");
  }
  const hasStyleBranching = /className\s*=\s*\{/.test(sourceText) || /style\s*=\s*\{/.test(sourceText);

  const jsxAttributeValue = (attribute: ts.JsxAttribute): string | undefined => {
    if (!attribute.initializer) return "true";
    if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
    if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
      return compactText(attribute.initializer.expression.getText(sourceFile), 80);
    }
    return compactText(attribute.initializer.getText(sourceFile), 80);
  };

  const addStyleSignal = (signal: StyleVariantSignal): void => {
    if (!signal.label) return;
    variantSignals.push(signal);
  };

  function visit(node: ts.Node): void {
    if (ts.isJsxAttribute(node)) {
      const propName = node.name.getText(sourceFile);
      const value = jsxAttributeValue(node);
      if (propName === "className" && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        addStyleSignal({
          kind: "className-branch",
          label: compactText(node.initializer.expression.getText(sourceFile), 80),
          propName,
          ...(value ? { value } : {}),
          loc: sourceRangeOf(sourceFile, node),
        });
      }
      if (propName === "style") {
        addStyleSignal({
          kind: "inline-style",
          label: value ? compactText(value, 80) : "style",
          propName,
          ...(value ? { value } : {}),
          loc: sourceRangeOf(sourceFile, node),
        });
      }
      if (propName === "data-state") {
        addStyleSignal({
          kind: "data-state",
          label: value ? `data-state=${compactText(value, 60)}` : "data-state",
          propName,
          ...(value ? { value } : {}),
          loc: sourceRangeOf(sourceFile, node),
        });
      }
      if (STYLE_VARIANT_PROP_NAMES.has(propName)) {
        addStyleSignal({
          kind: "variant-prop",
          label: value ? `${propName}=${compactText(value, 60)}` : propName,
          propName,
          ...(value ? { value } : {}),
          loc: sourceRangeOf(sourceFile, node),
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  const dedupedSignals = dedupeBy(
    variantSignals,
    (item) => `${item.kind}:${item.propName ?? ""}:${item.label}:${item.loc?.startLine ?? ""}`,
  ).slice(0, MAX_STYLE_VARIANT_SIGNALS);

  return {
    system,
    summary,
    hasStyleBranching,
    ...(dedupedSignals.length ? { variantSignals: dedupedSignals } : {}),
  };
}

function collectSectionsFromJsx(sourceFile: ts.SourceFile): { sections: string[]; jsxDepth: number } {
  const sections = new Set<string>();
  let maxDepth = 0;

  function visit(node: ts.Node, depth: number): void {
    if (ts.isJsxElement(node)) {
      sections.add(node.openingElement.tagName.getText(sourceFile));
      maxDepth = Math.max(maxDepth, depth + 1);
      node.children.forEach((child) => visit(child, depth + 1));
    } else if (ts.isJsxSelfClosingElement(node)) {
      sections.add(node.tagName.getText(sourceFile));
      maxDepth = Math.max(maxDepth, depth + 1);
    }
    ts.forEachChild(node, (child) => visit(child, depth));
  }

  visit(sourceFile, 0);
  return { sections: [...sections].slice(0, 12), jsxDepth: maxDepth };
}

function collectBehaviorAndStructure(sourceFile: ts.SourceFile): Pick<ExtractionResult, "behavior" | "structure" | "snippets"> {
  const hooks = new Set<string>();
  const stateSummary = new Set<string>();
  const effects = new Set<string>();
  const eventHandlers = new Set<string>();
  const effectSignals: NonNullable<NonNullable<ExtractionResult["behavior"]>["effectSignals"]> = [];
  const callbackSignals: NonNullable<NonNullable<ExtractionResult["behavior"]>["callbackSignals"]> = [];
  const eventHandlerSignals: NonNullable<NonNullable<ExtractionResult["behavior"]>["eventHandlerSignals"]> = [];
  const formControls: NonNullable<FormSurface["controls"]> = [];
  const rnInputBindings: ReactNativePrimitiveInputBindingSignal[] = [];
  const rnActionBindings: ReactNativePrimitiveActionBindingSignal[] = [];
  const rnActionIdentifierReads = new Map<string, Set<string>>();
  const rnAccessibilityTestAnchors: ReactNativeAccessibilityTestAnchorSignal[] = [];
  const rnListRenderingConcerns: ReactNativeListRenderingConcernSignal[] = [];
  const rnMediaLayoutConcerns: ReactNativeMediaLayoutConcernSignal[] = [];
  const rnStateActionConcerns: ReactNativeStateActionConcernSignal[] = [];
  const rnStylePlatformConcerns: ReactNativeStylePlatformConcernSignal[] = [];
  const rnNavigationConcerns: ReactNativeNavigationConcernSignal[] = [];
  const importedNames = new Set<string>();
  const reactNativeImportedNames = new Set<string>();
  const reactNavigationImportedNames = new Set<string>();
  const localDeclaredNames = new Set<string>();
  const localFunctionBodies = new Map<string, ts.FunctionLikeDeclaration>();
  const localStateMutators = new Map<string, { hook: "useState" | "useReducer"; stateBinding: string; mutatorKind: "setter" | "dispatch" }>();
  const submitHandlers: NonNullable<FormSurface["submitHandlers"]> = [];
  const validationAnchors: NonNullable<FormSurface["validationAnchors"]> = [];
  const stateConditions: NonNullable<FormSurface["stateConditions"]> = [];
  const a11yAnchors: A11yAnchorSignal[] = [];
  const a11ySourceIds: NonNullable<NonNullable<ExtractionResult["behavior"]>["a11ySourceIds"]> = [];
  const conditionalRenders = new Set<string>();
  const repeatedBlocks = new Set<string>();
  const snippetCandidates: NonNullable<ExtractionResult["snippets"]> = [];
  let hasSideEffects = false;

  const addSnippet = (label: string, code: string, reason: string, locNode?: ts.Node): void => {
    const cleaned = code.split("\n").slice(0, 12).join("\n").trim();
    if (!cleaned) return;
    if (snippetCandidates.some((item) => item.code === cleaned)) return;
    snippetCandidates.push({ label, code: cleaned, reason, ...(locNode ? { loc: sourceRangeOf(sourceFile, locNode) } : {}) });
  };

  const addEventHandlerSignal = (name: string, node: ts.Node, trigger?: string): void => {
    if (!name) return;
    eventHandlers.add(trigger ?? name);
    eventHandlerSignals.push({
      name: compactText(name),
      ...(trigger ? { trigger } : {}),
      loc: sourceRangeOf(sourceFile, node),
    });
  };

  const addLocatedAnchor = (items: NonNullable<FormSurface["submitHandlers"]> | NonNullable<FormSurface["validationAnchors"]>, value: string, node: ts.Node): void => {
    const compacted = compactText(value);
    if (!compacted) return;
    items.push({ value: compacted, loc: sourceRangeOf(sourceFile, node) });
  };

  const addA11yAnchor = (
    kind: A11yAnchorSignal["kind"],
    label: string,
    node: ts.Node,
    metadata: Pick<A11yAnchorSignal, "sourceId" | "references"> = {},
  ): void => {
    const compacted = compactText(label);
    if (!compacted) return;
    a11yAnchors.push({
      kind,
      label: compacted,
      loc: sourceRangeOf(sourceFile, node),
      ...(metadata.sourceId ? { sourceId: metadata.sourceId } : {}),
      ...(metadata.references && metadata.references.length > 0 ? { references: metadata.references } : {}),
    });
  };

  const idRefTokens = (value: string | undefined): string[] => {
    if (!value || value === "true") return [];
    return value
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);
  };

  const jsxAttributeValue = (attribute: ts.JsxAttribute): string | undefined => {
    if (!attribute.initializer) return "true";
    if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
    if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
      return compactText(attribute.initializer.expression.getText(sourceFile));
    }
    return compactText(attribute.initializer.getText(sourceFile));
  };

  const jsxAttributeExpression = (attribute: ts.JsxAttribute): ts.Expression | undefined => {
    if (!attribute.initializer || !ts.isJsxExpression(attribute.initializer)) return undefined;
    return attribute.initializer.expression ?? undefined;
  };

  const nearestFunctionLike = (node: ts.Node): ts.SignatureDeclaration | undefined => {
    let current: ts.Node | undefined = node;
    while (current) {
      if (ts.isFunctionLike(current)) return current;
      current = current.parent;
    }
    return undefined;
  };

  const expressionKindOf = (
    expression: ts.Expression | undefined,
  ): ReactNativeRelationExpressionKind | undefined => {
    if (!expression) return undefined;
    if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) return "inline-callback";
    if (ts.isIdentifier(expression)) return "identifier";
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) return "member-reference";
    if (ts.isCallExpression(expression)) return "call-expression";
    return "other-expression";
  };

  const rootIdentifierOf = (expression: ts.Expression | undefined): string | undefined => {
    if (!expression) return undefined;
    if (ts.isIdentifier(expression)) return expression.text;
    if (ts.isPropertyAccessExpression(expression)) return rootIdentifierOf(expression.expression);
    if (ts.isElementAccessExpression(expression)) return rootIdentifierOf(expression.expression);
    if (ts.isCallExpression(expression)) return rootIdentifierOf(expression.expression);
    return undefined;
  };

  const relationSourceOf = (
    node: ts.Node,
    expression: ts.Expression | undefined,
  ): ReactNativeRelationSource | undefined => {
    if (!expression) return undefined;
    if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) return "same-file-inline";

    const rootIdentifier = rootIdentifierOf(expression);
    if (!rootIdentifier) return "unknown";
    if (importedNames.has(rootIdentifier)) return "imported";

    const parameterNames = new Set<string>();
    const containingFunction = nearestFunctionLike(node);
    if (containingFunction) {
      for (const parameter of containingFunction.parameters) {
        collectBindingNames(parameter.name, parameterNames);
      }
    }
    if (parameterNames.has(rootIdentifier)) return "component-prop";
    if (localDeclaredNames.has(rootIdentifier)) return "same-file-local";
    return "unknown";
  };

  const identifierReads = (node: ts.Node | undefined, initialLocalBindings: Iterable<string> = []): Set<string> => {
    const reads = new Set<string>();
    if (!node) return reads;
    const localBindings = new Set(initialLocalBindings);
    if (ts.isFunctionExpression(node) && node.name) localBindings.add(node.name.text);

    const visitRead = (child: ts.Node): void => {
      if (ts.isParameter(child)) collectBindingNames(child.name, localBindings);
      if (ts.isVariableDeclaration(child)) collectBindingNames(child.name, localBindings);
      if (child !== node && (ts.isFunctionDeclaration(child) || ts.isFunctionExpression(child) || ts.isArrowFunction(child))) {
        if (ts.isFunctionDeclaration(child) && child.name) localBindings.add(child.name.text);
        return;
      }
      if (ts.isIdentifier(child)) {
        const parent = child.parent;
        const isPropertyName =
          (ts.isPropertyAccessExpression(parent) && parent.name === child) ||
          (ts.isPropertyAssignment(parent) && parent.name === child) ||
          (ts.isBindingElement(parent) && parent.propertyName === child);
        if (!isPropertyName && !localBindings.has(child.text)) reads.add(child.text);
      }
      ts.forEachChild(child, visitRead);
    };

    visitRead(node);
    return reads;
  };

  const parameterBindingNames = (parameters: ts.NodeArray<ts.ParameterDeclaration>): string[] => {
    const bindings = new Set<string>();
    for (const parameter of parameters) collectBindingNames(parameter.name, bindings);
    return [...bindings];
  };

  const actionBindingKey = (onPressExpr: string, loc: SourceRange | undefined): string =>
    `${onPressExpr}:${loc?.startLine ?? ""}:${loc?.endLine ?? ""}`;

  const handlerReadsValue = (handlerExpr: string, valueExpr: string, actionLoc: SourceRange | undefined): { basis: string[] } | undefined => {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(valueExpr)) return undefined;
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(handlerExpr)) {
      const localBody = localFunctionBodies.get(handlerExpr);
      if (!localBody?.body) return undefined;
      const bindings = "parameters" in localBody ? parameterBindingNames(localBody.parameters) : [];
      const reads = identifierReads(localBody.body, bindings);
      if (reads.has(valueExpr)) return { basis: [`handler.${handlerExpr}.reads.${valueExpr}`] };
      return undefined;
    }
    const reads = rnActionIdentifierReads.get(actionBindingKey(handlerExpr, actionLoc));
    if ((handlerExpr.includes("=>") || handlerExpr.startsWith("function")) && reads?.has(valueExpr)) {
      return { basis: [`jsx.Pressable.onPress.reads.${valueExpr}`] };
    }
    return undefined;
  };

  const sourceRangeSpan = (ranges: Array<SourceRange | undefined>): SourceRange | undefined => {
    const present = ranges.filter((range): range is SourceRange => Boolean(range));
    if (present.length === 0) return undefined;
    return {
      startLine: Math.min(...present.map((range) => range.startLine)),
      endLine: Math.max(...present.map((range) => range.endLine)),
    };
  };

  const collectMutatorRefs = (expression: ts.Expression | undefined): Array<{ stateBinding: string; mutatorBinding: string; hook: "useState" | "useReducer"; mutatorKind: "setter" | "dispatch" }> => {
    if (!expression) return [];

    const matches = new Map<string, { stateBinding: string; mutatorBinding: string; hook: "useState" | "useReducer"; mutatorKind: "setter" | "dispatch" }>();
    const addMatch = (name: string): void => {
      const match = localStateMutators.get(name);
      if (!match) return;
      matches.set(`${match.hook}:${match.stateBinding}:${name}:${match.mutatorKind}`, {
        stateBinding: match.stateBinding,
        mutatorBinding: name,
        hook: match.hook,
        mutatorKind: match.mutatorKind,
      });
    };

    const visitExpression = (current: ts.Node): void => {
      if (ts.isCallExpression(current) && ts.isIdentifier(current.expression)) {
        addMatch(current.expression.text);
      } else if (ts.isIdentifier(current)) {
        addMatch(current.text);
      }
      ts.forEachChild(current, visitExpression);
    };

    if (ts.isIdentifier(expression)) {
      const localBody = localFunctionBodies.get(expression.text);
      if (localBody?.body) {
        visitExpression(localBody.body);
        return [...matches.values()];
      }
    }

    visitExpression(expression);
    return [...matches.values()];
  };

  const addRnStateActionConcerns = (
    node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
    primitive: ReactNativeStateActionConcernSignal["primitive"],
    trigger: ReactNativeStateActionConcernSignal["trigger"],
    expressionText: string | undefined,
    expressionNode: ts.Expression | undefined,
  ): void => {
    if (!expressionText || !expressionNode) return;
    const matches = collectMutatorRefs(expressionNode);
    for (const match of matches) {
      rnStateActionConcerns.push({
        hook: match.hook,
        stateBinding: match.stateBinding,
        mutatorBinding: match.mutatorBinding,
        mutatorKind: match.mutatorKind,
        primitive,
        trigger,
        actionExpr: expressionText,
        ...(expressionNode ? { actionKind: expressionKindOf(expressionNode) } : {}),
        ...(expressionNode ? { actionSource: relationSourceOf(node, expressionNode) } : {}),
        loc: sourceRangeOf(sourceFile, node),
        evidence: [`jsx.${primitive}.${trigger}`, `hook.${match.hook}`, `rn-state-action.${match.mutatorKind}`],
      });
    }
  };

  const jsxElementTextLabel = (element: ts.JsxElement): string | undefined => {
    const parts: string[] = [];
    const visitText = (child: ts.Node): void => {
      if (ts.isJsxExpression(child)) return;
      if (ts.isJsxText(child)) {
        const text = compactText(child.getFullText(sourceFile));
        if (text) parts.push(text);
        return;
      }
      ts.forEachChild(child, visitText);
    };

    for (const child of element.children) visitText(child);
    const label = compactText(parts.join(" "));
    return label || undefined;
  };

  const collectRnPrimitiveInteraction = (
    node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
    tag: string,
    attributeValues: Map<string, string>,
    attributeExpressions: Map<string, ts.Expression>,
  ): void => {
    if (tag === "TextInput") {
      const valueExpr = attributeValues.get("value");
      const onChangeTextExpr = attributeValues.get("onChangeText");
      const onChangeTextNode = attributeExpressions.get("onChangeText");
      const onSubmitEditingExpr = attributeValues.get("onSubmitEditing");
      const onSubmitEditingNode = attributeExpressions.get("onSubmitEditing");
      const placeholder = attributeValues.get("placeholder");
      const keyboardType = attributeValues.get("keyboardType");
      const secureTextEntry = attributeValues.get("secureTextEntry");
      const maxLength = attributeValues.get("maxLength");
      const autoCapitalize = attributeValues.get("autoCapitalize");
      const accessibilityLabel = attributeValues.get("accessibilityLabel");
      const testID = attributeValues.get("testID");
      if (
        !valueExpr &&
        !onChangeTextExpr &&
        !onSubmitEditingExpr &&
        !placeholder &&
        !keyboardType &&
        !secureTextEntry &&
        !maxLength &&
        !autoCapitalize &&
        !accessibilityLabel &&
        !testID
      ) {
        return;
      }

      rnInputBindings.push({
        primitive: "TextInput",
        loc: sourceRangeOf(sourceFile, node),
        ...(valueExpr ? { valueExpr } : {}),
        ...(onChangeTextExpr ? { onChangeTextExpr } : {}),
        ...(onChangeTextNode ? { onChangeTextKind: expressionKindOf(onChangeTextNode) } : {}),
        ...(onChangeTextNode ? { onChangeTextSource: relationSourceOf(node, onChangeTextNode) } : {}),
        ...(onSubmitEditingExpr ? { onSubmitEditingExpr } : {}),
        ...(onSubmitEditingNode ? { onSubmitEditingKind: expressionKindOf(onSubmitEditingNode) } : {}),
        ...(onSubmitEditingNode ? { onSubmitEditingSource: relationSourceOf(node, onSubmitEditingNode) } : {}),
        ...(placeholder ? { placeholder } : {}),
        ...(keyboardType ? { keyboardType } : {}),
        ...(secureTextEntry ? { secureTextEntry } : {}),
        ...(maxLength ? { maxLength } : {}),
        ...(autoCapitalize ? { autoCapitalize } : {}),
        ...(accessibilityLabel ? { accessibilityLabel } : {}),
        ...(testID ? { testID } : {}),
        evidence: [
          ...(valueExpr ? ["jsx.TextInput.value"] : []),
          ...(onChangeTextExpr ? ["jsx.TextInput.onChangeText"] : []),
          ...(onSubmitEditingExpr ? ["jsx.TextInput.onSubmitEditing"] : []),
          ...(placeholder ? ["jsx.TextInput.placeholder"] : []),
          ...(keyboardType ? ["jsx.TextInput.keyboardType"] : []),
          ...(secureTextEntry ? ["jsx.TextInput.secureTextEntry"] : []),
          ...(maxLength ? ["jsx.TextInput.maxLength"] : []),
          ...(autoCapitalize ? ["jsx.TextInput.autoCapitalize"] : []),
          ...(accessibilityLabel ? ["jsx.TextInput.accessibilityLabel"] : []),
          ...(testID ? ["jsx.TextInput.testID"] : []),
        ],
      });
      addRnStateActionConcerns(node, "TextInput", "onChangeText", onChangeTextExpr, onChangeTextNode);
      addRnStateActionConcerns(node, "TextInput", "onSubmitEditing", onSubmitEditingExpr, onSubmitEditingNode);
      return;
    }

    if (!RN_ACTION_PRIMITIVE_TAGS.has(tag as ReactNativePrimitiveActionBindingSignal["primitive"])) return;
    const onPressExpr = attributeValues.get("onPress");
    if (!onPressExpr) return;
    const onPressNode = attributeExpressions.get("onPress");
    const disabled = attributeValues.get("disabled");
    const accessibilityLabel = attributeValues.get("accessibilityLabel");
    const accessibilityRole = attributeValues.get("accessibilityRole");
    const testID = attributeValues.get("testID");
    const title = attributeValues.get("title");
    const label = title ?? (ts.isJsxOpeningElement(node) && ts.isJsxElement(node.parent) ? jsxElementTextLabel(node.parent) : undefined);
    const loc = sourceRangeOf(sourceFile, node);
    const actionReads = identifierReads(onPressNode);
    if (actionReads.size > 0) rnActionIdentifierReads.set(actionBindingKey(onPressExpr, loc), actionReads);
    rnActionBindings.push({
      primitive: tag as ReactNativePrimitiveActionBindingSignal["primitive"],
      loc,
      onPressExpr,
      ...(onPressNode ? { onPressKind: expressionKindOf(onPressNode) } : {}),
      ...(onPressNode ? { onPressSource: relationSourceOf(node, onPressNode) } : {}),
      ...(label ? { label } : {}),
      ...(disabled ? { disabled } : {}),
      ...(accessibilityLabel ? { accessibilityLabel } : {}),
      ...(accessibilityRole ? { accessibilityRole } : {}),
      ...(testID ? { testID } : {}),
      evidence: [
        `jsx.${tag}.onPress`,
        ...(label ? [`jsx.${tag}.${title ? "title" : "Text.label"}`] : []),
        ...(disabled ? [`jsx.${tag}.disabled`] : []),
        ...(accessibilityLabel ? [`jsx.${tag}.accessibilityLabel`] : []),
        ...(accessibilityRole ? [`jsx.${tag}.accessibilityRole`] : []),
        ...(testID ? [`jsx.${tag}.testID`] : []),
      ],
    });
    addRnStateActionConcerns(node, tag as ReactNativeStateActionConcernSignal["primitive"], "onPress", onPressExpr, onPressNode);
  };

  const collectRnAccessibilityTestAnchor = (
    node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
    tag: string,
    attributeValues: Map<string, string>,
  ): void => {
    if (!reactNativeImportedNames.has(tag)) return;
    const accessibilityLabel = attributeValues.get("accessibilityLabel");
    const accessibilityRole = attributeValues.get("accessibilityRole");
    const accessibilityHint = attributeValues.get("accessibilityHint");
    const testID = attributeValues.get("testID");
    if (!accessibilityLabel && !accessibilityRole && !accessibilityHint && !testID) return;

    rnAccessibilityTestAnchors.push({
      primitive: tag,
      loc: sourceRangeOf(sourceFile, node),
      ...(accessibilityLabel ? { accessibilityLabel } : {}),
      ...(accessibilityRole ? { accessibilityRole } : {}),
      ...(accessibilityHint ? { accessibilityHint } : {}),
      ...(testID ? { testID } : {}),
      evidence: [
        ...(accessibilityLabel ? [`jsx.${tag}.accessibilityLabel`] : []),
        ...(accessibilityRole ? [`jsx.${tag}.accessibilityRole`] : []),
        ...(accessibilityHint ? [`jsx.${tag}.accessibilityHint`] : []),
        ...(testID ? [`jsx.${tag}.testID`] : []),
      ],
    });
  };

  const collectRnMediaLayoutConcern = (
    node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
    tag: string,
    attributeValues: Map<string, string>,
  ): void => {
    if (!reactNativeImportedNames.has(tag)) return;

    if (tag === "ScrollView") {
      const pagingEnabled = attributeValues.get("pagingEnabled");
      if (pagingEnabled) {
        rnMediaLayoutConcerns.push({
          kind: "pagingEnabled",
          primitive: "ScrollView",
          value: pagingEnabled,
          loc: sourceRangeOf(sourceFile, node),
          evidence: ["jsx.ScrollView.pagingEnabled"],
        });
      }
      return;
    }

    if (tag !== "Image") return;

    rnMediaLayoutConcerns.push({
      kind: "media-primitive",
      primitive: "Image",
      loc: sourceRangeOf(sourceFile, node),
      evidence: ["jsx.Image"],
    });

    const resizeMode = attributeValues.get("resizeMode") ?? stylePropertyValue(attributeValues.get("style"), "resizeMode");
    if (resizeMode) {
      rnMediaLayoutConcerns.push({
        kind: "resizeMode",
        primitive: "Image",
        value: resizeMode,
        loc: sourceRangeOf(sourceFile, node),
        evidence: ["jsx.Image.resizeMode"],
      });
    }
  };

  const collectRnListRenderingConcern = (
    node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
    tag: string,
    attributeValues: Map<string, string>,
    attributeExpressions: Map<string, ts.Expression>,
  ): void => {
    if (!reactNativeImportedNames.has(tag)) return;

    if (tag === "ScrollView") {
      rnListRenderingConcerns.push({
        kind: "list-primitive",
        primitive: "ScrollView",
        loc: sourceRangeOf(sourceFile, node),
        evidence: ["jsx.ScrollView"],
      });
      return;
    }

    if (tag !== "FlatList" && tag !== "SectionList") return;

    rnListRenderingConcerns.push({
      kind: "list-primitive",
      primitive: tag,
      loc: sourceRangeOf(sourceFile, node),
      evidence: [`jsx.${tag}`],
    });

    const renderItemExpr = attributeValues.get("renderItem");
    const renderItemNode = attributeExpressions.get("renderItem");
    if (renderItemExpr && renderItemNode) {
      rnListRenderingConcerns.push({
        kind: "renderItem",
        primitive: tag,
        expr: renderItemExpr,
        ...(renderItemNode ? { exprKind: expressionKindOf(renderItemNode) } : {}),
        ...(renderItemNode ? { exprSource: relationSourceOf(node, renderItemNode) } : {}),
        loc: sourceRangeOf(sourceFile, node),
        evidence: [`jsx.${tag}.renderItem`],
      });
    }

    const keyExtractorExpr = attributeValues.get("keyExtractor");
    const keyExtractorNode = attributeExpressions.get("keyExtractor");
    if (keyExtractorExpr && keyExtractorNode) {
      rnListRenderingConcerns.push({
        kind: "keyExtractor",
        primitive: tag,
        expr: keyExtractorExpr,
        ...(keyExtractorNode ? { exprKind: expressionKindOf(keyExtractorNode) } : {}),
        ...(keyExtractorNode ? { exprSource: relationSourceOf(node, keyExtractorNode) } : {}),
        loc: sourceRangeOf(sourceFile, node),
        evidence: [`jsx.${tag}.keyExtractor`],
      });
    }
  };

  const collectJsxOpening = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement): void => {
    const tag = node.tagName.getText(sourceFile);
    const attributeValues = new Map<string, string>();
    const attributeExpressions = new Map<string, ts.Expression>();
    for (const property of node.attributes.properties) {
      if (!ts.isJsxAttribute(property)) continue;
      const value = jsxAttributeValue(property);
      if (value) attributeValues.set(property.name.getText(sourceFile), value);
      const expression = jsxAttributeExpression(property);
      if (expression) attributeExpressions.set(property.name.getText(sourceFile), expression);
    }
    const elementId = attributeValues.get("id");
    if (elementId) {
      a11ySourceIds.push({ value: elementId, loc: sourceRangeOf(sourceFile, node) });
    }
    if (tag === "Controller") {
      addLocatedAnchor(validationAnchors, "Controller", node);
    }
    collectRnPrimitiveInteraction(node, tag, attributeValues, attributeExpressions);
    collectRnAccessibilityTestAnchor(node, tag, attributeValues);
    collectRnListRenderingConcern(node, tag, attributeValues, attributeExpressions);
    collectRnMediaLayoutConcern(node, tag, attributeValues);

    const propNames: string[] = [];
    const propValues: Record<string, string> = {};
    const handlers: string[] = [];
    const handlerValues: Record<string, string> = {};
    let controlName: string | undefined;
    let controlType: string | undefined;
    for (const property of node.attributes.properties) {
      if (ts.isJsxSpreadAttribute(property)) {
        const spread = property.expression;
        if (ts.isCallExpression(spread) && callShortName(spread) === "register") {
          const fieldName = spread.arguments[0];
          if (fieldName && ts.isStringLiteralLike(fieldName)) {
            controlName = fieldName.text;
            propNames.push("name");
          }
        }
        continue;
      }
      if (!ts.isJsxAttribute(property)) continue;
      const attrName = property.name.getText(sourceFile);
      if (CONTROL_PROP_NAMES.has(attrName)) {
        propNames.push(attrName);
        const value = jsxAttributeValue(property);
        if (value) propValues[attrName] = value;
      }
      if (tag === "label") {
        addA11yAnchor("label", jsxAttributeValue(property) ?? tag, property, {
          ...(elementId ? { sourceId: elementId } : {}),
        });
      }
      if (attrName === "htmlFor") {
        const value = jsxAttributeValue(property) ?? attrName;
        addA11yAnchor("htmlFor", value, property, {
          references: idRefTokens(value),
          ...(elementId ? { sourceId: elementId } : {}),
        });
      }
      if (attrName === "role") {
        addA11yAnchor("role", jsxAttributeValue(property) ?? attrName, property, {
          ...(elementId ? { sourceId: elementId } : {}),
        });
      }
      if (attrName.startsWith("aria-")) {
        const value = jsxAttributeValue(property) ?? "true";
        addA11yAnchor("aria", `${attrName}=${value}`, property, {
          ...(attrName === "aria-describedby" || attrName === "aria-labelledby" ? { references: idRefTokens(value) } : {}),
          ...(elementId ? { sourceId: elementId } : {}),
        });
      }
      if (attrName === "required") {
        addA11yAnchor("required", controlName ? `${tag}[name=${controlName}]` : tag, property);
      }
      if (attrName === "disabled") {
        addA11yAnchor("disabled", controlName ? `${tag}[name=${controlName}]` : tag, property);
        const value = jsxAttributeValue(property);
        if (value && value !== "true") {
          addLocatedAnchor(stateConditions, value, property);
        }
      }
      if (attrName === "readOnly") {
        addA11yAnchor("readonly", controlName ? `${tag}[name=${controlName}]` : tag, property);
      }
      if (/^on[A-Z]/.test(attrName)) {
        handlers.push(attrName);
        const value = jsxAttributeValue(property);
        if (value) handlerValues[attrName] = value;
      }
      if (attrName === "name") {
        controlName = jsxAttributeValue(property);
      }
      if (attrName === "type") {
        controlType = jsxAttributeValue(property);
      }
      if (tag === "form" && attrName === "onSubmit") {
        addLocatedAnchor(submitHandlers, jsxAttributeValue(property) ?? "onSubmit", property);
      }
    }

    const hasActionableControlSignal = Boolean(controlName || controlType || propNames.length > 0 || handlers.length > 0);
    if ((!FORM_CONTROL_TAGS.has(tag) && tag !== "Controller") || !hasActionableControlSignal) return;
    formControls.push({
      tag,
      ...(controlName ? { name: controlName } : {}),
      ...(controlType ? { type: controlType } : {}),
      ...(propNames.length ? { props: [...new Set(propNames)].slice(0, MAX_CONTROL_PROPS) } : {}),
      ...(Object.keys(propValues).length ? { propValues } : {}),
      ...(handlers.length ? { handlers: [...new Set(handlers)].slice(0, MAX_CONTROL_PROPS) } : {}),
      ...(Object.keys(handlerValues).length ? { handlerValues } : {}),
      loc: sourceRangeOf(sourceFile, node),
    });
  };

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && node.importClause) {
      const moduleName = ts.isStringLiteralLike(node.moduleSpecifier) ? node.moduleSpecifier.text : undefined;
      const navigationImportedSymbols: string[] = [];
      if (node.importClause.name) importedNames.add(node.importClause.name.text);
      const namedBindings = node.importClause.namedBindings;
      if (namedBindings) {
        if (ts.isNamespaceImport(namedBindings)) {
          importedNames.add(namedBindings.name.text);
          if (moduleName === "react-native") reactNativeImportedNames.add(namedBindings.name.text);
          if (moduleName === RN_NAVIGATION_MODULE) {
            reactNavigationImportedNames.add(namedBindings.name.text);
            navigationImportedSymbols.push(namedBindings.name.text);
          }
        } else {
          for (const element of namedBindings.elements) {
            importedNames.add(element.name.text);
            if (moduleName === "react-native") reactNativeImportedNames.add(element.name.text);
            if (moduleName === RN_NAVIGATION_MODULE) {
              reactNavigationImportedNames.add(element.name.text);
              navigationImportedSymbols.push(element.name.text);
            }
          }
        }
      }
      if (moduleName === RN_NAVIGATION_MODULE) {
        rnNavigationConcerns.push({
          kind: "navigation-import",
          moduleSpecifier: RN_NAVIGATION_MODULE,
          ...(navigationImportedSymbols.length ? { importedSymbols: navigationImportedSymbols } : {}),
          loc: sourceRangeOf(sourceFile, node),
          evidence: ["import.@react-navigation/native"],
        });
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name) {
      localDeclaredNames.add(node.name.text);
      localFunctionBodies.set(node.name.text, node);
    }
    if (ts.isVariableDeclaration(node)) {
      collectBindingNames(node.name, localDeclaredNames);
      if (ts.isIdentifier(node.name) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
        localFunctionBodies.set(node.name.text, node.initializer);
      }
    }
    if (ts.isCallExpression(node)) {
      const callName = node.expression.getText(sourceFile);
      const shortName = callShortName(node);
      if (HOOK_NAMES.has(shortName) || /^use[A-Z]/.test(shortName)) {
        hooks.add(shortName);
      }
      if (shortName === "useState" && ts.isVariableDeclaration(node.parent) && ts.isArrayBindingPattern(node.parent.name)) {
        const names = node.parent.name.elements.map((element) => element.getText(sourceFile)).filter(Boolean);
        if (names.length) {
          stateSummary.add(names.join(", "));
          if (names.length >= 2) {
            localStateMutators.set(names[1], { hook: "useState", stateBinding: names[0], mutatorKind: "setter" });
          }
        }
      }
      if (shortName === "useReducer" && ts.isVariableDeclaration(node.parent) && ts.isArrayBindingPattern(node.parent.name)) {
        const names = node.parent.name.elements.map((element) => element.getText(sourceFile)).filter(Boolean);
        if (names.length >= 2) {
          stateSummary.add(names.join(", "));
          localStateMutators.set(names[1], { hook: "useReducer", stateBinding: names[0], mutatorKind: "dispatch" });
        }
      }
      if (EFFECT_HOOK_NAMES.has(shortName)) {
        effects.add(shortName);
        hasSideEffects = true;
        const callback = firstCallbackArgument(node);
        const deps = dependencyTexts(node);
        effectSignals.push({
          hook: shortName,
          ...(deps ? { deps } : {}),
          ...(callback && containsReturnStatement(callback.body) ? { hasCleanup: true } : {}),
          ...(callback && (callback.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) || containsAsyncWork(callback.body)) ? { hasAsyncWork: true } : {}),
          loc: sourceRangeOf(sourceFile, node),
        });
        addSnippet(shortName, textOf(sourceFile, node.parent), "effect-hook", node.parent);
      }
      if (CALLBACK_HOOK_NAMES.has(shortName)) {
        const deps = dependencyTexts(node);
        callbackSignals.push({
          hook: shortName,
          ...(deps ? { deps } : {}),
          loc: sourceRangeOf(sourceFile, node),
        });
      }
      if (callName.endsWith(".map") || shortName === "map") {
        repeatedBlocks.add("array-map-render");
        addSnippet("repeated-block", textOf(sourceFile, node.parent), "repeated-rendering", node.parent);
      }
      if (shortName === "useForm" || shortName === "register") {
        addLocatedAnchor(validationAnchors, shortName, node);
      }
      if (RN_NAVIGATION_HOOK_NAMES.has(shortName as Extract<ReactNativeNavigationConcernSignal, { kind: "navigation-hook" }>["hook"]) && reactNavigationImportedNames.has(shortName)) {
        rnNavigationConcerns.push({
          kind: "navigation-hook",
          hook: shortName as Extract<ReactNativeNavigationConcernSignal, { kind: "navigation-hook" }>["hook"],
          loc: sourceRangeOf(sourceFile, node),
          evidence: [`hook.${shortName}`],
        });
      }
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "StyleSheet" &&
        node.expression.name.text === "create" &&
        reactNativeImportedNames.has("StyleSheet")
      ) {
        rnStylePlatformConcerns.push({
          kind: "style-sheet-create",
          calleeExpr: "StyleSheet.create",
          loc: sourceRangeOf(sourceFile, node),
          evidence: ["call.StyleSheet.create"],
        });
      }
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "Platform" &&
        node.expression.name.text === "select" &&
        reactNativeImportedNames.has("Platform")
      ) {
        const firstArg = node.arguments[0];
        const optionKeys = firstArg && ts.isObjectLiteralExpression(firstArg)
          ? firstArg.properties.flatMap((property) => {
            if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) return [];
            const name = ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
              ? property.name.text
              : property.name.getText(sourceFile);
            return name ? [name] : [];
          })
          : [];
        rnStylePlatformConcerns.push({
          kind: "platform-select",
          calleeExpr: "Platform.select",
          ...(optionKeys.length ? { optionKeys } : {}),
          loc: sourceRangeOf(sourceFile, node),
          evidence: ["call.Platform.select"],
        });
      }
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "Dimensions" &&
        node.expression.name.text === "get" &&
        reactNativeImportedNames.has("Dimensions")
      ) {
        const arg = node.arguments[0];
        rnMediaLayoutConcerns.push({
          kind: "dimensions-get",
          calleeExpr: "Dimensions.get",
          ...(arg ? { argExpr: compactText(arg.getText(sourceFile)) } : {}),
          loc: sourceRangeOf(sourceFile, node),
          evidence: ["call.Dimensions.get"],
        });
      }
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "navigate" &&
        rootIdentifierOf(node.expression.expression) === "navigation"
      ) {
        const routeNameArg = node.arguments[0];
        rnNavigationConcerns.push({
          kind: "navigation-navigate",
          calleeExpr: compactText(node.expression.getText(sourceFile)),
          ...(routeNameArg ? { routeNameExpr: compactText(routeNameArg.getText(sourceFile)) } : {}),
          loc: sourceRangeOf(sourceFile, node),
          evidence: ["call.navigation.navigate"],
        });
      }
    }

    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "route" &&
      node.name.text === "params"
    ) {
      rnNavigationConcerns.push({
        kind: "route-params",
        accessExpr: "route.params",
        loc: sourceRangeOf(sourceFile, node),
        evidence: ["member.route.params"],
      });
    }

    if (ts.isFunctionDeclaration(node) && node.name && /^handle[A-Z]/.test(node.name.text)) {
      addEventHandlerSignal(node.name.text, node);
      addSnippet(node.name.text, textOf(sourceFile, node), "event-handler", node);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /^handle[A-Z]/.test(node.name.text)) {
      addEventHandlerSignal(node.name.text, node.parent?.parent ?? node);
      addSnippet(node.name.text, textOf(sourceFile, node.parent?.parent ?? node), "event-handler", node.parent?.parent ?? node);
    }
    if (ts.isJsxAttribute(node)) {
      const attrName = node.name.getText(sourceFile);
      if (/^on[A-Z]/.test(attrName)) {
        const handlerName = jsxAttributeValue(node) ?? attrName;
        addEventHandlerSignal(handlerName, node, attrName);
      }
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      collectJsxOpening(node);
    }
    if (ts.isPropertyAssignment(node)) {
      const name = node.name.getText(sourceFile);
      if (name === "resolver" || name === "validationSchema" || /schema/i.test(name)) {
        addLocatedAnchor(validationAnchors, name, node);
      }
    }
    if (ts.isConditionalExpression(node) || (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)) {
      conditionalRenders.add(node.getText(sourceFile).slice(0, 80));
      addSnippet("conditional", textOf(sourceFile, node), "conditional-render", node);
    }
    if (ts.isIdentifier(node) && ["window", "document", "fetch", "localStorage", "sessionStorage"].includes(node.text)) {
      hasSideEffects = true;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  const { sections, jsxDepth } = collectSectionsFromJsx(sourceFile);
  const formSurface = {
    controls: dedupeBy(formControls, (item) => `${item.tag}:${item.name ?? ""}:${item.type ?? ""}:${item.loc?.startLine ?? ""}`).slice(0, MAX_FORM_CONTROLS),
    submitHandlers: dedupeBy(submitHandlers, (item) => `${item.value}:${item.loc?.startLine ?? ""}`).slice(0, MAX_FORM_ANCHORS),
    validationAnchors: dedupeBy(validationAnchors, (item) => `${item.value}:${item.loc?.startLine ?? ""}`).slice(0, MAX_FORM_ANCHORS),
    stateConditions: dedupeBy(stateConditions, (item) => `${item.value}:${item.loc?.startLine ?? ""}`).slice(0, MAX_FORM_ANCHORS),
  };
  const hasFormSurface = formSurface.controls.length > 0 || formSurface.submitHandlers.length > 0 || formSurface.validationAnchors.length > 0 || formSurface.stateConditions.length > 0;
  const effectSignalList = dedupeBy(effectSignals, (item) => `${item.hook}:${item.loc?.startLine ?? ""}:${item.deps?.join(",") ?? ""}`).slice(0, MAX_EFFECT_SIGNALS);
  const callbackSignalList = dedupeBy(callbackSignals, (item) => `${item.hook}:${item.loc?.startLine ?? ""}:${item.deps?.join(",") ?? ""}`).slice(0, MAX_CALLBACK_SIGNALS);
  const eventHandlerList = [...eventHandlers];
  const eventHandlerSignalList = dedupeBy(eventHandlerSignals, (item) => `${item.name}:${item.trigger ?? ""}:${item.loc?.startLine ?? ""}`).slice(0, MAX_EVENT_HANDLER_SIGNALS);
  const a11yAnchorList = dedupeBy(a11yAnchors, (item) => `${item.kind}:${item.label}:${item.loc?.startLine ?? ""}`).slice(0, 16);
  const a11ySourceIdList = dedupeBy(a11ySourceIds, (item) => `${item.value}:${item.loc?.startLine ?? ""}`).slice(0, 16);
  const rnInputBindingList = dedupeBy(
    rnInputBindings,
    (item) =>
      `${item.primitive}:${item.valueExpr ?? ""}:${item.onChangeTextExpr ?? ""}:${item.onChangeTextSource ?? ""}:${item.onSubmitEditingExpr ?? ""}:${item.onSubmitEditingSource ?? ""}:${item.placeholder ?? ""}:${item.loc?.startLine ?? ""}`,
  ).slice(0, MAX_RN_PRIMITIVE_BINDINGS);
  const rnActionBindingList = dedupeBy(
    rnActionBindings,
    (item) => `${item.primitive}:${item.onPressExpr}:${item.onPressSource ?? ""}:${item.label ?? ""}:${item.loc?.startLine ?? ""}`,
  ).slice(0, MAX_RN_PRIMITIVE_BINDINGS);
  const rnAccessibilityAnchorList = dedupeBy(
    rnAccessibilityTestAnchors,
    (item) =>
      `${item.primitive}:${item.accessibilityLabel ?? ""}:${item.accessibilityRole ?? ""}:${item.accessibilityHint ?? ""}:${item.testID ?? ""}:${item.loc?.startLine ?? ""}`,
  ).slice(0, 16);
  const rnStateActionConcernList = dedupeBy(
    rnStateActionConcerns,
    (item) =>
      `${item.hook}:${item.stateBinding}:${item.mutatorBinding}:${item.primitive}:${item.trigger}:${item.actionExpr}:${item.actionSource ?? ""}:${item.loc?.startLine ?? ""}`,
  ).slice(0, MAX_RN_PRIMITIVE_BINDINGS);
  const rnListRenderingConcernList = dedupeBy(
    rnListRenderingConcerns,
    (item) => {
      switch (item.kind) {
        case "list-primitive":
          return `${item.kind}:${item.primitive}:${item.loc?.startLine ?? ""}`;
        case "renderItem":
        case "keyExtractor":
          return `${item.kind}:${item.primitive}:${item.expr}:${item.exprSource ?? ""}:${item.loc?.startLine ?? ""}`;
      }
    },
  ).slice(0, 16);
  const rnMediaLayoutConcernList = dedupeBy(
    rnMediaLayoutConcerns,
    (item) => {
      switch (item.kind) {
        case "media-primitive":
          return `${item.kind}:${item.primitive}:${item.loc?.startLine ?? ""}`;
        case "resizeMode":
          return `${item.kind}:${item.primitive}:${item.value}:${item.loc?.startLine ?? ""}`;
        case "pagingEnabled":
          return `${item.kind}:${item.primitive}:${item.value}:${item.loc?.startLine ?? ""}`;
        case "dimensions-get":
          return `${item.kind}:${item.calleeExpr}:${item.argExpr ?? ""}:${item.loc?.startLine ?? ""}`;
      }
    },
  ).slice(0, 16);
  const rnStylePlatformConcernList = dedupeBy(
    rnStylePlatformConcerns,
    (item) => {
      switch (item.kind) {
        case "style-sheet-create":
          return `${item.kind}:${item.calleeExpr}:${item.loc?.startLine ?? ""}`;
        case "platform-select":
          return `${item.kind}:${item.calleeExpr}:${item.optionKeys?.join(",") ?? ""}:${item.loc?.startLine ?? ""}`;
      }
    },
  ).slice(0, 16);
  const rnInputConstraints: ReactNativePrimitiveInputConstraintSignal[] = rnInputBindingList
    .flatMap((inputBinding) => {
      const constraintBasis = [
        ...(inputBinding.maxLength !== undefined ? ["jsx.TextInput.maxLength"] : []),
        ...(inputBinding.secureTextEntry !== undefined ? ["jsx.TextInput.secureTextEntry"] : []),
        ...(inputBinding.keyboardType !== undefined ? ["jsx.TextInput.keyboardType"] : []),
        ...(inputBinding.autoCapitalize !== undefined ? ["jsx.TextInput.autoCapitalize"] : []),
      ];
      if (constraintBasis.length === 0) return [];
      return [
        {
          primitive: "TextInput" as const,
          loc: inputBinding.loc,
          ...(inputBinding.valueExpr ? { valueExpr: inputBinding.valueExpr } : {}),
          constraintKind: "textInputMetadataConstraints" as const,
          ...(inputBinding.maxLength !== undefined ? { maxLength: inputBinding.maxLength } : {}),
          ...(inputBinding.secureTextEntry !== undefined ? { secureTextEntry: inputBinding.secureTextEntry } : {}),
          ...(inputBinding.keyboardType !== undefined ? { keyboardType: inputBinding.keyboardType } : {}),
          ...(inputBinding.autoCapitalize !== undefined ? { autoCapitalize: inputBinding.autoCapitalize } : {}),
          ...(inputBinding.placeholder !== undefined ? { descriptiveHint: inputBinding.placeholder } : {}),
          constraintBasis,
          evidence: [...constraintBasis, ...(inputBinding.placeholder !== undefined ? ["jsx.TextInput.placeholder"] : [])],
        },
      ];
    })
    .slice(0, MAX_RN_PRIMITIVE_BINDINGS);
  const rnStateActionRelations: ReactNativePrimitiveStateActionRelationSignal[] = rnActionBindingList
    .flatMap((actionBinding) => {
      if (actionBinding.primitive !== "Pressable") return [];
      const directInputMatches = rnInputBindingList.flatMap((inputBinding) => {
        if (!inputBinding.valueExpr) return [];
        const read = handlerReadsValue(actionBinding.onPressExpr, inputBinding.valueExpr, actionBinding.loc);
        if (!read) return [];
        return [{ inputBinding, read }];
      });
      if (directInputMatches.length !== 1) return [];
      const { inputBinding, read } = directInputMatches[0];
      return [
        {
          relationKind: "actionReadsInputValue" as const,
          inputPrimitive: "TextInput" as const,
          actionPrimitive: "Pressable" as const,
          valueExpr: inputBinding.valueExpr!,
          ...(inputBinding.onChangeTextExpr ? { onChangeTextExpr: inputBinding.onChangeTextExpr } : {}),
          onPressExpr: actionBinding.onPressExpr,
          ...(actionBinding.label ? { label: actionBinding.label } : {}),
          relationBasis: read.basis,
          loc: sourceRangeSpan([inputBinding.loc, actionBinding.loc]),
          evidence: [
            "rn.stateActionRelation.actionReadsInputValue",
            ...inputBinding.evidence,
            ...actionBinding.evidence,
            ...read.basis,
          ],
        },
      ];
    })
    .slice(0, MAX_RN_PRIMITIVE_BINDINGS);
  const rnConstraintActionReadiness: ReactNativePrimitiveConstraintActionReadinessSignal[] = rnActionBindingList
    .flatMap((actionBinding) => {
      if (actionBinding.primitive !== "Pressable" || !actionBinding.disabled) return [];
      const relationMatches = rnStateActionRelations.filter((relation) => relation.onPressExpr === actionBinding.onPressExpr);
      if (relationMatches.length !== 1) return [];
      const relation = relationMatches[0];
      const inputConstraintMatches = rnInputConstraints.filter((constraint) => constraint.valueExpr === relation.valueExpr);
      if (inputConstraintMatches.length !== 1) return [];
      const inputConstraint = inputConstraintMatches[0];
      return [
        {
          relationKind: "constraintActionReadiness" as const,
          inputPrimitive: "TextInput" as const,
          actionPrimitive: "Pressable" as const,
          valueExpr: relation.valueExpr,
          onPressExpr: actionBinding.onPressExpr,
          constraintKind: "textInputMetadataConstraints" as const,
          readinessKind: "pressableDisabledReadiness" as const,
          disabledExpr: actionBinding.disabled,
          constraintBasis: inputConstraint.constraintBasis,
          readinessBasis: ["jsx.Pressable.disabled"],
          relationBasis: relation.relationBasis,
          loc: sourceRangeSpan([inputConstraint.loc, actionBinding.loc]),
          evidence: [
            "rn.constraintActionReadiness.pressableDisabledReadsConstrainedInput",
            ...inputConstraint.evidence,
            ...actionBinding.evidence,
            ...relation.relationBasis,
          ],
        },
      ];
    })
    .slice(0, MAX_RN_PRIMITIVE_BINDINGS);
  const rnNavigationConcernList = dedupeBy(
    rnNavigationConcerns,
    (item) => {
      switch (item.kind) {
        case "navigation-import":
          return `${item.kind}:${item.moduleSpecifier}:${item.importedSymbols?.join(",") ?? ""}:${item.loc?.startLine ?? ""}`;
        case "navigation-hook":
          return `${item.kind}:${item.hook}:${item.loc?.startLine ?? ""}`;
        case "navigation-navigate":
          return `${item.kind}:${item.calleeExpr}:${item.routeNameExpr ?? ""}:${item.loc?.startLine ?? ""}`;
        case "route-params":
          return `${item.kind}:${item.accessExpr}:${item.loc?.startLine ?? ""}`;
      }
    },
  ).slice(0, 16);
  const hasRnPrimitiveInteractions =
    rnInputBindingList.length > 0 ||
    rnActionBindingList.length > 0 ||
    rnInputConstraints.length > 0 ||
    rnStateActionRelations.length > 0 ||
    rnConstraintActionReadiness.length > 0;
  const hasRnStateActionConcerns = rnStateActionConcernList.length > 0;
  return {
    behavior: {
      hooks: [...hooks],
      ...(stateSummary.size ? { stateSummary: [...stateSummary] } : {}),
      ...(effects.size ? { effects: [...effects] } : {}),
      ...(effectSignalList.length ? { effectSignals: effectSignalList } : {}),
      ...(callbackSignalList.length ? { callbackSignals: callbackSignalList } : {}),
      ...(eventHandlerList.length ? { eventHandlers: eventHandlerList } : {}),
      ...(eventHandlerSignalList.length ? { eventHandlerSignals: eventHandlerSignalList } : {}),
      ...(hasFormSurface
        ? {
            formSurface: {
              ...(formSurface.controls.length ? { controls: formSurface.controls } : {}),
              ...(formSurface.submitHandlers.length ? { submitHandlers: formSurface.submitHandlers } : {}),
              ...(formSurface.validationAnchors.length ? { validationAnchors: formSurface.validationAnchors } : {}),
              ...(formSurface.stateConditions.length ? { stateConditions: formSurface.stateConditions } : {}),
            },
          }
        : {}),
      ...(hasRnPrimitiveInteractions
        ? {
            rnPrimitiveInteractions: {
              ...(rnInputBindingList.length ? { inputBindings: rnInputBindingList } : {}),
              ...(rnActionBindingList.length ? { actionBindings: rnActionBindingList } : {}),
              ...(rnInputConstraints.length ? { inputConstraints: rnInputConstraints } : {}),
              ...(rnStateActionRelations.length ? { stateActionRelations: rnStateActionRelations } : {}),
              ...(rnConstraintActionReadiness.length ? { constraintActionReadiness: rnConstraintActionReadiness } : {}),
            },
          }
        : {}),
      ...(rnAccessibilityAnchorList.length ? { rnAccessibilityTestAnchors: rnAccessibilityAnchorList } : {}),
      ...(rnListRenderingConcernList.length ? { rnListRenderingConcerns: rnListRenderingConcernList } : {}),
      ...(rnMediaLayoutConcernList.length ? { rnMediaLayoutConcerns: rnMediaLayoutConcernList } : {}),
      ...(hasRnStateActionConcerns ? { rnStateActionConcerns: rnStateActionConcernList } : {}),
      ...(rnStylePlatformConcernList.length ? { rnStylePlatformConcerns: rnStylePlatformConcernList } : {}),
      ...(rnNavigationConcernList.length ? { rnNavigationConcerns: rnNavigationConcernList } : {}),
      ...(a11yAnchorList.length ? { a11yAnchors: a11yAnchorList } : {}),
      ...(a11ySourceIdList.length ? { a11ySourceIds: a11ySourceIdList } : {}),
      hasSideEffects,
    },
    structure: {
      sections,
      conditionalRenders: [...conditionalRenders].slice(0, 8),
      repeatedBlocks: [...repeatedBlocks].slice(0, 8),
      jsxDepth,
    },
    snippets: snippetCandidates.slice(0, 3),
  };
}

export function extractFile(filePath: string): ExtractionResult {
  const sourceText = fs.readFileSync(filePath, "utf8");
  return extractSource(filePath, sourceText);
}

export function extractSource(filePath: string, sourceText: string): ExtractionResult {
  const fileHash = hashText(sourceText);
  const language = getLanguage(filePath);
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, getScriptKind(language));
  const exports = collectExports(sourceFile);
  const componentName = getComponentName(exports);
  const componentDeclaration = componentName ? findDeclarationByName(sourceFile, componentName) : undefined;
  const contract = getPropsInfo(sourceFile, componentName);
  const style = detectStyleSystem(sourceFile);
  const behaviorStructure = collectBehaviorAndStructure(sourceFile);
  const imports = collectImports(sourceFile);
  const importCount = sourceFile.statements.filter(ts.isImportDeclaration).length;
  const moduleDeclarations = language === "ts" || language === "js"
    ? collectModuleDeclarations(sourceFile)
    : [];
  const base: Omit<ExtractionResult, "mode"> = {
    filePath,
    fileHash,
    language,
    componentName,
    componentLoc: componentDeclaration ? sourceRangeOf(sourceFile, componentDeclaration) : undefined,
    exports,
    contract,
    behavior: behaviorStructure.behavior,
    structure: behaviorStructure.structure,
    style,
    snippets: behaviorStructure.snippets,
    meta: {
      lineCount: sourceText.split(/\r?\n/).length,
      importCount,
      rawSizeBytes: Buffer.byteLength(sourceText, "utf8"),
      generatedAt: new Date().toISOString(),
    },
  };
  if (moduleDeclarations.length > 0 || imports.length > 0) {
    base.structure = {
      ...base.structure,
      ...(moduleDeclarations.length > 0 ? { moduleDeclarations } : {}),
      ...(imports.length > 0 ? { imports } : {}),
    };
  }

  const { mode, complexityScore, reasons, confidence, useOriginal } = decideMode(base);
  const domainDetection = detectDomainFromSource(sourceText, filePath);
  const result: ExtractionResult = {
    ...base,
    mode,
    useOriginal,
    rawText: mode === "raw" ? sourceText : undefined,
    snippets: mode === "hybrid" ? base.snippets : undefined,
    domainDetection,
    meta: {
      ...base.meta,
      complexityScore,
      decideReason: reasons,
      decideConfidence: confidence,
    },
  };
  return result;
}
