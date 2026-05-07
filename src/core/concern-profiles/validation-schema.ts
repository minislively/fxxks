import fs from "node:fs";
import ts from "typescript";
import type { ExtractionResult } from "../schema";
import {
  FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS,
  FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION,
  type FrontendConcernProfile,
  type FrontendConcernSignal,
} from "./types";

type ValidationLibrary = "zod" | "yup" | "valibot";

type ImportBindings = {
  namespaces: Set<string>;
  named: Set<string>;
};

type SchemaKeyEvidence = {
  librarySignals: Set<ValidationLibrary>;
  schemaKeys: Set<string>;
  usesResolver: boolean;
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

function collectImportBindings(sourceFile: ts.SourceFile): Map<ValidationLibrary, ImportBindings> {
  const byLibrary = new Map<ValidationLibrary, ImportBindings>();

  const ensure = (library: ValidationLibrary): ImportBindings => {
    let current = byLibrary.get(library);
    if (!current) {
      current = { namespaces: new Set<string>(), named: new Set<string>() };
      byLibrary.set(library, current);
    }
    return current;
  };

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const moduleSpecifier = statement.moduleSpecifier.text;
    const library = moduleSpecifier === "zod" || moduleSpecifier === "yup" || moduleSpecifier === "valibot"
      ? moduleSpecifier
      : undefined;
    if (!library) continue;

    const bindings = ensure(library);
    const clause = statement.importClause;
    if (!clause) continue;
    if (clause.name) bindings.namespaces.add(clause.name.text);

    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      bindings.namespaces.add(clause.namedBindings.name.text);
    }

    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        bindings.named.add(element.name.text);
      }
    }
  }

  return byLibrary;
}

function allImportedBindingNames(importsByLibrary: Map<ValidationLibrary, ImportBindings>): Set<string> {
  const names = new Set<string>();

  for (const bindings of importsByLibrary.values()) {
    for (const name of bindings.namespaces) names.add(name);
    for (const name of bindings.named) names.add(name);
  }

  return names;
}

function collectShadowedBindingNames(sourceFile: ts.SourceFile, importedBindingNames: Set<string>): Set<string> {
  const shadowed = new Set<string>();

  const recordBinding = (name: ts.BindingName | ts.PropertyName | undefined): void => {
    if (!name) return;
    if (ts.isIdentifier(name)) {
      if (importedBindingNames.has(name.text)) shadowed.add(name.text);
      return;
    }
    if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const element of name.elements) {
        if (ts.isOmittedExpression(element)) continue;
        recordBinding(element.name);
      }
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isImportClause(node) || ts.isImportSpecifier(node) || ts.isNamespaceImport(node)) {
      ts.forEachChild(node, visit);
      return;
    }

    if (
      ts.isVariableDeclaration(node) ||
      ts.isParameter(node) ||
      ts.isBindingElement(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isEnumDeclaration(node)
    ) {
      recordBinding(node.name);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return shadowed;
}

function expressionLibrary(
  expression: ts.LeftHandSideExpression,
  importsByLibrary: Map<ValidationLibrary, ImportBindings>,
  shadowedBindings: Set<string>,
): ValidationLibrary | undefined {
  if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
    const base = expression.expression.text;
    if (shadowedBindings.has(base)) return undefined;
    for (const [library, bindings] of importsByLibrary.entries()) {
      if ((bindings.namespaces.has(base) || bindings.named.has(base)) && expression.name.text === "object") {
        return library;
      }
    }
  }

  if (ts.isIdentifier(expression)) {
    const name = expression.text;
    if (shadowedBindings.has(name)) return undefined;
    for (const [library, bindings] of importsByLibrary.entries()) {
      if (bindings.named.has(name) && name === "object") {
        return library;
      }
    }
  }

  return undefined;
}

function extractObjectKeys(node: ts.Expression | undefined): string[] {
  if (!node || !ts.isObjectLiteralExpression(node)) return [];

  return node.properties.flatMap((property) => {
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) return [];
    const nameNode = property.name;
    if (ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode)) return [nameNode.text];
    return [];
  });
}

function collectSchemaKeyEvidence(sourceText: string): SchemaKeyEvidence {
  const sourceFile = ts.createSourceFile("validation-schema-concern.tsx", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const importsByLibrary = collectImportBindings(sourceFile);
  const importedBindingNames = allImportedBindingNames(importsByLibrary);
  const shadowedBindings = collectShadowedBindingNames(sourceFile, importedBindingNames);
  const librarySignals = new Set<ValidationLibrary>();
  const schemaKeys = new Set<string>();
  let usesResolver = false;

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callText = node.expression.getText(sourceFile);
      if (/(?:^|\.)(?:zodResolver|yupResolver|valibotResolver)$/.test(callText)) {
        usesResolver = true;
      }

      const library = expressionLibrary(node.expression, importsByLibrary, shadowedBindings);
      if (library) {
        librarySignals.add(library);
        for (const key of extractObjectKeys(node.arguments[0])) schemaKeys.add(key);
      }
    }

    if (ts.isPropertyAssignment(node) && node.name.getText(sourceFile) === "resolver") {
      usesResolver = true;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { librarySignals, schemaKeys, usesResolver };
}

export function collectValidationSchemaConcernProfile(result: ExtractionResult): FrontendConcernProfile | undefined {
  const sourceText = readSourceText(result.filePath);
  if (!sourceText) return undefined;

  const imports = result.structure?.imports ?? [];
  const signals = new Set<FrontendConcernSignal>();

  if (imports.some((item) => item.moduleSpecifier === "zod")) signals.add("zod");
  if (imports.some((item) => item.moduleSpecifier === "yup")) signals.add("yup");
  if (imports.some((item) => item.moduleSpecifier === "valibot")) signals.add("valibot");
  if (imports.some((item) => item.moduleSpecifier.startsWith("@hookform/resolvers/"))) signals.add("resolver");

  if ((result.behavior?.formSurface?.validationAnchors?.some((anchor) => anchor.value === "resolver") ?? false)) {
    signals.add("resolver");
  }

  const schemaKeyEvidence = collectSchemaKeyEvidence(sourceText);
  for (const signal of schemaKeyEvidence.librarySignals) {
    signals.add(signal);
  }
  if (schemaKeyEvidence.usesResolver) {
    signals.add("resolver");
  }
  if (schemaKeyEvidence.schemaKeys.size > 0) {
    signals.add("same-file-schema-keys");
  }

  if (signals.size === 0) return undefined;

  const schemaKeys = uniqueSorted(schemaKeyEvidence.schemaKeys);

  return {
    kind: "concern",
    id: "validation-schema",
    claim: FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS.validationSchema,
    signals: uniqueSorted(signals),
    ...(schemaKeys.length > 0 ? { schemaKeys } : {}),
    nonAuthorizationBoundary: FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION,
  };
}
