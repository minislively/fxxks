import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { hashText } from "./hash";
import { decideMode } from "./decide";
import type { ExtractionResult, FormSurface, Language, SourceRange, StyleSystem } from "./schema";

const HOOK_NAMES = new Set(["useState", "useEffect", "useMemo", "useCallback", "useRef", "useReducer", "useLayoutEffect", "useContext", "useId", "useTransition"]);
const EFFECT_HOOK_NAMES = new Set(["useEffect", "useLayoutEffect"]);
const CALLBACK_HOOK_NAMES = new Set(["useMemo", "useCallback"]);
const FORM_CONTROL_TAGS = new Set(["form", "input", "select", "textarea"]);
const CONTROL_PROP_NAMES = new Set(["name", "type", "value", "defaultValue", "required", "disabled", "checked", "defaultChecked"]);
const MAX_EFFECT_SIGNALS = 8;
const MAX_CALLBACK_SIGNALS = 8;
const MAX_EVENT_HANDLER_SIGNALS = 12;
const MAX_FORM_CONTROLS = 16;
const MAX_FORM_ANCHORS = 8;
const MAX_DEPENDENCIES = 8;
const MAX_CONTROL_PROPS = 8;
const MAX_TEXT_LENGTH = 48;

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
  return { system, summary, hasStyleBranching };
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
  const submitHandlers: NonNullable<FormSurface["submitHandlers"]> = [];
  const validationAnchors: NonNullable<FormSurface["validationAnchors"]> = [];
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

  const jsxAttributeValue = (attribute: ts.JsxAttribute): string | undefined => {
    if (!attribute.initializer) return "true";
    if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
    if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
      return compactText(attribute.initializer.expression.getText(sourceFile));
    }
    return compactText(attribute.initializer.getText(sourceFile));
  };

  const collectJsxOpening = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement): void => {
    const tag = node.tagName.getText(sourceFile);
    if (tag === "Controller") {
      addLocatedAnchor(validationAnchors, "Controller", node);
    }

    const propNames: string[] = [];
    const handlers: string[] = [];
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
      }
      if (/^on[A-Z]/.test(attrName)) {
        handlers.push(attrName);
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
      ...(handlers.length ? { handlers: [...new Set(handlers)].slice(0, MAX_CONTROL_PROPS) } : {}),
      loc: sourceRangeOf(sourceFile, node),
    });
  };

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const callName = node.expression.getText(sourceFile);
      const shortName = callShortName(node);
      if (HOOK_NAMES.has(shortName) || /^use[A-Z]/.test(shortName)) {
        hooks.add(shortName);
      }
      if (shortName === "useState" && ts.isVariableDeclaration(node.parent?.parent) && ts.isArrayBindingPattern(node.parent.parent.name)) {
        const names = node.parent.parent.name.elements
          .map((element) => element.getText(sourceFile))
          .filter(Boolean);
        if (names.length) stateSummary.add(names.join(", "));
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
  };
  const hasFormSurface = formSurface.controls.length > 0 || formSurface.submitHandlers.length > 0 || formSurface.validationAnchors.length > 0;
  const effectSignalList = dedupeBy(effectSignals, (item) => `${item.hook}:${item.loc?.startLine ?? ""}:${item.deps?.join(",") ?? ""}`).slice(0, MAX_EFFECT_SIGNALS);
  const callbackSignalList = dedupeBy(callbackSignals, (item) => `${item.hook}:${item.loc?.startLine ?? ""}:${item.deps?.join(",") ?? ""}`).slice(0, MAX_CALLBACK_SIGNALS);
  const eventHandlerList = [...eventHandlers];
  const eventHandlerSignalList = dedupeBy(eventHandlerSignals, (item) => `${item.name}:${item.trigger ?? ""}:${item.loc?.startLine ?? ""}`).slice(0, MAX_EVENT_HANDLER_SIGNALS);
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
            },
          }
        : {}),
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
  if (moduleDeclarations.length > 0) {
    base.structure = {
      ...base.structure,
      moduleDeclarations,
    };
  }

  const { mode, complexityScore, reasons, confidence, useOriginal } = decideMode(base);
  const result: ExtractionResult = {
    ...base,
    mode,
    useOriginal,
    rawText: mode === "raw" ? sourceText : undefined,
    snippets: mode === "hybrid" ? base.snippets : undefined,
    meta: {
      ...base.meta,
      complexityScore,
      decideReason: reasons,
      decideConfidence: confidence,
    },
  };
  return result;
}
