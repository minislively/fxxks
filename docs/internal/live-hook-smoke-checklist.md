# Internal live hook-smoke checklist

This checklist is for maintainers who want to confirm the same fooks-owned hook and status paths in real Codex / Claude Code sessions after the deterministic release smoke passes.

## Claim boundary

- Treat this as hook-smoke evidence plus local estimated context-size telemetry only.
- Do not describe it as reducing provider billing tokens or provider costs, replacing `ccusage`, intercepting Claude `Read`, or enabling automatic Claude token reductions.
- Product evidence must come from `.fooks` artifacts and `fooks status`. `.omx` is an internal planning/development harness only, not fooks product runtime state.

## Automated preflight

Run this from a branch that contains the Claude project-local context hook path and runtime/source metric foundation:

```bash
npm run build
npm run release:smoke
```

Expected observations:

- `fooks setup` reports Codex `automatic-ready` when Codex hook prerequisites pass.
- `fooks setup` reports Claude `context-hook-ready` when a Claude home exists and project-local hooks can be installed.
- The smoke drives Codex and Claude `SessionStart` / `UserPromptSubmit` hook payloads against a frontend `.tsx` fixture.
- Bare `fooks status` reports `metricTier: "estimated"`, runtime/source breakdown entries, and the provider-billing boundary.

## Manual Codex check

1. In a disposable React/TSX project, run:

   ```bash
   fooks setup
   fooks status codex
   ```

2. Open Codex in that project.
3. Prompt once about an existing `.tsx` / `.jsx` component, for example:

   ```text
   Explain src/components/Card.tsx
   ```

4. Prompt again about the same file in the same session:

   ```text
   Again, explain src/components/Card.tsx
   ```

5. Run:

   ```bash
   fooks status
   ```

Expected observations:

- Codex hook state remains attached/ready.
- Repeated same-file behavior is reflected through local `.fooks/sessions` estimated telemetry.
- `fooks status` includes a Codex `automatic-hook` runtime/source breakdown.

## Manual Claude Code check

Use this Claude-only lane for issue-backed smoke work such as
[#115](https://github.com/minislively/fooks/issues/115). It is intentionally a
project-local hook smoke. It should prove that Claude Code can receive bounded
context through fooks' `SessionStart` / `UserPromptSubmit` hooks, not that fooks
intercepts Claude `Read` calls or proves provider chargeable-token changes.

### Claude-only deterministic preflight

Run the deterministic checks first. These do not require a real Claude provider
completion:

```bash
npm run build
npm run smoke:claude
```

If the follow-up PR changes setup, release, or smoke-output wording, also run:

```bash
npm run release:smoke
```

### Disposable Claude project setup

1. In a disposable React/TSX project with Claude Code available, run:

   ```bash
   TMP_PROJECT="$(mktemp -d /tmp/fooks-claude-live.XXXXXX)"
   cd "$TMP_PROJECT"
   mkdir -p src/components
   printf '%s\n' '{"name":"fooks-claude-live-smoke","scripts":{}}' > package.json
   printf '%s\n' \
     'export function Card() {' \
     '  return (' \
     '    <section>' \
     '      <h2>Claude Live Smoke</h2>' \
     '      <p>This component verifies fooks Claude context hooks.</p>' \
     '    </section>' \
     '  );' \
     '}' \
     > src/components/Card.tsx
   fooks setup
   fooks status claude
   cat .claude/settings.local.json
   ```

2. Confirm `.claude/settings.local.json` contains only fooks `SessionStart` and
   `UserPromptSubmit` hook commands. It must not install Claude `Read`,
   `PreToolUse`, or `PostToolUse` interception.

### Native hook payload smoke

Before opening Claude Code, verify the native hook bridge with one stable session
id. The first same-file prompt is record-only; the repeated same-file prompt is
the deterministic context-injection proof.

```bash
MANUAL_SESSION_ID="manual-claude-native-smoke"

printf '%s\n' '{
  "hook_event_name": "SessionStart",
  "cwd": "'"$PWD"'",
  "session_id": "'"$MANUAL_SESSION_ID"'"
}' | fooks claude-runtime-hook --native-hook

# Expected: may print no output because it records first-seen file state.
printf '%s\n' '{
  "hook_event_name": "UserPromptSubmit",
  "cwd": "'"$PWD"'",
  "session_id": "'"$MANUAL_SESSION_ID"'",
  "prompt": "Explain src/components/Card.tsx"
}' | fooks claude-runtime-hook --native-hook

# Expected: emits hookSpecificOutput.additionalContext.
printf '%s\n' '{
  "hook_event_name": "UserPromptSubmit",
  "cwd": "'"$PWD"'",
  "session_id": "'"$MANUAL_SESSION_ID"'",
  "prompt": "Again, explain src/components/Card.tsx"
}' | fooks claude-runtime-hook --native-hook
```

Expected native-hook observations:

- `SessionStart` emits bounded `additionalContext`.
- The first eligible same-file `UserPromptSubmit` may emit no native JSON because
  it is record-only.
- The repeated same-file `UserPromptSubmit` emits
  `hookSpecificOutput.additionalContext`.
- Any emitted context preserves the boundary: project-local Claude context hook
  only, no Claude `Read` interception, and no runtime/provider token-cost
  savings claim.

### Manual Claude Code session

1. Open Claude Code in that project.
2. Prompt once about the fixture:

   ```text
   Explain src/components/Card.tsx
   ```

3. Prompt again about the same file in the same session:

   ```text
   Again, explain src/components/Card.tsx
   ```

4. Run:

   ```bash
   fooks status
   ```

Expected observations:

- Claude status is `context-hook-ready`.
- The first eligible frontend-file prompt is record/preparation only.
- The repeated same-file prompt may receive bounded `additionalContext` through
  `UserPromptSubmit`.
- `fooks status` includes a Claude `project-local-context-hook` runtime/source
  breakdown.
- Sanitized evidence should include the ready/blocker state and claim boundary,
  but should redact user-specific paths, account context, and any private prompt
  text not needed to prove hook behavior.

## Evidence to attach to a PR

Use sanitized excerpts only:

- `npm run release:smoke` success summary.
- `npm run smoke:claude` success summary for deterministic Claude hook behavior.
- `fooks status` fields showing `metricTier`, `claimBoundary`, and runtime/source keys.
- Confirmation that provider billing-token/cost proof remains deferred.
- Confirmation that `ccusage` replacement remains out of scope.
- Confirmation that Claude `Read`, `PreToolUse`, and `PostToolUse` interception
  remain out of scope for this smoke lane.

## Opt-in provider-backed live smoke

The deterministic release smoke is the default proof gate. If a maintainer wants to reduce the remaining interactive-runtime risk with real installed CLI invocations, run the opt-in provider smoke:

```bash
node scripts/live-provider-hook-smoke.mjs
FOOKS_LIVE_PROVIDER_SMOKE=1 node scripts/live-provider-hook-smoke.mjs --run-provider
```

The first command is safe and only reports installed CLI versions plus the exact opt-in command. The second command may use the local Codex / Claude Code account and can spend provider tokens, so run it only when that is intentional.

Execution-context boundary: a Codex-hosted shell can exercise the installed `claude` CLI and prove project-local hook activation, but final Claude provider completion should be rerun from the actual Claude Code environment/account that users will operate. If the Codex-hosted smoke reports `hookEvidenceObserved: true` and `providerCompleted: false`, treat that as a provider/account-context diagnostic rather than a fooks hook failure, then rerun the Claude-only command from Claude Code.

Optional flags and timeout knobs:

```bash
FOOKS_LIVE_PROVIDER_SMOKE=1 node scripts/live-provider-hook-smoke.mjs --run-provider --skip-codex
FOOKS_LIVE_PROVIDER_SMOKE=1 node scripts/live-provider-hook-smoke.mjs --run-provider --skip-claude
FOOKS_LIVE_CODEX_TIMEOUT_MS=120000 FOOKS_LIVE_PROVIDER_SMOKE=1 node scripts/live-provider-hook-smoke.mjs --run-provider --skip-claude
FOOKS_LIVE_CLAUDE_TIMEOUT_MS=120000 FOOKS_LIVE_PROVIDER_SMOKE=1 node scripts/live-provider-hook-smoke.mjs --run-provider --skip-codex
```

Expected observations:

- The script creates a disposable frontend project and installs the packed local `fooks` CLI.
- `fooks setup` must report Codex `automatic-ready` and Claude `context-hook-ready`.
- Codex normally reports `providerCompleted: true`, `lastMessageExists: true`, and `hookEvidenceObserved: true`.
- Claude can report `providerCompleted: false` when the local account, auth session, or upstream provider returns rate-limit/server/auth errors; this is acceptable only when `hookEvidenceObserved: true`, `providerFailureKind` classifies the failure, and `providerErrors` records the provider-side failure.
- `authStatus.loggedIn: true` only proves the local Claude Code auth file/session is present. It does not guarantee the upstream provider will complete the model call; `providerCompleted` is the provider completion signal.
- Provider-backed CLI invocations must leave `fooks status` at `metricTier: "estimated"` with the provider-billing boundary intact.
- Any captured evidence remains hook activation / local status evidence only; it is still not provider billing-token or provider-cost proof.

Provider failure triage:

- `auth-denied`: local Claude auth exists, but the upstream provider/account rejected the call. Fix outside fooks by repairing the Claude Code account/provider state, then rerun the Claude-only command from the real Claude Code environment.
- `auth-unavailable`: Claude Code could not use an auth provider for the requested model/session. Re-authenticate or adjust the local Claude Code provider configuration, then rerun from Claude Code.
- `rate-limited` / `server-error` / `timeout`: retry later or increase the Claude timeout knob. These do not invalidate hook evidence when `hookEvidenceObserved: true`; for final provider-completion evidence, rerun from Claude Code rather than interpreting a Codex-hosted shell failure as a fooks runtime failure.
