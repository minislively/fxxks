export function isTmuxNoServerRunningError(error: unknown): boolean {
  const maybeError = error && typeof error === "object" ? (error as { message?: unknown; stderr?: unknown }) : {};
  const stderr = maybeError.stderr;
  const stderrText = Buffer.isBuffer(stderr) ? stderr.toString("utf8") : typeof stderr === "string" ? stderr : "";
  const message = typeof maybeError.message === "string" ? maybeError.message : String(error ?? "");
  return /no server running on\b/i.test(`${stderrText}\n${message}`);
}
