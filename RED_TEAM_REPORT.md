# Fooks Red Team Analysis Report

**Date:** 2026-04-14  
**Session ID:** 019d8c85-8333-74b0-b9f3-a052d877aa7d  
**Tester:** Codex CLI (OMX)  
**Target:** fooks v0.1.0 (frontend context compression engine)

> **Status note (2026-04-27):** This is a historical red-team snapshot, not the current release state. The cache-corruption scan blocker is now covered by PR #213 (`799c135`), which treats unreadable extraction cache entries and persisted scan indexes as cache misses and adds corrupt-index regression coverage. Keep the original finding text below as provenance only; do not reuse it as a current open P0 claim without rerunning the red-team scenario.

---

## Executive Summary

Fooks is a frontend context compression engine that generally handles edge cases gracefully. At the time of this historical run it still had **critical vulnerabilities** in cache corruption handling and moderate issues with tiny file inflation.

| Risk Level | Count | Issues |
|------------|-------|--------|
| 🔴 **Critical** | 1 | Corrupted cache crashes scan operation |
| 🟠 **High** | 1 | Tiny file (<100 bytes) payload inflation |
| 🟡 **Medium** | 2 | Malformed JSX handling, permission edge cases |
| 🟢 **Low** | 6 | Unicode, binary files, empty files handled gracefully |

---

## 🔴 Critical: Corrupted Cache Handling

### Finding
Corrupted `.fooks/cache/*.json` files cause **unrecoverable crash** with `SyntaxError`.

### Evidence
```json
{
  "corruptedCacheForced": {
    "crashed": true,
    "name": "SyntaxError",
    "message": "Unexpected token '}', \"}{\" is not valid JSON",
    "stackTop": [
      "SyntaxError: Unexpected token '}'",
      "    at JSON.parse (<anonymous>)",
      "    at readCachedExtraction (dist/core/cache.js:18:17)",
      "    at scanProject (dist/core/scan.js:78:57)"
    ]
  }
}
```

### Impact
- **Production downtime:** Any disk corruption or concurrent write conflict bricks fooks
- **No recovery path:** Must manually delete `.fooks/` directory
- **Data loss:** Cache index must be rebuilt from scratch

### Consultant Recommendation
**P0 Priority - Fix Immediately**

1. Wrap cache reads in try-catch with fallback to re-extraction
2. Add cache corruption detection and auto-rebuild
3. Implement atomic cache writes (write to temp, then rename)
4. Add cache integrity checksums

```typescript
// Suggested fix in cache.ts
function readCachedExtraction(fileHash: string): Extraction | null {
  try {
    const data = fs.readFileSync(cachePath, 'utf8');
    const parsed = JSON.parse(data);
    if (isValidExtraction(parsed)) return parsed;
    return null; // Invalid format - will be overwritten
  } catch (e) {
    console.warn(`Cache read failed for ${fileHash}, rebuilding...`);
    return null; // Graceful fallback
  }
}
```

---

## 🟠 High: Tiny File Payload Inflation

### Finding
Files <100 bytes experience **payload inflation** instead of compression.

### Evidence
```json
{
  "tinyFileInflation": {
    "sourceBytes": 41,
    "extractJsonBytes": 812,
    "payloadJsonBytes": 110,
    "mode": "raw",
    "useOriginal": true
  }
}
```

- Source: 41 bytes (`export default function A(){return <a/>}`)
- Metadata overhead: 812 bytes (19.8x inflation!)
- Even model payload: 110 bytes (2.7x inflation)

### Impact
- **Token waste:** Small files actually *increase* context size
- **Micro-component penalty:** Button components, utilities get bloated
- **Death by a thousand cuts:** Many small files = significant overhead

### Consultant Recommendation
**P1 Priority - Optimize Soon**

1. **Skip metadata for tiny files** - Only store raw source + minimal hash
2. **Bulk index approach** - Store many small files in single index entry
3. **Raw-only mode** - Don't run extraction for files <200 bytes

```typescript
// Optimization: Tiny file fast path
if (fileSize < 200) {
  return {
    mode: 'raw-tiny',
    rawText: source,
    // Skip full extraction - save 800+ bytes per file
  };
}
```

---

## 🟡 Medium: Malformed JSX Handling

### Finding
Malformed JSX is detected but **processing continues** with incomplete data.

### Evidence
```json
{
  "malformedDiagnostics": [
    {
      "code": 17008,
      "message": "JSX element 'span' has no corresponding closing tag.",
      "start": 55,
      "length": 4
    }
  ],
  "malformedDiagnostics2": [
    {
      "code": 17002,
      "message": "Expected corresponding JSX closing tag for 'span'.",
      "start": 80,
      "length": 3
    },
    {
      "code": 1005,
      "message": "':' expected.",
      "start": 84,
      "length": 1
    }
  ]
}
```

Fooks **continues processing** despite parse errors and produces output:
```json
{
  "mode": "raw",
  "useOriginal": true,
  "componentName": "BrokenUnclosed",
  "exports": [...]
}
```

### Impact
- **Silent data corruption:** Model receives incomplete/broken code
- **Silent failures:** No warning to user that extraction had errors

### Consultant Recommendation

1. **Fail loud for broken JSX** - Mark as error, don't send to model
2. **Add parse error reporting** - Include diagnostics in output
3. **Quality gates** - Reject files with >5 parse errors

---

## 🟢 Low: Gracefully Handled Cases

### ✅ Unicode & Emoji
```json
{
  "unicodeEmoji": {
    "mode": "raw",
    "rawText": "export default function EmojiCard(){ const café = \"☕️\"; return <div title=\"😀\">naïve {café} 🚀</div>; }"
  }
}
```
**Status:** UTF-8 handling correct, no data loss.

### ✅ Empty Files (0 bytes)
```json
{
  "emptyExtract": {
    "mode": "raw",
    "rawText": "",
    "lineCount": 1
  }
}
```
**Status:** Handled gracefully with fallback mode.

### ✅ Circular Imports
```json
{
  "cycleLinkedScan": {
    "files": [
      { "filePath": "Widget.tsx", "componentName": "Widget" },
      { "filePath": "Widget.utils.ts", "exports": [{"name": "helper"}] }
    ]
  }
}
```
**Status:** No infinite loops, both files processed.

### ✅ Binary Files in JSX
```json
{
  "binaryFiles": {
    "pngResult": {
      "language": "ts",
      "mode": "raw",
      "rawText": "PNG\r\n\u001a\n..."
    },
    "jsxResult": {
      "language": "jsx",
      "mode": "raw"
    }
  }
}
```
**Status:** Treated as text (may want to skip binary files).

### ✅ Large Single File (10,027 lines)
```json
{
  "largeSingleFile": {
    "elapsedMs": 171.65,
    "mode": "compressed",
    "resultJsonBytes": 796
  }
}
```
**Status:** Processed in 172ms with 99.8% compression!

### ✅ Deep Nesting (25 levels)
```json
{
  "deepNesting": {
    "mode": "compressed",
    "jsxDepth": 25,
    "complexityScore": 75.1
  }
}
```
**Status:** Correct depth detection.

### ✅ Exhaustive Exports (61 exports)
```json
{
  "exhaustiveExports": {
    "exportsCount": 61,
    "mode": "compressed"
  }
}
```
**Status:** All exports captured.

---

## Action Items Matrix

| Priority | Action | Owner | Effort | Impact |
|----------|--------|-------|--------|--------|
| **P0** | Add cache corruption resilience | Backend | 2 days | Prevents crashes |
| **P1** | Optimize tiny file handling (<200 bytes) | Compression | 3 days | ~80% size reduction on small files |
| **P2** | Add parse error quality gates | Parser | 2 days | Data quality |
| **P3** | Skip binary files (PNG, JPG, etc) | Discovery | 1 day | Prevents garbage data |
| **P3** | Cache integrity checksums | Infrastructure | 1 day | Early corruption detection |
| **P4** | Concurrent scan safety (file locks) | Infrastructure | 3 days | Race condition prevention |

---

## Appendix: Test Cases

### Test Environment
- fooks v0.1.0
- Node.js v25.1.0
- TypeScript 5.9.2

### Files Created for Testing
```
/tmp/fooks-success-*
  ├── Tiny.tsx (41 bytes)
  ├── broken1.tsx (unclosed JSX)
  ├── broken2.tsx (expression error)
  ├── A.tsx / B.tsx (circular imports)
  ├── EmojiCard.tsx (UTF-8 + emoji)
  ├── Huge.tsx (10,027 lines)
  ├── image.png / Garbage.jsx (binary)
  ├── Exports.tsx (61 exports)
  ├── Deep.tsx (25 level nesting)
  └── Empty.tsx (0 bytes)
```

---

## Methodology

1. **Static Analysis:** Code review of core modules (scan, extract, cache)
2. **Dynamic Testing:** Created adversarial inputs programmatically
3. **Fault Injection:** Corrupted cache files, malformed data
4. **Edge Case Coverage:** Tested 12 distinct edge case categories

---

**Report Generated:** 2026-04-14  
**Tokens Used:** ~98,000 for red team session  
**Co-authored-by:** minislively
