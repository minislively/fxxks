import type { ExtractionResult } from "../schema";
import {
  FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS,
  FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION,
  type FrontendConcernProfile,
  type FrontendConcernSignal,
} from "./types";

const ZUSTAND_MODULES = new Set(["zustand"]);
const JOTAI_MODULES = new Set(["jotai"]);
const REDUX_MODULES = new Set(["redux", "react-redux", "@reduxjs/toolkit"]);

function uniqueSorted<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort() as T[];
}

export function collectClientStateConcernProfile(result: ExtractionResult): FrontendConcernProfile | undefined {
  const imports = result.structure?.imports ?? [];
  const signals = new Set<FrontendConcernSignal>();

  for (const item of imports) {
    if (ZUSTAND_MODULES.has(item.moduleSpecifier)) signals.add("zustand");
    if (JOTAI_MODULES.has(item.moduleSpecifier)) signals.add("jotai");
    if (REDUX_MODULES.has(item.moduleSpecifier)) signals.add("redux");
  }

  if (signals.size === 0) return undefined;

  return {
    kind: "concern",
    id: "client-state",
    claim: FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS.clientState,
    signals: uniqueSorted(signals),
    nonAuthorizationBoundary: FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION,
  };
}
