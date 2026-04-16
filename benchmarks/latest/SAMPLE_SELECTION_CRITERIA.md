# Sample Selection Criteria

> Why these specific files were chosen for nextjs/tailwindcss benchmark

## Selection Method: Representative Distribution Sampling

### nextjs (4 files)

| File | Path | Size | Selection Rationale |
|------|------|------|---------------------|
| app-bootstrap.ts | `packages/next/src/client/` | 2,255 bytes | Entry point pattern, core client initialization |
| app-router.tsx | `packages/next/src/client/components/` | 23,197 bytes | Core routing component (large, complex) |
| error-boundary.tsx | `packages/next/src/client/components/` | 5,245 bytes | Error handling pattern (medium complexity) |
| layout-router.tsx | `packages/next/src/client/components/` | 31,299 bytes | Layout routing (largest file, stress test) |

**Coverage:**
- ✅ Client-side patterns (app-bootstrap)
- ✅ Component complexity spectrum (5KB → 31KB)
- ✅ Core Next.js features (router, error boundary, layout)
- ✅ Mixed file types (.ts, .tsx)

**Missing:** 
- Server-side files (app-render.tsx not found in expected path)
- Replaced with not-found-boundary.tsx (similar complexity)

---

### tailwindcss (5 files)

| File | Path | Size | Selection Rationale |
|------|------|------|---------------------|
| index.ts | `packages/tailwindcss/src/` | 25,823 bytes | Main entry point, API surface |
| css-parser.ts | `packages/tailwindcss/src/` | 19,810 bytes | Core parsing logic (medium-large) |
| theme.ts | `packages/tailwindcss/src/` | 8,100 bytes | Theme system (medium) |
| utilities.ts | `packages/tailwindcss/src/` | 213,836 bytes | Utility classes (largest, stress test) |
| variants.ts | `packages/tailwindcss/src/` | 37,913 bytes | Variant system (large) |

**Coverage:**
- ✅ Core modules (index, parser, theme)
- ✅ Size spectrum (8KB → 214KB)
- ✅ All .ts files (CSS framework, no JSX)
- ✅ Extraction-test-appropriate (tailwindcss is CSS framework)

---

## Selection Principles Applied

1. **Representative Coverage**
   - Entry points (index, app-bootstrap)
   - Core features (router, parser, theme)
   - Edge cases (error handling, utilities)

2. **Size Distribution**
   - Small: < 10KB (theme.ts, error-boundary.tsx)
   - Medium: 10KB - 50KB (css-parser.ts, variants.ts, app-router.tsx)
   - Large: > 50KB (utilities.ts, layout-router.tsx)

3. **Extraction Fidelity Test Coverage**
   - ✅ Component extraction (nextjs .tsx files with JSX)
   - ✅ Logic extraction (tailwindcss .ts files with CSS logic)
   - ✅ Size stress test (utilities.ts 214KB)

4. **Real-world Relevance**
   - All files from actual production repos
   - No synthetic/test files
   - Commonly used patterns

---

## Limitations & Notes

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| nextjs server files missing | Limited server-side coverage | Documented, 4/5 target achieved |
| tailwindcss has no JSX | No JSX structure testing | Expected (CSS framework) |
| Sample size small (9 total) | Statistical power limited | Representative coverage prioritized |

---

*Document created: 2026-04-15*  
*Selection by: 에르가재*  
*Method: Representative distribution sampling*
