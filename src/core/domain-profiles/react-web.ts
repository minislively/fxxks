import type { DomainProfileDefinition } from "./types";

export const REACT_WEB_DOMAIN_PROFILE: DomainProfileDefinition = {
  lane: "react-web",
  evidenceDomain: "react-web",
  outcome: "extract",
  claimStatus: "current-supported-lane",
  fallbackFirst: false,
  claimBoundary: "react-web-measured-extraction",
};
