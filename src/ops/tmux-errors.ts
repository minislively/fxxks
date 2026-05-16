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
    cause?: unknown;
  };
  return [
    ...errorTextParts(record.stderr, seen),
    ...errorTextParts(record.stdout, seen),
    ...errorTextParts(record.output, seen),
    ...errorTextParts(record.message, seen),
    ...errorTextParts(record.cause, seen),
  ];
}

export function isTmuxNoServerRunningError(error: unknown): boolean {
  return /no server running on\b/i.test(errorTextParts(error).join("\n"));
}
