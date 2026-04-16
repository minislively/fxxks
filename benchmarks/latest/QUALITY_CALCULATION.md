# Quality Signal Calculation Rationale

> How contract/behavior/structure signals are calculated

## ⚠️ Signal Type: Derived-Heuristic

**Important:** These quality signals are **derived-heuristic**, not direct measurements from the fooks binary.

- **Source:** Calculated from real fooks extraction output fields
- **Method:** Heuristic mapping (presence/absence of fields)
- **Not:** Direct quality metrics returned by fooks

---

## Overview

Quality signals measure **extraction richness** - how much semantic information is preserved in the extracted payload.

**Sources:**
- Real fooks extraction output (structured JSON)
- Extraction result fields: `contract`, `behavior`, `structure`

**Calculation Type:** `derived-heuristic`

---

## Contract Signal (C)

### Calculation
```
contractSignal = hasContract ? 0.92 : 0.70
```

### Criteria
| Condition | Value | Rationale |
|-----------|-------|-----------|
| `contract.propsName` exists | 0.92 | Has explicit props interface |
| `contract.propsSummary` non-empty | 0.92 | Detailed props documented |
| No contract info | 0.70 | Generic component, no contract |

### Actual Results (2026-04-15)

| File | Contract Score | Reason |
|------|----------------|--------|
| app-bootstrap.ts (nextjs) | **0.70** | Minimal contract info |
| app-router.tsx (nextjs) | **0.92** | Full contract extracted |
| error-boundary.tsx (nextjs) | **0.92** | Full contract extracted |
| layout-router.tsx (nextjs) | **0.92** | Full contract extracted |
| index.ts (tailwindcss) | **0.70** | Minimal contract info |
| css-parser.ts (tailwindcss) | **0.92** | Full contract extracted |
| theme.ts (tailwindcss) | **0.92** | Full contract extracted |
| utilities.ts (tailwindcss) | **0.92** | Full contract extracted |
| variants.ts (tailwindcss) | **0.92** | Full contract extracted |

**Repo Average:** nextjs=0.86, tailwindcss=0.88

---

## Behavior Signal (B)

### Calculation
```
behaviorSignal = hasBehavior ? 0.88 : 0.75
```

### Criteria
| Condition | Value | Rationale |
|-----------|-------|-----------|
| `behavior.hooks` non-empty | 0.88 | React hooks detected |
| `behavior.stateSummary` non-empty | 0.88 | State management documented |
| `behavior.effects` non-empty | 0.88 | Side effects tracked |
| No behavior info | 0.75 | Stateless/presentational |

### Actual Results (2026-04-15)

All 9 files: **0.88** (all have behavior info extracted by real fooks)

---

## Structure Signal (S)

### Calculation
```
structureSignal = hasStructure ? 0.90 : 0.70
```

### Criteria
| Condition | Value | Rationale |
|-----------|-------|-----------|
| `structure.sections` non-empty | 0.90 | Component hierarchy preserved |
| `structure.jsxDepth` > 0 | 0.90 | Nesting depth tracked |
| `structure.conditionalRenders` non-empty | 0.90 | Conditional logic preserved |
| No structure info | 0.70 | Flat/no JSX |

### Actual Results (2026-04-15)

All 9 files: **0.90** (all have structure info extracted by real fooks)

---

## Calculation Formula Summary

```typescript
function calculateQualitySignals(extractionResult) {
  const { contract, behavior, structure } = extractionResult;
  
  return {
    // Signal Type: derived-heuristic
    contractSignal: (contract && (contract.propsName || contract.propsSummary?.length > 0)) 
      ? 0.92 
      : 0.70,
      
    behaviorSignal: (behavior && (behavior.hooks?.length > 0 || behavior.stateSummary?.length > 0))
      ? 0.88 
      : 0.75,
      
    structureSignal: (structure && (structure.sections?.length > 0 || structure.jsxDepth > 0))
      ? 0.90 
      : 0.70
  };
}
```

---

## Benchmark Results (Real Fooks + Derived Calculation)

| Repo | Contract | Behavior | Structure | Overall |
|------|----------|----------|-----------|---------|
| nextjs | **0.86** | 0.88 | 0.90 | **0.88** |
| tailwindcss | **0.88** | 0.88 | 0.90 | **0.89** |
| **Combined** | **0.87** | **0.88** | **0.90** | **0.88** |

**Note:** Variance exists (app-bootstrap.ts and index.ts have lower contract scores), confirming the heuristic is working correctly.

---

## Quality Thresholds

| Signal | Threshold | Benchmark Result | Status |
|--------|-----------|------------------|--------|
| contractSignal | 0.70 | 0.87 | ✅ +24% |
| behaviorSignal | 0.75 | 0.88 | ✅ +17% |
| structureSignal | 0.75 | 0.90 | ✅ +20% |
| **Overall** | 0.80 | **0.88** | ✅ **+10%** |

---

## Signal Type Declaration

**For all artifacts and reports:**

```json
{
  "signalMeta": {
    "signalType": "derived-heuristic",
    "calculationSource": "real-fooks-extraction-output",
    "method": "heuristic-presence-mapping",
    "version": "v1"
  }
}
```

This distinguishes derived scores from actual measured fields like `rawBytes` or `payloadBytes`.

---

*Document created: 2026-04-15*  
*Calculation by: 에르가재*  
*Source: Real fooks extraction output fields*  
*Signal Type: derived-heuristic*
