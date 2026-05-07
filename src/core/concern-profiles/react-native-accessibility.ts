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

export function collectReactNativeAccessibilityConcernProfile(result: ExtractionResult): FrontendConcernProfile | undefined {
  const anchors = result.behavior?.rnAccessibilityTestAnchors ?? [];
  if (anchors.length === 0) return undefined;

  const signals = new Set<FrontendConcernSignal>();
  for (const anchor of anchors) {
    if (anchor.accessibilityLabel) signals.add("rn-accessibilityLabel");
    if (anchor.accessibilityRole) signals.add("rn-accessibilityRole");
    if (anchor.accessibilityHint) signals.add("rn-accessibilityHint");
    if (anchor.testID) signals.add("rn-testID");
  }

  if (signals.size === 0) return undefined;

  return {
    kind: "concern",
    id: "rn-accessibility-test-anchor",
    claim: FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS.rnAccessibilityTestAnchor,
    signals: uniqueSorted(signals),
    nonAuthorizationBoundary: FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION,
  };
}
