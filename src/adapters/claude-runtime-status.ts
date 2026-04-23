export const CLAUDE_ADDITIONAL_CONTEXT_MAX_CHARS = 9000;
const CLAUDE_CONTEXT_TRUNCATION_SUFFIX =
  "\n\n[fooks: context truncated to stay within Claude hook additionalContext cap. Read the full source file if exact code is required.]";

export function clampAdditionalContext(value: string): string {
  if (value.length <= CLAUDE_ADDITIONAL_CONTEXT_MAX_CHARS) return value;
  return `${value.slice(0, CLAUDE_ADDITIONAL_CONTEXT_MAX_CHARS - CLAUDE_CONTEXT_TRUNCATION_SUFFIX.length).trimEnd()}${CLAUDE_CONTEXT_TRUNCATION_SUFFIX}`;
}

export function sessionStartContext(): string {
  return clampAdditionalContext(
    "fooks: active · no Read interception · first prompt triggers context.",
  );
}

export function boundedFallbackContext(filePath: string | undefined, reason: string): string {
  const target = filePath ?? "requested frontend file";
  return clampAdditionalContext(
    `fooks: Claude context hook fallback · file: ${target} · reason: ${reason} · Read the full source file for this turn. No Claude Read interception or runtime-token savings is claimed.`,
  );
}
