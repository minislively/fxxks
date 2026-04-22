export type OutputMode = "raw" | "compressed" | "hybrid";
export type Language = "tsx" | "jsx" | "ts";
export type DecisionConfidence = "high" | "medium" | "low";
export type StyleSystem =
  | "tailwind"
  | "css-modules"
  | "styled-components"
  | "inline-style"
  | "unknown";

export type SourceRange = {
  startLine: number;
  endLine: number;
};

export type SourceFingerprint = {
  fileHash: string;
  lineCount: number;
};

export type LocatedString = {
  value: string;
  loc?: SourceRange;
};

export type EffectSignal = {
  hook: string;
  deps?: string[];
  hasCleanup?: boolean;
  hasAsyncWork?: boolean;
  loc?: SourceRange;
};

export type CallbackSignal = {
  hook: string;
  deps?: string[];
  loc?: SourceRange;
};

export type EventHandlerSignal = {
  name: string;
  trigger?: string;
  loc?: SourceRange;
};

export type FormControlSignal = {
  tag: string;
  name?: string;
  type?: string;
  props?: string[];
  handlers?: string[];
  loc?: SourceRange;
};

export type FormSurface = {
  controls?: FormControlSignal[];
  submitHandlers?: LocatedString[];
  validationAnchors?: LocatedString[];
};

export type PatchTargetKind =
  | "component"
  | "props"
  | "effect"
  | "callback"
  | "event-handler"
  | "form-control"
  | "submit-handler"
  | "validation-anchor"
  | "snippet";

export type PatchTarget = {
  kind: PatchTargetKind;
  label: string;
  loc: SourceRange;
  reason: string;
};

export type EditGuidance = {
  freshness: SourceFingerprint;
  instructions: string[];
  patchTargets: PatchTarget[];
};

export type ExtractionResult = {
  filePath: string;
  fileHash: string;
  language: Language;
  mode: OutputMode;
  useOriginal?: boolean;
  componentName?: string;
  componentLoc?: SourceRange;
  exports: Array<{
    name: string;
    kind: "default" | "named";
    type?: string;
  }>;
  contract?: {
    propsName?: string;
    propsSummary?: string[];
    hasForwardRef?: boolean;
    propsLoc?: SourceRange;
  };
  behavior?: {
    hooks: string[];
    stateSummary?: string[];
    effects?: string[];
    effectSignals?: EffectSignal[];
    callbackSignals?: CallbackSignal[];
    eventHandlers?: string[];
    eventHandlerSignals?: EventHandlerSignal[];
    formSurface?: FormSurface;
    hasSideEffects?: boolean;
  };
  structure?: {
    sections?: string[];
    conditionalRenders?: string[];
    repeatedBlocks?: string[];
    jsxDepth?: number;
  };
  style?: {
    system?: StyleSystem;
    summary?: string[];
    hasStyleBranching?: boolean;
  };
  snippets?: Array<{
    label: string;
    code: string;
    reason: string;
    loc?: SourceRange;
  }>;
  rawText?: string;
  meta: {
    lineCount: number;
    importCount: number;
    rawSizeBytes: number;
    complexityScore?: number;
    generatedAt: string;
    decideReason?: string[];
    decideConfidence?: DecisionConfidence;
  };
};

export type ModelFacingPayload = {
  mode: OutputMode;
  filePath: string;
  useOriginal?: boolean;
  rawText?: ExtractionResult["rawText"];
  componentName?: string;
  componentLoc?: ExtractionResult["componentLoc"];
  sourceFingerprint?: SourceFingerprint;
  exports?: ExtractionResult["exports"];
  contract?: ExtractionResult["contract"];
  behavior?: {
    hooks: string[];
    stateSummary?: string[];
    effects?: string[];
    effectSignals?: EffectSignal[];
    callbackSignals?: CallbackSignal[];
    eventHandlers?: string[];
    eventHandlerSignals?: EventHandlerSignal[];
    formSurface?: FormSurface;
    hasSideEffects?: boolean;
  };
  structure?: {
    sections?: string[];
    conditionalRenders?: string[];
    repeatedBlocks?: string[];
    jsxDepth?: number;
  };
  style?: {
    system?: StyleSystem;
    summary?: string[];
    hasStyleBranching?: boolean;
  };
  snippets?: ExtractionResult["snippets"];
  editGuidance?: EditGuidance;
};

export type PayloadReadiness = {
  ready: boolean;
  reasons: string[];
  signals: {
    mode: ExtractionResult["mode"];
    hasContract: boolean;
    hasBehavior: boolean;
    hasStructure: boolean;
    hasHybridSnippets: boolean;
    usedComplexityScore: false;
    usedDecideReason: false;
  };
};

export type CodexPreReadDecision = {
  runtime: "codex";
  filePath: string;
  eligible: boolean;
  decision: "payload" | "fallback";
  reasons: string[];
  payload?: ModelFacingPayload;
  readiness?: PayloadReadiness;
  debug: {
    mode?: ExtractionResult["mode"];
    complexityScore?: number;
    decideReason?: string[];
    decideConfidence?: DecisionConfidence;
    language?: ExtractionResult["language"];
  };
  fallback?: {
    action: "full-read";
    reason: string;
  };
};


export type PromptSpecificity = "exact-file" | "file-hinted" | "ambiguous";
export type ContextMode = "no-op" | "light" | "light-minimal" | "full" | "auto";

export type ContextBudget = {
  maxFiles: number;
  selectedFiles: number;
  totalBytes: number;
  skippedFiles: number;
};

export type CodexRuntimeHookEvent = "SessionStart" | "UserPromptSubmit" | "Stop";

export type CodexRuntimeHookInput = {
  hookEventName: CodexRuntimeHookEvent;
  prompt?: string;
  sessionId?: string;
  threadId?: string;
  turnId?: string;
  cwd?: string;
};

export type CodexRuntimeHookDecision = {
  runtime: "codex";
  hookEventName: CodexRuntimeHookEvent;
  action: "noop" | "record" | "inject" | "fallback";
  filePath?: string;
  reasons: string[];
  statePath?: string;
  additionalContext?: string;
  contextMode?: ContextMode;
  contextModeReason?: string;
  contextBudget?: ContextBudget;
  promptSpecificity?: PromptSpecificity;
  contextPolicyVersion?: "context-policy.v1";
  debug?: {
    repeatedFile: boolean;
    eligible: boolean;
    escapeHatchUsed: boolean;
    decision?: CodexPreReadDecision;
  };
  fallback?: {
    action: "full-read";
    reason: string;
  };
};

export type CodexNativeHookOutput = {
  hookSpecificOutput: {
    hookEventName: CodexRuntimeHookEvent;
    additionalContext: string;
  };
};

export type IndexEntry = {
  filePath: string;
  fileHash: string;
  fileSizeBytes?: number;
  modifiedAtMs?: number;
  componentName?: string;
  exports: ExtractionResult["exports"];
  propsSummary?: string[];
  hooks: string[];
  styleSystem: StyleSystem;
  mode: OutputMode;
  complexityScore?: number;
  decideReason?: string[];
  decideConfidence?: DecisionConfidence;
  kind: "component" | "linked-ts";
};

export type ScanObservability = {
  timingsMs: {
    discovery: number;
    stat: number;
    fileRead: number;
    hash: number;
    cacheRead: number;
    extract: number;
    cacheWrite: number;
    indexWrite: number;
    total: number;
  };
  counters: {
    fileStatCount: number;
    fileReadCount: number;
    metadataReuseCount: number;
    extractionCacheHits: number;
    extractionCacheMisses: number;
    reparsedFileCount: number;
  };
  discovery: {
    directoriesVisited: number;
    filesVisited: number;
    componentFileCount: number;
    linkedTsCount: number;
    importProbeCount: number;
    importResolveCacheHits: number;
  };
  slowFiles: Array<{
    filePath: string;
    kind: "component" | "linked-ts";
    action: "reused" | "refreshed";
    totalMs: number;
  }>;
};

export type ScanResult = {
  projectRoot: string;
  scannedAt: string;
  files: IndexEntry[];
  reusedCacheEntries: number;
  refreshedEntries: number;
  observability?: ScanObservability;
};

export type CodexTrustLifecycleState =
  | "disconnected"
  | "indexing"
  | "ready"
  | "stale"
  | "refreshing"
  | "attach-prepared";

export type CodexActiveFileContext = {
  filePath: string;
  source: "prompt-target";
};

export type CodexTrustStatus = {
  runtime: "codex";
  connectionState: "connected" | "disconnected";
  lifecycleState: CodexTrustLifecycleState;
  attachedAt?: string;
  lastScanAt?: string;
  lastRefreshAt?: string;
  lastAttachPreparedAt?: string;
  activeFile?: CodexActiveFileContext;
  updatedAt: string;
};

export type AttachResult = {
  runtime: "codex" | "claude";
  accountContext: string;
  filesCreated: string[];
  contractProof: {
    passed: boolean;
    details: string[];
  };
  // Local attach/readiness check only. A passed status means fooks wrote the
  // expected runtime artifact; it is not Codex runtime-token telemetry.
  runtimeProof: {
    status: "passed" | "blocked";
    details: string[];
    attemptedAt?: string;
    artifactPath?: string;
    blocker?: string;
  };
  trustStatus?: CodexTrustStatus;
};
