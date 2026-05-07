import fs from "node:fs";
import ts from "typescript";
import type { ExtractionResult } from "../schema";
import {
  FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS,
  FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION,
  type FrontendConcernProfile,
  type FrontendConcernSignal,
} from "./types";

type RoutingModule = "next/navigation" | "next/link" | "react-router" | "react-router-dom";

type ImportRecord = {
  moduleSpecifier: RoutingModule;
  defaultImport?: string;
  namedImports: Map<string, string>;
};

const ROUTING_MODULE_SIGNALS: Record<RoutingModule, FrontendConcernSignal> = {
  "next/navigation": "next-navigation",
  "next/link": "next-link",
  "react-router": "react-router",
  "react-router-dom": "react-router-dom",
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

function collectRoutingImports(sourceFile: ts.SourceFile): ImportRecord[] {
  const records: ImportRecord[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const moduleSpecifier = statement.moduleSpecifier.text;
    if (moduleSpecifier !== "next/navigation" && moduleSpecifier !== "next/link" && moduleSpecifier !== "react-router" && moduleSpecifier !== "react-router-dom") {
      continue;
    }

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

function hasHookCall(sourceFile: ts.SourceFile, localName: string): boolean {
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

function hasJsxElementUsage(sourceFile: ts.SourceFile, localName: string): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName) && node.tagName.text === localName) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

export function collectRoutingConcernProfile(result: ExtractionResult): FrontendConcernProfile | undefined {
  const sourceText = readSourceText(result.filePath);
  if (!sourceText) return undefined;

  const sourceFile = ts.createSourceFile(result.filePath, sourceText, ts.ScriptTarget.Latest, true, result.language === "tsx" || result.language === "jsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const imports = collectRoutingImports(sourceFile);
  if (imports.length === 0) return undefined;

  const signals = new Set<FrontendConcernSignal>();
  let sawExplicitParamHook = false;
  let sawExplicitSearchParamHook = false;

  for (const record of imports) {
    signals.add(ROUTING_MODULE_SIGNALS[record.moduleSpecifier]);

    if (record.moduleSpecifier === "next/link") {
      if ((record.defaultImport && hasJsxElementUsage(sourceFile, record.defaultImport)) || record.defaultImport) {
        signals.add("Link");
      }
    }

    const linkLocal = record.namedImports.get("Link");
    if (linkLocal) {
      signals.add("Link");
    }

    const navigateLocal = record.namedImports.get("useNavigate");
    if (navigateLocal && hasHookCall(sourceFile, navigateLocal)) {
      signals.add("useNavigate");
    }

    const routerLocal = record.namedImports.get("useRouter");
    if (routerLocal && hasHookCall(sourceFile, routerLocal)) {
      signals.add("useRouter");
    }

    const paramsLocal = record.namedImports.get("useParams");
    if (paramsLocal && hasHookCall(sourceFile, paramsLocal)) {
      sawExplicitParamHook = true;
    }

    const searchParamsLocal = record.namedImports.get("useSearchParams");
    if (searchParamsLocal && hasHookCall(sourceFile, searchParamsLocal)) {
      sawExplicitSearchParamHook = true;
    }
  }

  if (sawExplicitParamHook) signals.add("route-param");
  if (sawExplicitSearchParamHook) signals.add("search-param");

  return {
    kind: "concern",
    id: "routing",
    claim: FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS.routing,
    signals: uniqueSorted(signals),
    nonAuthorizationBoundary: FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION,
  };
}
