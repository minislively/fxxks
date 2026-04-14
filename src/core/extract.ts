import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { hashText } from "./hash";
import { decideMode } from "./decide";
import type { ExtractionResult, Language, StyleSystem } from "./schema";

const HOOK_NAMES = new Set(["useState", "useEffect", "useMemo", "useCallback", "useRef", "useReducer", "useLayoutEffect", "useContext", "useId", "useTransition"]);

function getLanguage(filePath: string): Language {
  const ext = path.extname(filePath);
  if (ext === ".tsx") return "tsx";
  if (ext === ".jsx") return "jsx";
  return "ts";
}

function getScriptKind(language: Language): ts.ScriptKind {
  if (language === "tsx") return ts.ScriptKind.TSX;
  if (language === "jsx") return ts.ScriptKind.JSX;
  return ts.ScriptKind.TS;
}

function textOf(sourceFile: ts.SourceFile, node: ts.Node): string {
  return sourceFile.text.slice(node.getStart(sourceFile), node.getEnd());
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
    if (firstParam?.type && ts.isTypeReferenceNode(firstParam.type) && ts.isIdentifier(firstParam.type.typeName)) {
      propsName = firstParam.type.typeName.text;
    }
    if (firstParam && ts.isObjectBindingPattern(firstParam.name)) {
      propsName = "props";
      collectBindingSummary(firstParam.name);
    }
  }

  if (declaration && ts.isVariableDeclaration(declaration)) {
    const initializer = declaration.initializer;
    if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
      const firstParam = initializer.parameters[0];
      if (firstParam?.type && ts.isTypeReferenceNode(firstParam.type) && ts.isIdentifier(firstParam.type.typeName)) {
        propsName = firstParam.type.typeName.text;
      }
      if (firstParam && ts.isObjectBindingPattern(firstParam.name)) {
        propsName = "props";
        collectBindingSummary(firstParam.name);
      }
    }
  }

  if (propsName) {
    const propsDecl = findDeclarationByName(sourceFile, propsName);
    if (propsDecl && ts.isInterfaceDeclaration(propsDecl)) {
      for (const member of propsDecl.members) {
        if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
          propsSummary.push(`${member.name.text}${member.questionToken ? "?" : ""}: ${member.type ? member.type.getText(sourceFile) : "unknown"}`);
        }
      }
    }
    if (propsDecl && ts.isTypeAliasDeclaration(propsDecl) && ts.isTypeLiteralNode(propsDecl.type)) {
      for (const member of propsDecl.type.members) {
        if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
          propsSummary.push(`${member.name.text}${member.questionToken ? "?" : ""}: ${member.type ? member.type.getText(sourceFile) : "unknown"}`);
        }
      }
    }
  }

  const sourceText = sourceFile.text;
  const hasForwardRef = /(?:React\.)?forwardRef\s*\(/.test(sourceText);
  return { propsName, propsSummary, hasForwardRef };
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
  const conditionalRenders = new Set<string>();
  const repeatedBlocks = new Set<string>();
  const snippetCandidates: Array<{ label: string; code: string; reason: string }> = [];
  let hasSideEffects = false;

  const addSnippet = (label: string, code: string, reason: string): void => {
    const cleaned = code.split("\n").slice(0, 12).join("\n").trim();
    if (!cleaned) return;
    if (snippetCandidates.some((item) => item.code === cleaned)) return;
    snippetCandidates.push({ label, code: cleaned, reason });
  };

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const callName = node.expression.getText(sourceFile);
      const shortName = callName.split(".").pop() ?? callName;
      if (HOOK_NAMES.has(shortName) || /^use[A-Z]/.test(shortName)) {
        hooks.add(shortName);
      }
      if (shortName === "useState" && ts.isVariableDeclaration(node.parent?.parent) && ts.isArrayBindingPattern(node.parent.parent.name)) {
        const names = node.parent.parent.name.elements
          .map((element) => element.getText(sourceFile))
          .filter(Boolean);
        if (names.length) stateSummary.add(names.join(", "));
      }
      if (shortName === "useEffect" || shortName === "useLayoutEffect") {
        effects.add(shortName);
        hasSideEffects = true;
        addSnippet(shortName, textOf(sourceFile, node.parent), "effect-hook");
      }
      if (callName.endsWith(".map") || shortName === "map") {
        repeatedBlocks.add("array-map-render");
        addSnippet("repeated-block", textOf(sourceFile, node.parent), "repeated-rendering");
      }
    }

    if (ts.isFunctionDeclaration(node) && node.name && /^handle[A-Z]/.test(node.name.text)) {
      eventHandlers.add(node.name.text);
      addSnippet(node.name.text, textOf(sourceFile, node), "event-handler");
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /^handle[A-Z]/.test(node.name.text)) {
      eventHandlers.add(node.name.text);
      addSnippet(node.name.text, textOf(sourceFile, node.parent?.parent ?? node), "event-handler");
    }
    if (ts.isJsxAttribute(node)) {
      const attrName = node.name.getText(sourceFile);
      if (/^on[A-Z]/.test(attrName)) {
        eventHandlers.add(attrName);
      }
    }
    if (ts.isConditionalExpression(node) || (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)) {
      conditionalRenders.add(node.getText(sourceFile).slice(0, 80));
      addSnippet("conditional", textOf(sourceFile, node), "conditional-render");
    }
    if (ts.isIdentifier(node) && ["window", "document", "fetch", "localStorage", "sessionStorage"].includes(node.text)) {
      hasSideEffects = true;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  const { sections, jsxDepth } = collectSectionsFromJsx(sourceFile);
  return {
    behavior: {
      hooks: [...hooks],
      stateSummary: [...stateSummary],
      effects: [...effects],
      eventHandlers: [...eventHandlers],
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
  const contract = getPropsInfo(sourceFile, componentName);
  const style = detectStyleSystem(sourceFile);
  const behaviorStructure = collectBehaviorAndStructure(sourceFile);
  const importCount = sourceFile.statements.filter(ts.isImportDeclaration).length;
  const base: Omit<ExtractionResult, "mode"> = {
    filePath,
    fileHash,
    language,
    componentName,
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
