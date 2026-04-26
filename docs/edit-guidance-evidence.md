# Edit guidance evidence boundary

`editGuidance.patchTargets` are line-aware edit hints for frontend work. They are
useful for steering an agent toward likely patch anchors, but they are not proof
that automatic Codex frontend edits are faster or more accurate by default.

## Current reflection level

| Layer | Status | Safe claim |
| --- | --- | --- |
| Typed source ranges and patch targets | Implemented | fooks can represent line-aware edit anchors. |
| `fooks extract <file> --model-payload` | Opts in to edit guidance | A user or agent can explicitly request patch targets for a file. |
| Automatic Codex pre-read/runtime path | Compact by default | Do not claim it receives edit guidance unless a future opt-in path is implemented and tested. |
| Frontend edit outcome evidence | Not proven yet | Do not claim fewer cold-call/read/search steps until a deterministic benchmark or runtime integration proves it. |

## Evidence-lane report contract

Dry-run frontend edit-guidance evidence is local and deterministic. It may compare
a with-guidance variant against a without-guidance variant only when both variants
use the same target file and component.

Required fields:

```json
{
  "editGuidanceEnabled": true,
  "patchTargetsCount": 1,
  "freshnessChecked": true,
  "targetLocalizationSteps": ["read-model-payload", "verify-sourceFingerprint", "select-patchTarget"],
  "claimBoundary": "local/dry-run edit targeting evidence only; not provider tokenizer proof, not provider usage/billing-token, invoice/dashboard, or charged-cost proof, and not LSP semantic safety"
}
```

`targetLocalizationSteps` must be a deterministic array of named workflow steps,
not a prose summary or a subjective model-quality score.

## Boundaries that must remain explicit

- Line ranges are AST-derived edit aids, not LSP-backed semantic rename/reference
  locations.
- This evidence lane is not provider tokenizer behavior/proof, billing-token
  proof, or provider-cost proof.
- A positive dry-run report is not by itself a claim that automatic Codex runtime
  editing improved; runtime integration still requires an explicit opt-in path and
  tests that preserve compact default payload behavior.
