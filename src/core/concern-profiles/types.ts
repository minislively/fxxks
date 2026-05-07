export const FRONTEND_EVIDENCE_PROFILE_KINDS = ["domain", "concern"] as const;

export type FrontendEvidenceProfileKind = (typeof FRONTEND_EVIDENCE_PROFILE_KINDS)[number];

export const FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION =
  "concern-evidence-only; never domain evidence; never standalone compact-payload authorization" as const;

export type FrontendConcernProfileContract = {
  kind: "concern";
  nonAuthorizationBoundary: typeof FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION;
};

export const FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS = {
  formState: "This source contains form-state concern evidence.",
} as const;

export type FrontendConcernProfileId = "form-state";

export type FrontendConcernSignal =
  | "react-hook-form"
  | "useForm"
  | "register"
  | "control"
  | "handleSubmit"
  | "controlled-input"
  | "submit-handler"
  | "default-values"
  | "error-display";

export type FrontendConcernProfile = {
  kind: "concern";
  id: FrontendConcernProfileId;
  claim: (typeof FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS)[keyof typeof FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS];
  signals: FrontendConcernSignal[];
  nonAuthorizationBoundary: typeof FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION;
};
