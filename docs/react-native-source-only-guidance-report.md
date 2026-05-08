# React Native source-only guidance report

This report consolidates the current React Native wording boundary across the merged docs, fixtures, and tests. It is a **guidance artifact only**: it does not change runtime behavior, detector behavior, payload policy, setup eligibility, or support status.

Use this report when reviewing or writing RN-facing docs/tests so the current merged claim boundary stays stable.

## Current RN lane status

- `F1`, `F13`, `F14`, and `F15` are the only RN slots that may emit narrow payload evidence.
- That narrow payload evidence is limited to the existing `rn-primitive-input-narrow-payload` policy.
- `F2`, `F9`, and `F10` remain fallback/readiness lanes with source-only concern metadata.
- No current RN surface is a broad React Native support claim.

## Slot-by-slot guidance

| Slot group | Current allowed wording | Current forbidden leap |
| --- | --- | --- |
| `F1` / `F13` / `F14` / `F15` primitive/input | Source-only RN primitive/input evidence, same-file named handler evidence, same-file inline callback evidence, accessibility/test anchor evidence, same-file local state/action evidence, measured narrow payload through `rn-primitive-input-narrow-payload` | Must not claim broad RN support, accessibility correctness, state-transition correctness, DOM/form equivalence, runtime/mobile correctness, imported callback promotion, or cross-file behavior understanding |
| `F2` style/platform/navigation | Source-only RN style/platform concern metadata and navigation concern metadata | Must not claim route existence, navigation success, stack/back/focus correctness, style correctness, or platform behavior correctness |
| `F9` interaction/list | Source-only RN interaction, gesture, and list concern metadata | Must not claim gesture correctness, runtime safety, list virtualization success, rendered-order correctness, or performance claims |
| `F10` media/layout | Source-only RN media/layout concern metadata | Must not claim image loading correctness, layout correctness, paging correctness, or broad RN support |

## Safe wording inventory

The following wording shapes remain inside the current merged boundary:

- This source contains React Native primitive/input evidence.
- This source contains source-only RN interaction hints inside the measured `F1` / `F13` narrow gate.
- This source contains same-file named-handler or inline-callback evidence observed in the same source file.
- This source contains RN accessibility/test anchor evidence.
- This source contains RN navigation concern evidence.
- This source contains RN list/rendering pattern evidence.
- This source contains RN media/layout concern evidence.
- This source contains RN state/action concern evidence.
- This source contains RN style/platform concern evidence.
- This fixture or policy record is limited to `rn-primitive-input-narrow-payload` measured evidence with no RN support promotion.
- `F2`, `F9`, and `F10` remain source-only readiness/fallback lanes.

## Forbidden claims

The following claims remain out of bounds for current RN docs/tests/reporting:

- Do not claim broad React Native support.
- Do not claim runtime correctness or mobile UI success.
- Do not claim that a gesture works correctly or is runtime-safe.
- Do not claim that list virtualization works correctly, rendered order is correct, or performance is good.
- Do not claim that an image loads correctly, layout is correct, or paging works correctly.
- Do not claim that style correctness or platform-specific behavior is verified.
- Do not claim that a route exists, navigation succeeds, or stack/back/focus behavior is verified.
- Do not claim that the app was run on a device or simulator.
- Do not claim that screen reader behavior is verified or that accessibility correctness is proven.
- Do not claim that cross-file navigation, route, or global-state behavior is understood.
- Do not claim that a state transition, reducer, or setter behavior is correct.
- Do not claim that RN primitives are equivalent to DOM controls or React Web form semantics.
- Do not claim WebView support, TUI support, or React Web equivalence from RN evidence.

## Readiness evidence surface

Use `npm run evidence:react-native-readiness` when you want the current merged RN slot boundary in one dedicated report surface. The readiness report must keep `F1` / `F13` / `F14` / `F15` as narrow measured evidence only, keep `F2` / `F9` / `F10` as readiness/fallback-only, and keep broad RN support plus runtime correctness non-claimable.

## Reviewer checklist

Before merging RN docs/tests wording, confirm all of the following:

1. `F1` / `F13` / `F14` / `F15` are still the only narrow payload-capable RN slots.
2. `F2` / `F9` / `F10` are still described as fallback/readiness lanes with source-only concern metadata.
3. The wording stays at source-observed evidence or exact measured policy names.
4. No sentence implies runtime correctness, device execution, DOM/form equivalence, or cross-file understanding.
5. No sentence widens RN evidence into WebView support, TUI support, or React Web support.

## Pointers

- Normative contract: [frontend-domain-contract](./frontend-domain-contract.md)
- Fixture baseline: [frontend-domain-fixture-expectations](./frontend-domain-fixture-expectations.md)
- Slot regression map: [frontend-fixture-boundary-regression-map](./frontend-fixture-boundary-regression-map.md)
- Architecture boundary: [domain-payload-architecture](./domain-payload-architecture.md)
