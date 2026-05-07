import {
  FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS,
  FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION,
  type FrontendConcernProfile,
  type FrontendConcernSignal,
} from "./types";
import type { ExtractionResult } from "../schema";

function uniqueSorted<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort() as T[];
}

export function collectReactNativeStateActionConcernProfile(result: ExtractionResult): FrontendConcernProfile | undefined {
  const concerns = result.behavior?.rnStateActionConcerns ?? [];
  if (concerns.length === 0) return undefined;

  const signals = new Set<FrontendConcernSignal>();
  for (const concern of concerns) {
    if (concern.hook === "useState") signals.add("rn-useState");
    if (concern.hook === "useReducer") signals.add("rn-useReducer");
    if (concern.mutatorKind === "setter") signals.add("rn-local-setter");
    if (concern.mutatorKind === "dispatch") signals.add("rn-local-dispatch");
    if (concern.actionSource === "same-file-inline" || concern.actionSource === "same-file-local") {
      signals.add("rn-same-file-handler");
    }
  }

  if (signals.size === 0) return undefined;

  return {
    kind: "concern",
    id: "rn-state-action",
    claim: FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS.rnStateAction,
    signals: uniqueSorted(signals),
    nonAuthorizationBoundary: FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION,
  };
}
