# React Web docs/test fixture audit (#834)

This audit covers the recent React Web first-minute documentation, issue-report tests, and golden fixtures. It is cleanup evidence only: it does not change runtime/provider behavior, detector scope, React Native/WebView/TUI wording, or any React Web issue-card claim boundary.

## Inventory and classification

| Area | Paths | Classification | Rationale |
| --- | --- | --- | --- |
| Product entry docs | `README.md`, `docs/demo/react-web-issues.md`, `docs/react-web-first-minute-work-orders.md` | Keep | These are the current public first-minute contract and packaged demo. `README.md`, `package.json`, `scripts/release-smoke.mjs`, and `test/fooks.test.mjs` guard the demo packaging and boundary wording. |
| Superseded standalone context-packet note | `docs/react-web-issue-context-packet.md` | Delete/consolidate | The standalone note was unlinked from README/package/release-smoke/tests and repeated a subset of the current first-minute handoff contract. The active source/tests still guard `contextPacket` behavior, and `docs/react-web-first-minute-work-orders.md` already names context packets as full-JSON/detail-only evidence while keeping compact `--summary-json` bounded. |
| Fixture usefulness guide | `docs/react-web-issue-fixture-usefulness.md` | Keep | Although not public-packaged, it is the only short maintainer note that explains the fixture gate vocabulary (`count-mismatch`, `detector-parity`, `noisy-suggestion`, `unsafe-preview`, `unsupported-boundary`). Keep it until an equivalent section exists in the main work-order doc or test helper docs. |
| Issue-card behavior tests | `test/react-web-issue-report.test.mjs`, `test/react-web-label-preview.test.mjs`, `test/helpers/react-web-issue-fixture-gate.mjs`, `test/helpers/react-web-agent-handoff-dogfood.mjs`, `test/helpers/react-web-decision-handoff-benchmark.mjs` | Keep | These lock issue-card rendering, first-minute summary projection, dry-run projection, decision authority, false-positive guards, unsupported stops, and claim-boundary invariants. Deleting or merging them would weaken acceptance coverage. |
| Golden first-minute outputs | `test/fixtures/react-web-issues-golden/form-controls.summary.selected.json`, `test/fixtures/react-web-issues-golden/form-controls.dry-run.selected.json`, `test/fixtures/react-web-issues-golden/form-controls.text.excerpt.txt` | Keep | The selected golden files are directly referenced by `test/react-web-issue-report.test.mjs` and `test/fooks.test.mjs`; they protect summary JSON, dry-run JSON, and text excerpt boundaries. |
| Label-preview/false-positive fixtures | `test/fixtures/react-web-label-preview/*.tsx` | Keep | Fixtures are either directly referenced or intentionally discovered by related-context scanning. For example, `Label.tsx` is not named in tests directly, but it is a same-directory source candidate after imported `FormField.tsx` and `Input.tsx` are excluded. Removing it changes related-context coverage. |
| React Web context expansion fixtures | `test/fixtures/react-web-context-expansion/*` | Keep | These belong to React Web context/evidence tests rather than issue-card golden output, and they remain referenced by scripts/tests. They are outside the safe deletion set for this issue. |
| React Web CI/report dogfood anchor | `docs/dogfood/post-merge-react-web-ci-echo-anchor-823.md` | Keep | This is issue-specific operator-boundary evidence, not first-minute issue-card material. `test/operator-activity.test.mjs` reads it directly. |

## Cleanup applied

Deleted `docs/react-web-issue-context-packet.md` and consolidated the audit rationale here instead of adding new product-facing claims. Current context-packet behavior remains protected by source and `test/react-web-issue-report.test.mjs`; the public first-minute boundary remains in `docs/react-web-first-minute-work-orders.md` and the packaged demo.

## Verification

Completed after rebasing this worktree onto `origin/main` on 2026-05-14. `npm install` was not needed because dependencies were already present and unchanged.

- `npm run build`
- `node --test test/react-web-issue-report.test.mjs test/fooks.test.mjs`
- `git diff --check`
