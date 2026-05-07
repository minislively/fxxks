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

export function collectReactNativeStylePlatformConcernProfile(result: ExtractionResult): FrontendConcernProfile | undefined {
  const concerns = result.behavior?.rnStylePlatformConcerns ?? [];
  if (concerns.length === 0) return undefined;

  const signals = new Set<FrontendConcernSignal>();
  for (const concern of concerns) {
    if (concern.kind === "style-sheet-create") signals.add("rn-style-sheet-create");
    if (concern.kind === "platform-select") signals.add("rn-platform-select");
  }

  if (signals.size === 0) return undefined;

  return {
    kind: "concern",
    id: "rn-style-platform",
    claim: FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS.rnStylePlatform,
    signals: uniqueSorted(signals),
    nonAuthorizationBoundary: FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION,
  };
}
