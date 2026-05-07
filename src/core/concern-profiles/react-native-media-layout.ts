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

export function collectReactNativeMediaLayoutConcernProfile(result: ExtractionResult): FrontendConcernProfile | undefined {
  const concerns = result.behavior?.rnMediaLayoutConcerns ?? [];
  if (concerns.length === 0) return undefined;

  const signals = new Set<FrontendConcernSignal>();
  for (const concern of concerns) {
    if (concern.kind === "media-primitive") signals.add("rn-image");
    if (concern.kind === "resizeMode") signals.add("rn-resizeMode");
    if (concern.kind === "pagingEnabled") signals.add("rn-pagingEnabled");
    if (concern.kind === "dimensions-get") signals.add("rn-dimensions-get");
  }

  if (signals.size === 0) return undefined;

  return {
    kind: "concern",
    id: "rn-media-layout",
    claim: FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS.rnMediaLayout,
    signals: uniqueSorted(signals),
    nonAuthorizationBoundary: FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION,
  };
}
