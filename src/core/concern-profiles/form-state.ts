import fs from "node:fs";
import type { ExtractionResult } from "../schema";
import {
  FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS,
  FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION,
  type FrontendConcernProfile,
  type FrontendConcernSignal,
} from "./types";

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

export function collectFormStateConcernProfile(result: ExtractionResult): FrontendConcernProfile | undefined {
  const sourceText = readSourceText(result.filePath);
  const imports = result.structure?.imports ?? [];
  const signals = new Set<FrontendConcernSignal>();

  if (imports.some((item) => item.moduleSpecifier === "react-hook-form" || item.moduleSpecifier.startsWith("@hookform/"))) {
    signals.add("react-hook-form");
  }

  if (result.behavior?.hooks?.includes("useForm") || sourceText.includes("useForm(")) {
    signals.add("useForm");
  }

  if (result.behavior?.hooks?.includes("useFieldArray") || sourceText.includes("useFieldArray(")) {
    signals.add("useFieldArray");
  }

  if (sourceText.includes("register(") || sourceText.includes("...register(") || /\bregister\b/.test(sourceText)) {
    signals.add("register");
  }

  if (sourceText.includes("control") || sourceText.includes("Controller")) {
    signals.add("control");
  }

  if (sourceText.includes("handleSubmit")) {
    signals.add("handleSubmit");
  }

  if (sourceText.includes("defaultValues")) {
    signals.add("default-values");
  }

  if (sourceText.includes("errors.") || sourceText.includes("errors[") || sourceText.includes("formState.errors") || /\berrors\b/.test(sourceText)) {
    signals.add("error-display");
  }

  if ((result.behavior?.formSurface?.submitHandlers?.length ?? 0) > 0 || sourceText.includes("onSubmit") || sourceText.includes("handleSubmit(")) {
    signals.add("submit-handler");
  }

  if ((result.behavior?.formSurface?.controls?.length ?? 0) > 0 && (signals.has("register") || signals.has("control"))) {
    signals.add("controlled-input");
  }

  if (signals.size === 0) return undefined;

  return {
    kind: "concern",
    id: "form-state",
    claim: FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS.formState,
    signals: uniqueSorted(signals),
    nonAuthorizationBoundary: FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION,
  };
}
