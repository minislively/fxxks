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

export function collectReactNativeNavigationConcernProfile(result: ExtractionResult): FrontendConcernProfile | undefined {
  const concerns = result.behavior?.rnNavigationConcerns ?? [];
  if (concerns.length === 0) return undefined;

  const signals = new Set<FrontendConcernSignal>();
  for (const concern of concerns) {
    if (concern.kind === "navigation-import") signals.add("rn-navigation-import");
    if (concern.kind === "navigation-hook" && concern.hook === "useNavigation") signals.add("rn-useNavigation");
    if (concern.kind === "navigation-hook" && concern.hook === "useRoute") signals.add("rn-useRoute");
    if (concern.kind === "navigation-navigate") signals.add("rn-navigation-navigate");
    if (concern.kind === "route-params") signals.add("rn-route-params");
  }

  if (signals.size === 0) return undefined;

  return {
    kind: "concern",
    id: "rn-navigation",
    claim: FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS.rnNavigation,
    signals: uniqueSorted(signals),
    nonAuthorizationBoundary: FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION,
  };
}
