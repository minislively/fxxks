# Layer 2 Frontend Task Benchmark - Public Report (Sample)

> R4 Feature Module Split - 정직한 상태 보고 (single proposal-only smoke collected; validated benchmark pending)

---

## 1. Task Summary

| 항목 | 값 |
|------|-----|
| **Task ID** | R4 |
| **Task Name** | Feature Module Split |
| **Description** | Split large monolithic component (1,249 lines) into modular components/, hooks/, utils/, types/ |
| **Target Complexity** | large-mixed |
| **Success Criteria** | ① 기능 유지 ② 파일당 ≤200라인 ③ type error 0 ④ 순환 import 0 ⑤ barrel export |

---

## 2. Input / Target

| 항목 | 값 |
|------|-----|
| **Repository** | shadcn-ui |
| **Target File** | `apps/v4/registry/bases/radix/examples/combobox-example.tsx` |
| **Original Size** | 1,249 lines, 39,209 bytes |
| **Split Target Structure** | components/, hooks/, utils/, types/ |
| **Expected File Count** | 8 files (4 components + 1 hook + 1 utils + 1 types + 4 barrel exports) |

---

## 3. Vanilla vs Fooks Result

| Metric | Vanilla | Fooks | Delta | Status |
|--------|---------|-------|-------|--------|
| **Prompt Tokens Approx** | 11365 | 861 | 92.4% smaller | ✅ Smoke only |
| **Output Tokens** | — | — | — | ⏸️ Pending |
| **Retry Count** | — | — | — | ⏸️ Pending |
| **Completion Latency** | 85822 ms | 57545 ms | 32.9% lower | ✅ Smoke only |
| **Success** | true | true | equal | ✅ Smoke only |
| **Files Generated** | — | — | — | ⏸️ Pending |
| **Validation Score** | —/6 | —/6 | — | ⏸️ Pending |

**실제 실행 상태:** 🟡 **Single proposal-only smoke collected; validation/repeated benchmark pending**

---

## 4. Metrics Table

| # | Metric | Description | Vanilla | Fooks | Improvement | Status |
|---|--------|-------------|---------|-------|-------------|--------|
| 1 | Prompt-size Reduction | (vanilla - fooks) / vanilla | 11365 | 861 | 92.4% smaller | ✅ Smoke only |
| 2 | Latency Difference | vanilla - fooks | 85822 ms | 57545 ms | 32.9% lower | ✅ Smoke only |
| 3 | Retry Reduction | vanilla - fooks | — | — | — | ⏸️ Pending |
| 4 | Success Rate Diff | fooks - vanilla | — | — | — | ⏸️ Pending |

**참고:** 위 수치는 proposal-only smoke의 local prompt-size/latency 관찰값이다. provider billing telemetry나 acceptance-validated 품질 결과가 아니며, 안정적인 runtime-token/time win claim은 validation + 반복 실행 전까지 금지.

---

## 5. Interpretation

### Current Status
> 🟡 **Single Proposal-Only R4 Smoke Collected**

### Key Findings
- **Task Definition/Spec:** ✅ Complete
- **Runner/Wrapper:** ✅ Implemented and current `codex exec` smoke passed
- **R4 Paired Smoke:** ✅ Vanilla/fooks proposal-only pair collected once
- **Validated Benchmark:** 🟡 Validation and repeated evidence pending

### Current Evidence
- Tiny runner smoke: ✅ `success: true`, `exitCode: 0`
- R4 paired smoke: ✅ vanilla and fooks both completed through current `codex exec`
- Prompt-size smoke result: vanilla `11365` approx prompt tokens vs fooks `861` approx prompt tokens (`92.4%` smaller)
- Historical 502 finding: retained as legacy gateway evidence, no longer the only runner route

### One-line Verdict
> **Layer 2 Task Definition/Spec is complete, and the current runner can execute a single R4 paired smoke. Treat the 92.4% prompt-size reduction as smoke evidence only until validation and repeated runs exist.**

---

## 6. Artifact Links

### Completed (Available Now)
| Artifact | Location | Status |
|----------|----------|--------|
| **Runner Spec** | `R4-runner-spec.md` | ✅ Complete |
| **Validation Checklist** | `R4-validation-checklist.md` | ✅ Complete |
| **Metric Schema** | `R4-metric-schema.md` | ✅ Complete |
| **Runner Implementation** | `runner.js`, `codex-wrapper.js` | ✅ Complete |
| **Public Report Template** | `PUBLIC_REPORT_TEMPLATE.md` | ✅ Complete |

### Pending (Execution Required)
| Artifact | Location | Status |
|----------|----------|--------|
| **R4 Paired Smoke Summary** | `results/R4-current-exec-smoke-2026-04-21.json` | ✅ Collected |
| **Validated Vanilla Result** | `results/R4-vanilla-run-2.json` | ⏸️ Pending |
| **Validated Fooks Result** | `results/R4-fooks-run-2.json` | ⏸️ Pending |
| **Validated Comparison Report** | `results/R4-comparison.json` | ⏸️ Pending |

---

## Separation Notice

### Public-Facing (This Document)
- Task definition and specification
- Target file and success criteria
- Execution status and blocker information
- Artifact structure and methodology

### Internal (Not Detailed Here)
- Codex/configured gateway execution lane details
- Gateway stability troubleshooting
- Internal retry attempts and logs

---

*Sample Report: 에르가재*
*Date: 2026-04-21*
*Status: Single proposal-only smoke collected; validation/repeated evidence pending*
*Next: Attach validation artifact and repeat matched R4 pairs before public win claims*
