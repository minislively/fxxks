import type { DomainDetectionResult } from "../domain-detector";
import type { FrontendPayloadPolicyDecision } from "./types";

export const TUI_INK_EVIDENCE_ONLY_PAYLOAD_POLICY = "tui-ink-evidence-only-payload";
export const TUI_INK_EVIDENCE_ONLY_REASON = "tui-ink-evidence-only";

function hasAnySignalWithPrefix(domainDetection: DomainDetectionResult, prefix: string): boolean {
  return domainDetection.signals.some((signal) => signal.startsWith(prefix));
}

export function assessTuiInkPayloadPolicy(domainDetection: DomainDetectionResult): FrontendPayloadPolicyDecision | undefined {
  if (domainDetection.classification !== "tui-ink") return undefined;
  if (!hasAnySignalWithPrefix(domainDetection, "tui-ink:")) return undefined;

  return {
    name: TUI_INK_EVIDENCE_ONLY_PAYLOAD_POLICY,
    allowed: false,
    reason: TUI_INK_EVIDENCE_ONLY_REASON,
  };
}
