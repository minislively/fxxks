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

export function collectReactNativeListRenderingConcernProfile(result: ExtractionResult): FrontendConcernProfile | undefined {
  const concerns = result.behavior?.rnListRenderingConcerns ?? [];
  if (concerns.length === 0) return undefined;

  const signals = new Set<FrontendConcernSignal>();
  for (const concern of concerns) {
    if (concern.kind === "list-primitive" && concern.primitive === "FlatList") signals.add("rn-flatlist");
    if (concern.kind === "list-primitive" && concern.primitive === "SectionList") signals.add("rn-sectionlist");
    if (concern.kind === "list-primitive" && concern.primitive === "ScrollView") signals.add("rn-scrollview");
    if (concern.kind === "renderItem") signals.add("rn-renderItem");
    if (concern.kind === "keyExtractor") signals.add("rn-keyExtractor");
  }

  if (signals.size === 0) return undefined;

  return {
    kind: "concern",
    id: "rn-list-rendering",
    claim: FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS.rnListRendering,
    signals: uniqueSorted(signals),
    nonAuthorizationBoundary: FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION,
  };
}
