# fooks v2 Benchmark Taxonomy & Metrics Schema (v2 Final Draft)

> 목적: 기능 추가 후에도 실제 프론트 작업에서 토큰 절감 효과가 유지되는지 추적하는 계측 체계  
> 원칙: **토큰 절감 + 의미 보존 + 회귀 감지** 3축이 한 artifact에서 동시에 보임

---

## 1. Repo Taxonomy Table

실제 frontend-harness에 정의된 6개 리포 기준.

| # | Repository | Why Included | Representative Buckets | Excluded Paths | Source Roots | Product Relevance | Blind Spots |
|---|------------|--------------|------------------------|----------------|--------------|-------------------|-------------|
| 1 | **shadcn-ui/ui** | Modern component library, radix primitives 래핑, real-world adoption 높음 | presentational, form-heavy, style-heavy, hook-heavy | `apps/www/`, `scripts/`, `templates/`, `*.stories.tsx` | `apps/*/`, `packages/*/components` | Component design system reference | Meta-framework coupling 없음 (pure components) |
| 2 | **calcom/cal.com** | Complex scheduling UI, enterprise forms, multi-tenant conditional rendering | form-heavy, conditional-heavy, large-mixed, real-edit | `apps/api/`, `packages/trpc/`, `playwright/`, `test/` | `apps/web/components/`, `packages/ui/` | Real SaaS product complexity | Backend/API 코드 섞임 |
| 3 | **documenso/documenso** | Document signing flow, PDF preview, async state management | form-heavy, conditional-heavy, real-edit | `test/`, `scripts/`, `docker/`, `*.spec.ts` | `apps/web/app/`, `apps/web/components/` | Document workflow UI | PDF-specific logic coverage |
| 4 | **formbricks/formbricks** | Survey builder, dynamic form generation, analytics dashboard | form-heavy, hook-heavy, conditional-heavy | `playwright/`, `test/`, `scripts/`, `*.test.tsx` | `apps/web/app/`, `packages/ui/` | Survey/form product | Form complexity upper bound |
| 5 | **vercel/next.js** | Meta-framework itself, App Router patterns, Server Components | conditional-heavy, large-mixed, hook-heavy | `test/`, `scripts/`, `bench/`, `examples/` | `packages/next/`, `packages/next/src/` | Framework reference | Framework vs product 코드 구분 필요 |
| 6 | **tailwindlabs/tailwindcss** | Utility-first styling, style-heavy reference, JIT engine | style-heavy, presentational | `tests/`, `scripts/`, `playground/`, `stubs/` | `src/`, `packages/*/src` | CSS framework | Non-React codebase (추출 로직 테스트용) |

---

## 2. Bucket Definition Table

| Bucket | Intent | Inclusion Rule | Exclusion Rule | Primary Metrics | Failure Smell | Sample Target |
|--------|--------|----------------|----------------|-----------------|---------------|---------------|
| **tiny-raw** | Overhead baseline. 작은 payload에서도 fooks가 유리한가 측정 | `rawBytes < 500`, `mode === "raw"`, low JSX depth (≤ 2), low conditional count | generated/vendor/test fixture noise, large style payload inflation, non-frontend utility file | `rawBytes`, `payloadBytes`, `overheadRatio`, `useOriginalRatio` | `overheadRatio > 0.20` or `useOriginalRatio > 0.10` | 20 |
| **simple-presentational** | Props 기반 표현만, state 없음 | `rawBytes 500-2000`, props-only, hooks == 0, contract defined | Conditional branches > 2, nested components > 3 | `contractSignal`, `signatureExtractionQuality`, `tokenSavings` | `contractSignal < 0.95` or props 누락 | 30 |
| **form-heavy** | Form complexity. 실제 수정 작업 시 토큰 절감 | Input/Select/Validation ≥ 3, controlled state ≥ 2, contract explicit | No validation logic, purely presentational | `formSchemaQuality`, `contractSignal`, `behaviorSignal`, `editTaskTokenSavings` | `behaviorSignal < 0.90` or validation rule 누락 | 25 |
| **hook-heavy** | Custom hook 패턴. 추출 후 수정 작업 품질 | Custom hooks ≥ 3, useState/useEffect ≥ 5, hook contract visible | Inline hook logic (non-reusable), anonymous hooks | `hookExtractionQuality`, `contractSignal`, `behaviorSignal`, `hookEditSavings` | `contractSignal < 0.95` or hook dependency array 손실 | 25 |
| **conditional-heavy** | 조건부 렌더링 complexity | Conditional branches ≥ 5 (if/ternary/&&), active path determinable | Static JSX only, ambiguous branches | `conditionalPathCoverage`, `branchExtractionAccuracy`, `structureSignal` | `structureSignal < 0.90` or dead branch 포함 | 20 |
| **style-heavy** | Style complexity. Tailwind 클래스 압축 | Tailwind classes ≥ 20 OR CSS-in-JS complexity > threshold, style contract visible | No styling (logic-only files), inline styles only | `classCompressionRatio`, `styleEditSavings`, `contractSignal` | `contractSignal < 0.95` or class order 변경으로 스타일 깨짐 | 20 |
| **large-mixed** | Production-scale 파일. Partial extraction 품질 | `rawBytes > 8000`, 2+ bucket indicators, component boundaries clear | Auto-generated code, minified sources | `partialExtractionQuality`, `realEditSavings`, `structureSignal`, `modeDistribution` | `structureSignal < 0.85` or component boundary 오분류 | 15 |
| **real-edit-task** | 실제 PR에서 추출한 수정 작업 | Patch size 50-500 bytes, from merged PRs, task completion verifiable | Auto-generated changes, purely additive | `endToEndTokenSavings`, `editTaskSuccess`, `retryCount`, `successRate` | `editTaskSuccess == false` or `retryNeeded > 2` | 30 |

### 2.1 tiny-raw Classification Detail

```typescript
// Primary gate (hard requirement)
const isTinyRaw = (
  rawBytes < 500 &&
  extractionMode === "raw"  // fooks mode decision
);

// Secondary hints (soft signals, affect ranking not inclusion)
const hints = {
  jsxDepth: jsxDepth <= 2 ? "good" : "warning",
  conditionalCount: conditionalCount <= 2 ? "good" : "warning",
  structuralBranching: structuralBranching <= 1 ? "good" : "warning",
  hookCount: hookCount === 0 ? "optimal" : hookCount <= 1 ? "acceptable" : "penalty"
};

// Exclusion (hard no)
const isExcluded = (
  isGeneratedCode ||           // vendor/test fixture noise
  stylePayloadBytes > 200 ||   // large style payload inflation
  isNonFrontendUtility         // utility files, not components
);

// Classification confidence score
const confidence = calculateConfidence({
  primary: isTinyRaw,
  hints,
  exclusion: !isExcluded
});
```

---

## 3. Sample Selection Spec

### 3.1 Repo Revision Pinning

```typescript
interface RepoPin {
  name: string;           // "shadcn-ui"
  remote: string;         // "https://github.com/shadcn-ui/ui"
  revision: string;       // "a1b2c3d" (short commit hash)
  pinnedAt: string;       // ISO 8601 timestamp
  totalFiles: number;   // TSX/TS files at pin time
  sourceRoot: string;     // "apps/*/components"
}

// Pinning process
// 1. Clone repo (depth 1 for latest, or full for history)
// 2. Record HEAD commit hash
// 3. Lock in benchmark manifest
// 4. Any revision change = new baseline
```

### 3.2 Path Filtering

```typescript
const EXCLUSION_PATTERNS = [
  // Test files
  "**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}",
  "**/test/**", "**/tests/**", "**/playwright/**",
  
  // Config/Scripts
  "**/scripts/**", "**/config/**", "**/stubs/**",
  
  // Generated
  "**/*.generated.{ts,tsx}", "**/dist/**", "**/.next/**",
  
  // Stories (if any)
  "**/*.stories.{ts,tsx}", "**/*.story.{ts,tsx}",
  
  // Non-source
  "**/node_modules/**", "**/coverage/**"
];

const INCLUSION_PATTERNS = [
  "**/*.tsx",      // React components
  "**/*.ts"        // TS modules (exclude if no React patterns)
];
```

### 3.3 Candidate Discovery

```typescript
function discoverCandidates(repoPath: string): FileCandidate[] {
  const allFiles = glob("**/*.{ts,tsx}", { 
    cwd: repoPath,
    ignore: EXCLUSION_PATTERNS 
  });
  
  return allFiles.map(file => ({
    path: file,
    rawBytes: getFileSize(file),
    hasReact: detectReactPatterns(file),  // JSXElement, hooks
    metrics: extractQuickMetrics(file)     // hooks count, conditionals, classes
  })).filter(c => c.hasReact);  // React 파일만
}
```

### 3.4 Bucket Classification

```typescript
function classifyBucket(candidate: FileCandidate): Bucket | null {
  const { rawBytes, hooks, conditionals, classes, formElements, jsxDepth } = candidate.metrics;
  
  // Priority order matters (most specific first)
  // tiny-raw: rawBytes primary, hooks penalty signal (not hard exclusion)
  if (rawBytes < 500 && jsxDepth <= 2) {
    return { bucket: "tiny-raw", confidence: hooks > 0 ? "medium" : "high" };
  }
  if (formElements >= 3) return { bucket: "form-heavy", confidence: "high" };
  if (hooks >= 3) return { bucket: "hook-heavy", confidence: "high" };
  if (conditionals >= 5) return { bucket: "conditional-heavy", confidence: "high" };
  if (classes >= 20) return { bucket: "style-heavy", confidence: "high" };
  if (rawBytes > 8000) return { bucket: "large-mixed", confidence: "high" };
  if (rawBytes >= 500 && rawBytes <= 2000 && hooks === 0) {
    return { bucket: "simple-presentational", confidence: "high" };
  }
  
  return null;  // Unclassified, skip
}
```

### 3.5 Deterministic Ranking

```typescript
// Seed = repo revision + bucket name + fooks version
const seed = `${repoRevision}:${bucketName}:v2`;
const rng = createSeededRNG(seed);

// Within bucket, rank by diversity score (avoid similar files)
function diversityScore(file: FileCandidate): number {
  // Higher = more unique characteristics
  return hash(file.path) + 
         file.metrics.hooks * 100 + 
         file.metrics.conditionals * 10;
}

const ranked = bucketFiles
  .sort((a, b) => diversityScore(b) - diversityScore(a))
  .map((f, i) => ({ ...f, diversityRank: i }));
```

### 3.6 Fixed-Count Sampling

```typescript
const BUCKET_TARGETS = {
  "tiny-raw": 20,
  "simple-presentational": 30,
  "form-heavy": 25,
  "hook-heavy": 25,
  "conditional-heavy": 20,
  "style-heavy": 20,
  "large-mixed": 15,
  "real-edit-task": 30
};

function sampleBucket(files: FileCandidate[], bucket: string, rng: RNG): SampleResult {
  const target = BUCKET_TARGETS[bucket];
  
  if (files.length < target) {
    // Deficit handling: NO arbitrary supplementation
    // Take all available, flag as undersampled
    return {
      samples: files,
      target: target,
      actual: files.length,
      deficit: target - files.length,
      deficitRatio: (target - files.length) / target,
      status: "undersampled",
      note: "INSUFFICIENT_CANDIDATES: No arbitrary supplementation performed"
    };
  }
  
  // Shuffle with seeded RNG, take first N
  const shuffled = seededShuffle(files, rng);
  return {
    samples: shuffled.slice(0, target),
    target: target,
    actual: target,
    deficit: 0,
    deficitRatio: 0,
    status: "complete"
  };
}
```

### 3.7 Deficit Handling (Critical - Revised)

```typescript
interface DeficitReport {
  bucket: string;
  target: number;
  available: number;
  deficit: number;
  deficitRatio: number;        // deficit / target
  status: "undersampled" | "undersampled-high-risk" | "excluded-from-gating";
  arbitrarySupplementation: false;  // ALWAYS false
  crossBucketSubstitution: false;   // ALWAYS false
  details: string;
  baselineCompareNote: string; // "Same-coverage: false" if undersampled
}

// STRICT RULES (REVISED - NO CROSS-BUCKET):
// - deficitRatio < 0.30: "undersampled" - usable but flagged
// - deficitRatio >= 0.30: "undersampled-high-risk" - gating with caution  
// - deficitRatio >= 0.50: "excluded-from-gating" - exclude bucket from comparative gating
// - NO cross-bucket substitution (bucket purity preserved)
// - NO arbitrary supplementation (random files 추가 금지)
// - ALWAYS record deficit in manifest for baseline comparison

const deficitRules = {
  undersampled: {
    threshold: 0.30,
    status: "undersampled",
    gating: "use-with-caution",
    sameCoverage: false
  },
  highRisk: {
    threshold: 0.50,
    status: "undersampled-high-risk", 
    gating: "exclude-from-comparative",
    sameCoverage: false
  },
  excluded: {
    status: "excluded-from-gating",
    gating: "do-not-gate",
    sameCoverage: false
  }
};

// Cross-bucket substitution is FORBIDDEN
// Same repo, same bucket candidates ONLY
```

### 3.8 Artifact Metadata

```typescript
interface SampleArtifact {
  // Identity
  id: string;                    // UUID
  repo: string;                  // "shadcn-ui"
  revision: string;              // "a1b2c3d"
  filePath: string;              // "apps/web/components/Button.tsx"
  bucket: string;                // "form-heavy"
  
  // Classification proof
  classification: {
    bucket: string;
    metrics: {
      rawBytes: number;          // PRIMARY
      jsxDepth: number;          // Secondary hint
      hooks: number;
      conditionals: number;
      classes: number;
      formElements: number;
    };
    confidence: "high" | "medium" | "low";
  };
  
  // Extraction result
  extraction: {
    fooksVersion: string;
    extractedAt: string;
    rawBytes: number;            // Original file size
    payloadBytes: number;        // Extracted size
    overheadRatio: number;       // (payload - contract) / payload
    useOriginalRatio: number;    // useOriginal cases / total
    
    // Quality signals
    contractSignal: number;      // 0-1, contract preservation
    behaviorSignal: number;        // 0-1, runtime behavior preservation  
    structureSignal: number;     // 0-1, AST structure preservation
    
    // Mode distribution
    modeDistribution: {
      extract: number;           // Count
      contract: number;
      original: number;
    };
    
    // Readiness & fallback
    readinessReasons: string[];  // Why this mode was selected
    fallbackReasonBreakdown: Record<string, number>; // parse-error: 3, too-small: 5, ...
    
    fallback?: {
      used: boolean;
      reason?: string;
    };
  };
  
  // Task execution (for real-edit-task bucket)
  taskExecution?: {
    taskId: string;
    editTaskSuccess: boolean;    // Task completed as intended
    retryCount: number;          // How many retries needed
    retryNeeded: boolean;        // retryCount > 0
    
    vanilla: {
      durationMs: number;
      success: boolean;
      filesModified: number;
      error?: string;
    };
    fooks: {
      durationMs: number;
      scanTimeMs: number;
      totalTimeMs: number;
      success: boolean;
      filesModified: number;
      error?: string;
    };
    improvement: {
      execTimePct: number;
      totalTimePct: number;
    };
  };
  
  // Provenance
  pinnedAt: string;
  selectedBy: string;            // "deterministic:v2:a1b2c3d:form-heavy"
  deficitFlag?: boolean;         // true if undersampled
}
```

---

## 4. Baseline Report Schema

### 4.1 Run Metadata

```typescript
interface RunMetadata {
  // Identity
  runId: string;                 // UUID
  timestamp: string;             // ISO 8601
  fooksVersion: string;          // "2.1.3"
  harnessVersion: string;        // "v2"
  
  // Configuration
  config: {
    repos: string[];             // ["shadcn-ui", "cal.com", ...]
    buckets: string[];           // All 8 buckets
    samplesPerBucket: number;    // Target counts
    seed: string;                // Deterministic seed
  };
  
  // Environment
  environment: {
    nodeVersion: string;
    codexVersion: string;
    omxVersion: string;
  };
}
```

### 4.2 Gating View (Summary for Quick Decision)

```typescript
interface GatingView {
  // Overall status
  overallStatus: "pass" | "warn" | "fail";
  
  // Blockers
  blockerBuckets: Array<{
    bucket: string;
    repo: string;
    reason: string;
    metric: string;
    threshold: number;
    actual: number;
  }>;
  
  // Changes from baseline
  topRegressions: Array<{
    bucket: string;
    metric: string;
    delta: number;
    deltaRatio: number;
    severity: "critical" | "warning";
  }>;
  
  topImprovements: Array<{
    bucket: string;
    metric: string;
    delta: number;
    deltaRatio: number;
  }>;
  
  // Coverage integrity
  sameCoverage: boolean;           // true if no deficit
  coverageDeficits: Array<{
    bucket: string;
    repo: string;
    deficitRatio: number;
    status: "undersampled" | "undersampled-high-risk" | "excluded-from-gating";
  }>;
  
  // Confidence & recommendation
  gatingConfidence: "high" | "medium" | "low";  // based on coverage integrity
  recommendedAction: 
    | "proceed" 
    | "proceed-with-caution" 
    | "investigate-blockers" 
    | "do-not-gate";
  
  // Quick metrics
  summaryMetrics: {
    avgTokenSavingsRatio: number;
    minQualitySignal: number;      // min(contract, behavior, structure)
    maxRegressionDelta: number;
    fallbackRate: number;
  };
}
```

### 4.3 Per-Repo Summary

```typescript
interface RepoSummary {
  repo: string;                  // "shadcn-ui"
  revision: string;              // "a1b2c3d"
  
  // Scope
  totalFiles: number;            // Total TSX/TS files
  includedFiles: number;         // After filtering
  excludedPaths: string[];       // Applied exclusion patterns
  
  // 3축 통합 metrics
  metrics: {
    // 토큰 절감측
    avgTokenSavings: number;
    avgSavingsRatio: number;
    avgCompressionRatio: number;
    
    // 의미 보존측
    avgContractSignal: number;
    avgBehaviorSignal: number;
    avgStructureSignal: number;
    
    // 효율/회귀 감지측
    fallbackRate: number;
    coldScanAvgMs: number;
    warmScanAvgMs: number;
    cacheHitRatio: number;
    
    // Mode & fallback breakdown
    modeDistribution: {
      extract: number;
      contract: number;
      original: number;
    };
    fallbackReasonBreakdown: Record<string, number>;
    
    // Edit task quality
    editTaskSuccessRate?: number;
    avgRetryCount?: number;
    retryNeededRate?: number;
  };
  
  // Bucket coverage with deficit tracking
  bucketCounts: Record<string, {
    target: number;
    actual: number;
    deficit: number;
    deficitRatio: number;
    status: "complete" | "undersampled" | "undersampled-high-risk" | "excluded-from-gating";
  }>;
  
  // Deficit summary for baseline compare
  deficitSummary: {
    totalDeficitBuckets: number;
    totalDeficitSamples: number;
    sameCoverage: boolean;       // false if any bucket undersampled
  };
  
  // Alerts for this repo
  alerts: Alert[];
}
```

### 4.4 Per-Bucket Summary

```typescript
interface BucketSummary {
  bucket: string;                // "form-heavy"
  
  // Sample stats with deficit
  targetSamples: number;
  actualSamples: number;
  deficit: number;
  deficitRatio: number;
  status: "complete" | "undersampled" | "undersampled-high-risk" | "excluded-from-gating";
  
  // 3축 통합 metrics
  metrics: {
    // 토큰 절감
    avgRawTokens: number;
    avgExtractedTokens: number;
    avgTokenSavings: number;
    avgSavingsRatio: number;
    
    minSavingsRatio: number;
    maxSavingsRatio: number;
    p50SavingsRatio: number;
    p90SavingsRatio: number;
    
    // 의미 보존
    avgContractSignal: number;
    avgBehaviorSignal: number;
    avgStructureSignal: number;
    minStructureSignal: number;
    
    // 효율/품질
    fallbackCount: number;
    fallbackRate: number;
    fallbackReasonBreakdown: Record<string, number>;
    modeDistribution: {
      extract: number;
      contract: number;
      original: number;
    };
    
    // Edit task quality
    editTaskSuccessRate?: number;
    avgRetryCount?: number;
    retryNeededRate?: number;
  };
  
  // Bucket-specific KPI (3축)
  kpi: {
    tokenSavings: { value: number; threshold: number; status: "pass" | "warn" | "fail" };
    meaningPreservation: { value: number; threshold: number; status: "pass" | "warn" | "fail" };
    efficiency: { value: number; threshold: number; status: "pass" | "warn" | "fail" };
  };
  
  // Cross-bucket comparison (vs other repos same bucket)
  comparison?: {
    repoRank: number;
    avgSavingsRank: number;
    avgQualityRank: number;
  };
}
```

### 4.5 Per-Sample / Per-Task Detail

```typescript
interface SampleDetail {
  // Identity
  sampleId: string;
  repo: string;
  bucket: string;
  filePath: string;
  
  // File metrics (raw bytes 기준)
  fileMetrics: {
    rawBytes: number;            // PRIMARY metric
    loc: number;                 // Secondary hint only
    rawTokens: number;           // Approx (bytes / 4)
  };
  
  // Extraction result with quality signals
  extraction: {
    success: boolean;
    rawBytes: number;
    payloadBytes: number;
    tokenSavings: number;
    savingsRatio: number;
    compressionRatio: number;
    overheadRatio: number;
    useOriginalRatio: number;
    
    // Quality signals (의미 보존측)
    contractSignal: number;      // 0-1, interface preservation
    behaviorSignal: number;        // 0-1, runtime behavior preservation
    structureSignal: number;       // 0-1, AST structure preservation
    
    // Mode distribution
    modeDistribution: {
      extract: number;
      contract: number;
      original: number;
    };
    
    // Readiness & fallback tracking
    readinessReasons: string[];
    fallbackReasonBreakdown: Record<string, number>;
    
    scanTimeMs: {
      cold: number;
      warm: number;
    };
    
    fallback: {
      used: boolean;
      reason?: string;
    };
    
    // Extracted structure (for verification)
    structure?: {
      componentCount: number;
      hookCount: number;
      propInterfaces: string[];
    };
  };
  
  // Task execution (for real-edit-task bucket)
  taskExecution?: {
    taskId: string;
    
    // Quality tracking
    editTaskSuccess: boolean;      // Task completed as intended
    retryCount: number;          // How many retries needed
    retryNeeded: boolean;        // retryCount > 0
    
    vanilla: {
      durationMs: number;
      success: boolean;
      filesModified: number;
      error?: string;
    };
    fooks: {
      durationMs: number;
      scanTimeMs: number;
      totalTimeMs: number;
      success: boolean;
      filesModified: number;
      error?: string;
    };
    improvement: {
      execTimePct: number;
      totalTimePct: number;
    };
  };
}
```

### 4.6 Alerts

```typescript
type AlertSeverity = "critical" | "warning" | "info";
type AlertScope = "run" | "repo" | "bucket" | "sample";
type CauseCategory = "token" | "quality" | "performance" | "fallback" | "regression" | "coverage" | "threshold";

interface Alert {
  id: string;                    // UUID
  severity: AlertSeverity;
  scope: AlertScope;             // "run" | "repo" | "bucket" | "sample"
  causeCategory: CauseCategory;  // 분류 카테고리
  
  // Location
  repo?: string;
  bucket?: string;
  sampleId?: string;
  
  // Metric context
  metric: string;
  threshold: number;
  actual: number;
  
  // Baseline comparison (회귀 감지)
  baselineRef?: string;          // Previous run ID
  currentRef?: string;           // Current run ID
  baselineValue?: number;
  delta?: number;                // Change from baseline
  deltaRatio?: number;           // delta / baseline
  
  // Message
  title: string;
  description: string;
  recommendation?: string;
  
  // Evidence
  affectedFiles?: string[];
  relatedAlerts?: string[];
}

// Predefined Alert Templates
const ALERT_TEMPLATES = {
  REGRESSION_TOKEN_SAVINGS: {
    severity: "critical",
    scope: "bucket",
    causeCategory: "regression",
    metric: "savingsRatio",
    threshold: 0.30,
    title: "Token savings regression detected",
    description: "Savings ratio dropped {deltaRatio}% below baseline in {bucket}"
  },
  
  MEANING_PRESERVATION_FAIL: {
    severity: "critical",
    scope: "sample",
    causeCategory: "quality",
    metric: "structureSignal",
    threshold: 0.95,
    title: "Meaning preservation failed",
    description: "Extracted structure differs significantly from source (signal: {actual})"
  },
  
  HIGH_FALLBACK_RATE: {
    severity: "warning",
    scope: "bucket", 
    causeCategory: "fallback",
    metric: "useOriginalRatio",
    threshold: 0.15,
    title: "High fallback rate",
    description: "{actual}% samples falling back to original in {bucket}"
  },
  
  PERFORMANCE_DEGRADATION: {
    severity: "warning",
    scope: "repo",
    causeCategory: "performance",
    metric: "warmScanMs",
    threshold: 100,
    title: "Scan performance degraded",
    description: "Warm scan taking {actual}ms (baseline: {baselineValue}ms)"
  },
  
  BUCKET_UNDER_SAMPLED: {
    severity: "info",
    scope: "bucket",
    causeCategory: "coverage",
    metric: "deficitRatio",
    threshold: 0,
    title: "Bucket under-sampled",
    description: "{bucket} has {deficit} fewer samples than target ({deficitRatio}% deficit)",
    recommendation: "Baseline comparison will flag same-coverage: false"
  },
  
  EDIT_TASK_FAILURE: {
    severity: "critical",
    scope: "sample",
    causeCategory: "quality",
    metric: "editTaskSuccess",
    threshold: 1.0,
    title: "Edit task failed",
    description: "Task completion failed after {retryCount} retries"
  }
};
```

### 4.7 Report Output Structure

```
reports/
├── manifest.json                    # Run metadata + all artifact refs
├── gating-view.json                 # GatingView - quick decision layer
├── summary.md                       # Human-readable summary (3축 통합 뷰)
├── alerts.json                      # All alerts array with scope/baselineRef
│
├── by-repo/
│   ├── shadcn-ui-a1b2c3d.json      # RepoSummary (deficitSummary 포함)
│   ├── cal.com-b2c3d4e.json
│   └── ...
│
├── by-bucket/
│   ├── form-heavy-summary.json     # BucketSummary (3축 KPI 포함)
│   ├── hook-heavy-summary.json
│   └── ...
│
├── by-sample/
│   ├── shadcn-ui-form-heavy/       # SampleDetail per repo/bucket
│   │   ├── sample-001.json         # (contractSignal, behaviorSignal, structureSignal 포함)
│   │   └── ...
│   └── ...
│
└── delta/
    └── delta-from-{baseline}.json    # DeltaReport with same-coverage flag
```

---

## 5. KPI / Gate Definitions

### 5.1 3축 통합 리포트 뷰

| 축 | KPI | Gate (Fail if below) | Target |
|----|-----|---------------------|--------|
| **토큰 절감** | Avg savings ratio | 30% | 50% |
| **의미 보존** | Min(structureSignal, contractSignal, behaviorSignal) | 95% | 99% |
| **회귀 감지** | Baseline delta within | ±10% | ±5% |

### 5.2 Per-Bucket Gates (3축 통합)

| Bucket | Token Savings | Meaning Preservation | Efficiency | Quality |
|--------|---------------|---------------------|------------|---------|
| tiny-raw | overheadRatio < 20% | N/A | cold < 50ms | useOriginal < 10% |
| form-heavy | savingsRatio > 40% | behaviorSignal > 90% | warm < 100ms | retryNeeded < 20% |
| hook-heavy | savingsRatio > 35% | contractSignal > 95% | warm < 100ms | retryNeeded < 20% |
| large-mixed | savingsRatio > 25% | structureSignal > 85% | warm < 200ms | fallback < 30% |
| real-edit-task | savingsRatio > 20% | editTaskSuccess > 90% | total < baseline | retryNeeded < 30% |

### 5.3 CI Integration Gates

```yaml
# PR must pass (3축 모두):
- token_savings_avg > 0.30
- min_quality_signal > 0.95
- fallback_rate < 0.15
- no_critical_alerts
- no_regression_from_baseline (delta < 10%)
- same_coverage: true (deficit 없음)

# Release must pass:
- all_buckets_meet_3axis_target
- 90th_percentile_savings > 0.40
- 90th_percentile_quality > 0.98
- real_edit_task_success_rate > 0.90
- retry_needed_rate < 0.20
```

---

## 6. Key Operational Rules

### 6.1 Deficit Handling (Strict)

```typescript
// 절대 금지
const FORBIDDEN = {
  arbitrarySupplementation: false,   // 임의 파일 추가 금지
  crossBucketSubstitution: false,  // cross-bucket 보충 금지
  ignoreDeficit: false,              // deficit 무시 금지
  fakeCoverage: false                // same-coverage 거짓 표시 금지
};

// Deficit 처리 순서 (REVISED)
// 1. deficitRatio < 0.30: "undersampled" - usable but flagged, gating with caution
// 2. deficitRatio >= 0.30: "undersampled-high-risk" - exclude from comparative gating
// 3. deficitRatio >= 0.50: "excluded-from-gating" - do not gate
// 4. NO cross-bucket substitution (bucket purity preserved)
// 5. NO arbitrary supplementation (random files 추가 금지)
// 6. ALWAYS record deficit in manifest
// 7. Baseline comparison: sameCoverage = false if any deficit
```

### 6.2 tiny-raw Classification (Soft Signals)

```typescript
// tiny-raw는 rawBytes + mode primary, hooks는 penalty signal
// hooks > 0이 hard exclusion이 아닌 confidence modifier로 작동
const classification = {
  primary: rawBytes < 500 && mode === "raw",
  confidence: hooks === 0 ? "high" : hooks <= 1 ? "medium" : "low"
};
```

### 6.3 Quality Signal Calculation

```typescript
// contractSignal: interface/type/props preservation
function calculateContractSignal(original: AST, extracted: AST): number {
  const originalContracts = extractContracts(original);
  const extractedContracts = extractContracts(extracted);
  return jaccardSimilarity(originalContracts, extractedContracts);
}

// behaviorSignal: runtime behavior preservation (static analysis proxy)
function calculateBehaviorSignal(original: AST, extracted: AST): number {
  const originalEffects = extractEffectPaths(original);
  const extractedEffects = extractEffectPaths(extracted);
  return coverageRatio(originalEffects, extractedEffects);
}

// structureSignal: AST structure preservation
function calculateStructureSignal(original: AST, extracted: AST): number {
  const originalStructure = extractComponentTree(original);
  const extractedStructure = extractComponentTree(extracted);
  return treeEditDistance(originalStructure, extractedStructure);
}
```

---

## 7. Implementation Checklist

- [ ] Repo crawler: 6개 리포 revision pinning 자동화
- [ ] Bucket classifier: **rawBytes 기준** 분류기 (hooks = penalty signal)
- [ ] Deterministic sampler: seeded-shuffle + **strict deficit handling** (no cross-bucket)
- [ ] Metrics collector: token count, timing, **quality signals**
- [ ] Delta calculator: baseline 대비 diff + **same-coverage 체크**
- [ ] Alert generator: **scope/baselineRef/causeCategory** 포함
- [ ] **Gating view generator**: overall status, blockers, recommendations
- [ ] Report generator: **3축 통합 뷰** (token/meaning/regression)
- [ ] CI integration: **3축 gate** + deficit awareness

---

## 8. Gating View Example

```json
{
  "overallStatus": "warn",
  "blockerBuckets": [
    {
      "bucket": "form-heavy",
      "repo": "tailwindcss",
      "reason": "undersampled-high-risk",
      "metric": "deficitRatio",
      "threshold": 0.30,
      "actual": 0.67
    }
  ],
  "topRegressions": [
    {
      "bucket": "hook-heavy",
      "metric": "savingsRatio",
      "delta": -0.08,
      "deltaRatio": -0.18,
      "severity": "warning"
    }
  ],
  "topImprovements": [
    {
      "bucket": "form-heavy",
      "metric": "behaviorSignal",
      "delta": +0.03,
      "deltaRatio": +0.03
    }
  ],
  "sameCoverage": false,
  "coverageDeficits": [
    {
      "bucket": "form-heavy",
      "repo": "tailwindcss",
      "deficitRatio": 0.67,
      "status": "undersampled-high-risk"
    }
  ],
  "gatingConfidence": "medium",
  "recommendedAction": "proceed-with-caution",
  "summaryMetrics": {
    "avgTokenSavingsRatio": 0.42,
    "minQualitySignal": 0.96,
    "maxRegressionDelta": -0.08,
    "fallbackRate": 0.12
  }
}
```

---

*Final Draft 작성: 에르가재*  
*피드백 반영:*
- *deficit: cross-bucket-attempt 제거, 더 엄격한 규칙 적용*
- *tiny-raw: hooks > 0를 penalty signal로 변경 (hard exclusion → soft signal)*
- *gating view 추가: overall status, blockers, top regressions/improvements, sameCoverage, recommendedAction*

*상태: **usable draft → 실무 초안** 채택 준비 완료*  
*검토 대상: 형수님*
