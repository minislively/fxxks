# Layer 2 Frontend Task Benchmark - Public Report Template

> Public-facing benchmark report (Layer 1 style)

---

## 1. Task Summary

| 항목 | 값 |
|------|-----|
| **Task ID** | R4 |
| **Task Name** | Feature Module Split |
| **Description** | Split large monolithic component into modular files |
| **Target Complexity** | large-mixed |

---

## 2. Input / Target

| 항목 | 값 |
|------|-----|
| **Repository** | shadcn-ui |
| **Target File** | `apps/v4/registry/bases/radix/examples/combobox-example.tsx` |
| **Original Size** | 1,249 lines |
| **Split Target** | components/, hooks/, utils/, types/ |

---

## 3. Vanilla vs Fooks Result

| Metric | Vanilla | Fooks | Delta |
|--------|---------|-------|-------|
| **Input Tokens** | [measured] | [measured] | [calculated] |
| **Output Tokens** | [measured] | [measured] | [calculated] |
| **Retry Count** | [measured] | [measured] | [calculated] |
| **Completion Latency** | [measured] ms | [measured] ms | [calculated] ms |
| **Success Rate** | [measured]% | [measured]% | [calculated]% |
| **Files Generated** | [count] | [count] | [comparison] |
| **Validation Score** | [score]/6 | [score]/6 | [comparison] |

---

## 4. Metrics Table

| # | Metric | Description | Vanilla | Fooks | Improvement |
|---|--------|-------------|---------|-------|-------------|
| 1 | Token Reduction | (vanilla - fooks) / vanilla | - | - | [calculated] |
| 2 | Latency Improvement | vanilla - fooks | - | - | [calculated] |
| 3 | Retry Reduction | vanilla - fooks | - | - | [calculated] |
| 4 | Success Rate Diff | fooks - vanilla | - | - | [calculated] |

---

## 5. Interpretation

### Key Findings
- [ ] Context optimization impact on task success
- [ ] Token savings vs quality preservation trade-off
- [ ] Operational overhead (if any)

### One-line Verdict
> [Success/Partial/Blocked]: [Brief explanation]

---

## 6. Artifact Links

| Artifact | Location |
|----------|----------|
| **Raw Results** | `benchmarks/layer2-frontend-task/results/` |
| **Comparison Report** | `benchmarks/layer2-frontend-task/results/R4-comparison.json` |
| **Runner Spec** | `R4-runner-spec.md` |
| **Validation Checklist** | `R4-validation-checklist.md` |
| **Metric Schema** | `R4-metric-schema.md` |

---

## Internal vs Public Separation

### Public (This Document)
- Task definition
- Target specification
- Comparison results
- Metrics and interpretation
- Artifact links

### Internal (Not Public-Facing)
- Execution lane: Codex/Layofflabs
- Gateway stability management
- Internal blocker tracking

---

*Template: 에르가재*
*Date: 2026-04-15*
*Public-facing: Yes*
*Internal execution details: Separated*
