export type FrontendPayloadPolicyDecision = {
  name: string;
  allowed: boolean;
  reason?: string;
  evidenceGates?: string[];
};
