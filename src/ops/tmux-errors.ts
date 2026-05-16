function errorTextParts(value: unknown, seen = new Set<unknown>()): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") return [value];
  if (Buffer.isBuffer(value)) return [value.toString("utf8")];
  if (Array.isArray(value)) return value.flatMap((part) => errorTextParts(part, seen));
  if (typeof value !== "object") return [String(value)];
  if (seen.has(value)) return [];
  seen.add(value);

  const record = value as {
    message?: unknown;
    stderr?: unknown;
    stdout?: unknown;
    output?: unknown;
    shortMessage?: unknown;
    originalMessage?: unknown;
    all?: unknown;
    cause?: unknown;
  };
  const parts = [
    ...errorTextParts(record.stderr, seen),
    ...errorTextParts(record.stdout, seen),
    ...errorTextParts(record.output, seen),
    ...errorTextParts(record.shortMessage, seen),
    ...errorTextParts(record.originalMessage, seen),
    ...errorTextParts(record.all, seen),
    ...errorTextParts(record.message, seen),
    ...errorTextParts(record.cause, seen),
  ];
  try {
    const rendered = String(value);
    if (rendered && rendered !== "[object Object]") parts.push(rendered);
  } catch {
    // Ignore hostile error renderers; structured fields above remain the source of truth.
  }
  return parts;
}

export function isTmuxNoServerRunningError(error: unknown): boolean {
  const text = errorTextParts(error).join("\n");
  return /no server running on\b/i.test(text) || /error connecting to\b[\s\S]*\bNo such file or directory\b/i.test(text);
}

export function isTmuxActivityNoServerBlocker(blocker: string): boolean {
  return blocker.startsWith("tmux activity unavailable:") && isTmuxNoServerRunningError(blocker);
}
