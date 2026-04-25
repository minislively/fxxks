# TUI / Ink fixture candidate survey

This survey is an evidence-planning note for a possible future TUI / React CLI domain signal profile. It does **not** add TUI support, change extractor behavior, or promote Ink files beyond the existing TSX/JSX parsing boundary described in the README. It only records fixture shapes that could be useful if a later plan decides to test whether the shared TypeScript AST core should feed a separate TUI/CLI profile.

Any future fixture PR should pin exact source snapshots and document expected fallback/extract behavior before changing code. This page makes no runtime-token, provider billing, provider cost, latency, or package-support claim.

## Selection criteria

A TUI fixture candidate should satisfy most of these gates:

1. **React CLI source shape** — `.tsx` / `.jsx` files that use Ink-style React components or other React-rendered terminal UI patterns.
2. **Signal clarity** — one focused terminal UI concern per fixture, so web DOM/form/style assumptions are easy to avoid.
3. **Claim safety** — useful for evidence without implying terminal runtime correctness, shell integration behavior, provider/runtime savings, or current support expansion.
4. **Stable source snapshot** — pinned commit SHA or vendored snapshot before it becomes a benchmark fixture.
5. **Fallback expectation** — each fixture states whether a future profile would try extraction or keep full-source reading when signals are weak or mixed.

## Candidate fixture categories

| Category | Useful evidence surface | Boundary / risk |
| --- | --- | --- |
| Ink CLI app/component | Root `App.tsx` or reusable CLI components using Ink-style React primitives such as text containers, conditional panels, or command views. | Treat as TSX/JSX syntax only today; terminal rendering semantics are not web DOM semantics. |
| Keyboard/input prompt surface | Components that handle keyboard input, prompt state, validation text, selection lists, or submit/cancel flows. | Do not infer shell, TTY, stdin, or accessibility behavior from AST shape alone. |
| Layout/text styling | Text layout, color/style tokens, wrapping, spacing, borders, and nested terminal rows/columns. | DOM/CSS style signals may be weak or misleading; keep web-style assumptions out of future profile criteria. |
| Command status/progress UI | Status lines, spinners, progress indicators, task lists, logs, or success/error summaries rendered by React CLI components. | Runtime progress behavior and command side effects are outside fixture evidence unless a later benchmark explicitly measures them. |
| Negative/fallback cases | Mixed web/TUI files, thin wrappers around process execution, non-React terminal libraries, generated output renderers, or files with too few React CLI signals. | These should preserve normal source reading or an explicit fallback expectation until a future profile proves safe extraction rules. |

## Recommended first fixture slice

Start with a small source-only corpus before any extractor or runtime change:

1. **Ink CLI app/component fixture** — one compact `.tsx` app or component with React CLI primitives and conditional rendering.
2. **Keyboard/input prompt fixture** — one component where key handlers, prompt state, and validation/cancel branches are visible in source.
3. **Layout/text styling fixture** — one component focused on terminal layout and text styling rather than DOM/CSS assumptions.
4. **Command status/progress fixture** — one component that renders command status or progress UI without requiring command execution to interpret it.
5. **Negative/fallback fixture** — one file that looks like CLI code but should remain full-source because it is non-React, mixed-domain, generated, or too behavior-heavy.

## Candidate source notes

If a future PR names public repositories, keep the list conservative and verify license, activity, file paths, and commit SHAs at that time. Good seed sources are likely to be established Ink examples, React-based CLI apps, or prompt/status UI components with inspectable TSX/JSX. Do not use curated lists, stale forks, or runtime-only demos as evidence fixtures unless a pinned source file clearly exercises one category above.

## Acceptance bar before moving to extractor prototype

Do not start TUI/CLI extractor behavior until a candidate PR can show:

- fixture corpus selected with stable commit SHAs or pinned snapshots;
- each fixture mapped to a domain signal profile, signal family, and expected fallback/extract behavior;
- tests prove current README/roadmap wording remains limited to existing TSX/JSX syntax treatment and future-candidate status;
- benchmark/evidence commands are documented before any measured claim;
- fallback cases remain in the corpus so weak, mixed, non-React, or behavior-heavy CLI files do not silently receive compact payloads;
- roadmap wording remains limited to candidate evidence and staged gates, with no public support promise, delivery timeline, runtime-token claim, provider-cost claim, or default TUI compact extraction.

## Non-goals

- No public TUI/Ink support claim from this survey.
- No extractor, pre-read, setup, doctor, or runtime behavior change.
- No provider-token, billing, runtime-token, performance, or terminal correctness claim.
- No default TUI compact extraction or profile promotion.
- No package-surface expansion; this survey is a source-repo evidence artifact unless package policy changes consistently for all fixture surveys.
