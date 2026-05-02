import type { DomainProfileDefinition } from "./types";

export const TUI_INK_DOMAIN_PROFILE: DomainProfileDefinition = {
  lane: "tui-ink",
  evidenceDomain: "tui-ink",
  outcome: "extract",
  claimStatus: "evidence-only",
  fallbackFirst: false,
  claimBoundary: "domain-evidence-only",
};
