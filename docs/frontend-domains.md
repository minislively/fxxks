# Frontend domains

This document describes how fooks should talk about frontend domains in the frontend-first architecture. It is docs-only architecture language and does not change detector behavior, payload policy, setup eligibility, runtime adapters, or public support wording.

## Domain model

A frontend domain is the UI/runtime family suggested by current source evidence. A concern is task-relevant information inside or near that source. The two must stay separate.

```text
source syntax
→ domain evidence: which frontend family is present?
→ concern evidence: what editing context matters?
→ policy decision: may any compact or narrow context be reused?
→ packet/work order: what should the agent inspect first?
```

Domain evidence is an observation. It is not permission. Concern evidence is useful editing context. It is not a domain promotion.

## Domain taxonomy

| Domain | Source-derived evidence | Current outcome language | Non-claim |
| --- | --- | --- | --- |
| React Web | DOM-oriented JSX, forms, native controls, browser events, `className`, ARIA attributes, and web imports without stronger boundary signals. | Strongest current frontend lane when existing extractor/readiness rules allow it. | Not whole-app understanding, visual correctness, or route-wide proof. |
| React Native | `react-native` imports, native primitives, `TextInput`, `Pressable`, `FlatList`, `StyleSheet`, platform or navigation markers. | Evidence lane by default, with only the existing measured primitive/input narrow gate when policy allows it. | Not mobile runtime correctness, gesture correctness, native accessibility proof, or DOM equivalence. |
| WebView boundary | `react-native-webview`, `<WebView>`, `source`, injected JavaScript, message bridge, or HTML/URI bridge markers. | Fallback-first boundary lane. | Not bridge safety, WebView runtime correctness, or compact-reuse permission. |
| TUI / Ink | Ink-like imports, `Box`, `Text`, `useInput`, terminal layout, key-input handlers. | Candidate/evidence lane. | Not terminal behavior correctness or terminal UX proof. |
| Mixed | Multiple strong domain families or conflicting boundary signals in one file. | Safety state; fall back or defer according to the strongest boundary. | Not a request to choose the convenient domain. |
| Unknown | Weak, absent, or unclassified frontend-family evidence. | Defer semantic domain claims; use ordinary behavior only when existing eligibility allows it. | Not implicit React Web. |

## Domain vs concern examples

| Concern evidence | Useful for | Must not imply |
| --- | --- | --- |
| form state libraries or same-file submit handlers | edit context for form changes | runtime validation proof or compact permission by itself |
| schema libraries or resolver usage | fields and validation-context hints | backend contract proof or safe automatic edits |
| routing imports or route/search params | navigation-related edit context | route existence, navigation success, or cross-file understanding |
| styling helpers or utility classes | styling-related edit context | visual correctness, design-system compliance, or imported-style resolution |
| state libraries or selectors | state-related edit context | reducer behavior proof, global state understanding, or state-flow proof |

Concern profiles can enrich a work order after a domain and policy decision. They cannot bypass fallback rules.

## Promotion ladder

A frontend lane moves from evidence to stronger product wording only through explicit gates:

1. **Observed evidence:** source facts and fixture examples exist.
2. **Boundary doc:** claim/non-claim language names the exact measured scope.
3. **Policy gate:** planner rules say what may be compact, narrow, fallback, or deferred.
4. **Fixture and test evidence:** representative pass/fail cases protect the boundary.
5. **Receipt surface:** command output or reports preserve what was observed and why.
6. **Public wording:** README/release wording uses only the measured scope.

Stopping at any gate is acceptable. Falling back to normal source reading is the safe default.

## Architecture rule

The intended direction is: shared syntax facts feed domain profiles; domain profiles and concern evidence feed policy; policy feeds packet/work-order assembly; runtime adapters deliver only what policy authorized. Reporting surfaces may summarize the result, but they do not become payload authority.

## Out of scope for this pass

This pass does not add or promote any domain lane, expand the React Native primitive/input gate, change WebView fallback-first posture, change detector logic, or change runtime/provider behavior.

## React Web

React Web is the browser/DOM frontend lane.

## WebView

WebView is the embedded browser/bridge boundary lane.

## React Native / RN

React Native / RN is the native-rendered React frontend lane.

A cross-domain claim must list each domain separately and attach evidence to each one.

Architecture summary: React Web, WebView, and React Native are separate frontend domains and must not be collapsed into one support claim.
