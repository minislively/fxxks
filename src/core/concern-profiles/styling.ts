import fs from "node:fs";
import ts from "typescript";
import type { ExtractionResult } from "../schema";
import {
  FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS,
  FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION,
  type FrontendConcernProfile,
  type FrontendConcernSignal,
} from "./types";

type StylingModule = "clsx" | "class-variance-authority";

type ImportRecord = {
  moduleSpecifier: StylingModule;
  defaultImport?: string;
  namedImports: Map<string, string>;
};

function uniqueSorted<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort() as T[];
}

function readSourceText(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function collectStylingImports(sourceFile: ts.SourceFile): ImportRecord[] {
  const records: ImportRecord[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const moduleSpecifier = statement.moduleSpecifier.text;
    if (moduleSpecifier !== "clsx" && moduleSpecifier !== "class-variance-authority") continue;

    const record: ImportRecord = {
      moduleSpecifier,
      namedImports: new Map<string, string>(),
    };

    const clause = statement.importClause;
    if (clause?.name) record.defaultImport = clause.name.text;
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        record.namedImports.set(element.propertyName?.text ?? element.name.text, element.name.text);
      }
    }

    records.push(record);
  }

  return records;
}

function hasCallExpression(sourceFile: ts.SourceFile, localName: string): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === localName) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

const TAILWIND_UTILITY_PATTERN =
  /\b(?:px-\d+|py-\d+|mx-\d+|my-\d+|p-\d+|m-\d+|flex|grid|gap-\d+|items-[\w-]+|justify-[\w-]+|rounded(?:-[\w-]+)?|bg-[\w-]+|text-[\w-]+|border(?:-[\w-]+)?|sm:|md:|lg:|xl:|hover:|focus:|dark:)\b/;

function hasTailwindUtilityEvidence(sourceFile: ts.SourceFile): boolean {
  let found = false;

  const visit = (node: ts.Node): void => {
    if (found) return;

    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === "className" && node.initializer) {
      if (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer)) {
        if (TAILWIND_UTILITY_PATTERN.test(node.initializer.text)) {
          found = true;
          return;
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
}

export function collectStylingConcernProfile(result: ExtractionResult): FrontendConcernProfile | undefined {
  const sourceText = readSourceText(result.filePath);
  if (!sourceText) return undefined;

  const scriptKind =
    result.language === "tsx"
      ? ts.ScriptKind.TSX
      : result.language === "jsx"
        ? ts.ScriptKind.JSX
        : result.language === "js"
          ? ts.ScriptKind.JS
          : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(result.filePath, sourceText, ts.ScriptTarget.Latest, true, scriptKind);
  const imports = collectStylingImports(sourceFile);
  const signals = new Set<FrontendConcernSignal>();

  for (const record of imports) {
    if (record.moduleSpecifier === "clsx") {
      const defaultImportUsed = record.defaultImport ? hasCallExpression(sourceFile, record.defaultImport) : false;
      const namedImportUsed = [...record.namedImports.values()].some((localName) => hasCallExpression(sourceFile, localName));
      if (defaultImportUsed || namedImportUsed) signals.add("clsx");
      continue;
    }

    const cvaLocalName = record.namedImports.get("cva");
    if (cvaLocalName && hasCallExpression(sourceFile, cvaLocalName)) {
      signals.add("cva");
    }
  }

  if (hasTailwindUtilityEvidence(sourceFile)) {
    signals.add("tailwind-utility");
  }

  if (signals.size === 0) return undefined;

  return {
    kind: "concern",
    id: "styling",
    claim: FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS.styling,
    signals: uniqueSorted(signals),
    nonAuthorizationBoundary: FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION,
  };
}
