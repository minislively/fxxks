# Layer 2 Execution Path Redesign

> Layer 1 스타일의 direct/provider-agnostic harness로 전환

---

## 1. New Execution Path Proposal

### Default/Public Path (Redesigned)
- **Method:** Provider-agnostic direct execution (first candidate: OpenAI-compatible API)
- **Entry:** `runner-direct.js` (new)
- **Characteristics:** 
  - No specific gateway dependency
  - Local-compatible
  - Reproducible without Layofflabs infrastructure
  - Benchmark results are infrastructure-agnostic
  - Provider can be OpenAI, Anthropic, or other compatible APIs

### Internal Optional Path (Downgraded)
- **Method:** Codex CLI via Layofflabs gateway
- **Entry:** `runner-internal.js` (existing `runner.js` repurposed)
- **Characteristics:**
  - Convenience for internal team
  - Optional, not blocking
  - Gateway instability does not block public benchmark

---

## 2. Public Default / Internal Optional Separation

| Aspect | Public/Default | Internal/Optional |
|--------|---------------|-----------------|
| **Execution** | Direct API calls | Codex CLI + Layofflabs |
| **Dependency** | API key only | Gateway stability |
| **Status Impact** | Primary benchmark source | Internal convenience only |
| **Reporting** | PUBLIC_REPORT.md | Internal logs only |
| **Blocker Impact** | None (always available) | 502 does not block project |

---

## 3. Removal / Downgrade List

### Downgraded
- **Layofflabs gateway path:** From "mandatory default" → "internal optional lane"
- **Codex CLI wrapper:** From "primary runner" → "internal convenience tool"

### Removed from Critical Path
- **"Layer 2 blocked by 502" narrative:** Remove from public status
- **Gateway dependency in public harness:** Public benchmark must not depend on Layofflabs

### Modified
- **README/STATUS:** Update to show "Layer 2 public path redesigned, direct execution available"
- **PUBLIC_REPORT_SAMPLE:** Show results from direct API path, not Codex CLI

---

## 4. Implementation Priority

1. **Create `runner-direct.js`** (Provider-agnostic direct path)
2. **Rename existing `runner.js`** → `runner-internal.js` (Optional lane)
3. **Update documentation** to reflect separation
4. **Generate first real Layer 2 result** via direct path

---

## Canonical Status (Current - Proposal Phase)

> **Layer 2 Task Definition/Spec: Complete**
> **Layer 2 Execution Redesign Proposal: Ready**
> **Layofflabs Lane: Downgraded to internal optional**
> **New Default/Public Path: Provider-agnostic direct execution (not yet implemented/validated)**
> **Layer 2 Real Benchmark: Requires implementation of new default path**

---

*Status: Proposal Phase*
*Proposal: Ready*
*Implementation: Not yet validated*
