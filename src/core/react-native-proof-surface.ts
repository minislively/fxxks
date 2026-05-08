import type { ReactNativeSourceAnchorBetaPayload } from "./payload/domain-payload";
import type { ModelFacingPayload } from "./schema";

export const RN_SOURCE_ANCHOR_VISIBILITY_CLAIM_BOUNDARY = "source-backed-rn-located-anchor-visibility-only" as const;

export type ReactNativeSourceAnchorBetaSummary = {
  present: true;
  schemaVersion: typeof RN_SOURCE_ANCHOR_VISIBILITY_CLAIM_BOUNDARY;
  proofSurface: "compare";
  contractVersion: ReactNativeSourceAnchorBetaPayload["contract"]["contractVersion"];
  scope: ReactNativeSourceAnchorBetaPayload["contract"]["scope"];
  runtimeReusePromotion: ReactNativeSourceAnchorBetaPayload["contract"]["runtimeReusePromotion"];
  allowedProofSurfaces: string[];
  componentName?: string;
  propsName?: string;
  hookCount: number;
  eventHandlerCount: number;
  primitiveCount: number;
  jsxPropCount: number;
  locatedAnchorCount: number;
  locatedAnchorPreview: Array<{
    kind: ReactNativeSourceAnchorBetaPayload["anchors"]["locatedAnchors"][number]["kind"];
    label: string;
  }>;
  claimBoundary: typeof RN_SOURCE_ANCHOR_VISIBILITY_CLAIM_BOUNDARY;
};

export type InspectDomainReactNativeSourceAnchorBeta = {
  schemaVersion: 1;
  proofSurface: "inspect-domain";
  contractVersion: ReactNativeSourceAnchorBetaPayload["contract"]["contractVersion"];
  scope: ReactNativeSourceAnchorBetaPayload["contract"]["scope"];
  runtimeReusePromotion: ReactNativeSourceAnchorBetaPayload["contract"]["runtimeReusePromotion"];
  sourceDerivedOnly: true;
  allowedProofSurfaces: string[];
  claimBoundary: typeof RN_SOURCE_ANCHOR_VISIBILITY_CLAIM_BOUNDARY;
  anchors: ReactNativeSourceAnchorBetaPayload["anchors"];
};

function sourceAnchorBetaFrom(payload: ModelFacingPayload): ReactNativeSourceAnchorBetaPayload | undefined {
  if (payload.domainPayload?.domain !== "react-native") return undefined;
  return payload.domainPayload.sourceAnchorBeta;
}

export function reactNativeSourceAnchorBetaSummaryFor(payload: ModelFacingPayload): ReactNativeSourceAnchorBetaSummary | undefined {
  const sourceAnchorBeta = sourceAnchorBetaFrom(payload);
  if (!sourceAnchorBeta || !sourceAnchorBeta.contract.allowedProofSurfaces.includes("compare")) return undefined;

  return {
    present: true,
    schemaVersion: RN_SOURCE_ANCHOR_VISIBILITY_CLAIM_BOUNDARY,
    proofSurface: "compare",
    contractVersion: sourceAnchorBeta.contract.contractVersion,
    scope: sourceAnchorBeta.contract.scope,
    runtimeReusePromotion: sourceAnchorBeta.contract.runtimeReusePromotion,
    allowedProofSurfaces: [...sourceAnchorBeta.contract.allowedProofSurfaces],
    ...(sourceAnchorBeta.anchors.componentName ? { componentName: sourceAnchorBeta.anchors.componentName } : {}),
    ...(sourceAnchorBeta.anchors.propsName ? { propsName: sourceAnchorBeta.anchors.propsName } : {}),
    hookCount: sourceAnchorBeta.anchors.hooks?.length ?? 0,
    eventHandlerCount: sourceAnchorBeta.anchors.eventHandlers?.length ?? 0,
    primitiveCount: sourceAnchorBeta.anchors.primitives.length,
    jsxPropCount: sourceAnchorBeta.anchors.jsxProps.length,
    locatedAnchorCount: sourceAnchorBeta.anchors.locatedAnchors.length,
    locatedAnchorPreview: sourceAnchorBeta.anchors.locatedAnchors.slice(0, 5).map((anchor) => ({
      kind: anchor.kind,
      label: anchor.label,
    })),
    claimBoundary: RN_SOURCE_ANCHOR_VISIBILITY_CLAIM_BOUNDARY,
  };
}

export function formatReactNativeSourceAnchorBetaSummary(summary: ReactNativeSourceAnchorBetaSummary): string {
  return `RN visibility: ${summary.locatedAnchorCount} local-proof-only located anchors across ${summary.primitiveCount} primitives / ${summary.jsxPropCount} JSX props; additive compare summary only, not runtime or support proof (see --json).`;
}

export function inspectDomainReactNativeSourceAnchorBetaFor(
  payload: ModelFacingPayload,
): InspectDomainReactNativeSourceAnchorBeta | undefined {
  const sourceAnchorBeta = sourceAnchorBetaFrom(payload);
  if (!sourceAnchorBeta || !sourceAnchorBeta.contract.allowedProofSurfaces.includes("inspect-domain")) return undefined;

  return {
    schemaVersion: 1,
    proofSurface: "inspect-domain",
    contractVersion: sourceAnchorBeta.contract.contractVersion,
    scope: sourceAnchorBeta.contract.scope,
    runtimeReusePromotion: sourceAnchorBeta.contract.runtimeReusePromotion,
    sourceDerivedOnly: true,
    allowedProofSurfaces: [...sourceAnchorBeta.contract.allowedProofSurfaces],
    claimBoundary: RN_SOURCE_ANCHOR_VISIBILITY_CLAIM_BOUNDARY,
    anchors: sourceAnchorBeta.anchors,
  };
}
