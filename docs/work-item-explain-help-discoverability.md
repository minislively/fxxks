# fooks explain help discoverability

Issue #929 is a narrow CLI/operator ergonomics artifact for the `fooks explain` surface added in PR #928.

## Operator path

Use command help to discover the available WorkItem explanation artifacts without touching provider/runtime behavior:

```bash
fooks explain --help
```

The help output documents:

- `fooks explain sample` for a static, safe shape preview.
- `fooks explain status` for the current repository WorkItem selected by `fooks status`.
- `fooks explain current` / `fooks explain work-item` for the current repository WorkItem artifact.
- `--json` for the machine-readable explanation contract.

## Boundary

This artifact is CLI/operator discoverability only. It does not change provider/runtime behavior, merge-gate policy, detector scope, React Web/RN/TUI/WebView behavior, performance claims, or product claims.
