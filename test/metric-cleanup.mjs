import fs from "node:fs";
import path from "node:path";

export async function cleanupMetricSessions(repoRoot, prefixes) {
  const [{ refreshProjectMetricSummaryFromSession }, { sessionsDir, sessionsSummaryPath }] = await Promise.all([
    import(path.join(repoRoot, "dist", "core", "session-metrics.js")),
    import(path.join(repoRoot, "dist", "core", "paths.js")),
  ]);
  const root = sessionsDir(repoRoot);
  if (!fs.existsSync(root)) {
    return;
  }

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && prefixes.some((prefix) => entry.name.startsWith(prefix))) {
      fs.rmSync(path.join(root, entry.name), { recursive: true, force: true });
    }
  }

  fs.rmSync(sessionsSummaryPath(repoRoot), { force: true });
  let remainingSessionCount = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const summaryPath = path.join(root, entry.name, "summary.json");
    if (!fs.existsSync(summaryPath)) {
      continue;
    }
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
      refreshProjectMetricSummaryFromSession(repoRoot, summary.sessionKey ?? entry.name);
      remainingSessionCount += 1;
    } catch {
      // Test cleanup should not fail the suite when ignored telemetry is malformed.
    }
  }

  if (remainingSessionCount === 0) {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
