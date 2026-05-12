# React Web issue fixture usefulness gate

The React Web issue-report tests keep a reusable internal fixture gate before any
public check surface exists. The gate parses each fixture case into the same
quality vocabulary future report features should reuse:

- expected and observed issue-card counts
- accepted versus rejected/false-positive cards
- safe-preview and manual-review expectations
- unsupported/skip boundary expectations
- label-preview parity
- suggestion plausibility and noise notes

Failure output is intentionally grouped by regression class: `count-mismatch`,
`detector-parity`, `noisy-suggestion`, `unsafe-preview`, and
`unsupported-boundary`. This keeps the current `inspect react-web-issues` surface
read-only and preview-only while giving future context-packet and React Web
migration/codemod dry-run work a fixture-backed quality gate to reuse before any
apply or repo-owned policy surface is introduced.
