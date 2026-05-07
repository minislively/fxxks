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
  validationSchema: "This source contains validation/schema concern evidence.",
  clientState: "This source contains client-state concern evidence.",
  rnAccessibilityTestAnchor: "This source contains RN accessibility/test anchor evidence.",
  rnNavigation: "This source contains RN navigation concern evidence.",
  rnStateAction: "This source contains RN state/action concern evidence.",
  routing: "This source contains routing concern evidence.",
} as const;

export type FrontendConcernProfileId =
  | "form-state"
  | "validation-schema"
  | "client-state"
  | "rn-accessibility-test-anchor"
  | "rn-navigation"
  | "rn-state-action"
  | "routing";

export type FrontendConcernSignal =
  | "react-hook-form"
  | "useForm"
  | "register"
  | "control"
  | "handleSubmit"
  | "controlled-input"
  | "submit-handler"
  | "default-values"
  | "error-display"
  | "zod"
  | "yup"
  | "valibot"
  | "resolver"
  | "same-file-schema-keys"
  | "zustand"
  | "jotai"
  | "redux"
  | "rn-accessibilityLabel"
  | "rn-accessibilityRole"
  | "rn-accessibilityHint"
  | "rn-testID"
  | "rn-navigation-import"
  | "rn-useNavigation"
  | "rn-useRoute"
  | "rn-navigation-navigate"
  | "rn-route-params"
  | "rn-useState"
  | "rn-useReducer"
  | "rn-local-setter"
  | "rn-local-dispatch"
  | "rn-same-file-handler"
  | "next-navigation"
  | "next-link"
  | "react-router"
  | "react-router-dom"
  | "Link"
  | "useRouter"
  | "useNavigate"
  | "route-param"
  | "search-param";

export type FrontendConcernProfile = {
  kind: "concern";
  id: FrontendConcernProfileId;
  claim: (typeof FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS)[keyof typeof FRONTEND_CONCERN_PROFILE_ALLOWED_CLAIMS];
  signals: FrontendConcernSignal[];
  schemaKeys?: string[];
  nonAuthorizationBoundary: typeof FRONTEND_CONCERN_PROFILE_NON_AUTHORIZATION;
};
