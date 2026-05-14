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
    if (!entry.isDirectory()) continue;
    const entryPath = path.join(root, entry.name);
    const summaryPath = path.join(entryPath, "summary.json");
    let keys = [entry.name];
    if (fs.existsSync(summaryPath)) {
      try {
        const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
        keys = [entry.name, summary.rawSessionKey, summary.metricSessionKey, summary.sessionKey].filter(Boolean);
      } catch {
        // Fall back to the directory name for malformed ignored telemetry.
      }
    }
    if (keys.some((key) => prefixes.some((prefix) => String(key).startsWith(prefix)))) {
      fs.rmSync(entryPath, { recursive: true, force: true });
    }
  }

  const remainingSessionEntries = fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  if (remainingSessionEntries.length === 0) {
    fs.rmSync(sessionsSummaryPath(repoRoot), { force: true });
    fs.rmSync(root, { recursive: true, force: true });
    return;
  }

  const rebuildLimit = Number.parseInt(process.env.FOOKS_TEST_METRIC_CLEANUP_REBUILD_LIMIT ?? "200", 10);
  if (Number.isFinite(rebuildLimit) && rebuildLimit >= 0 && remainingSessionEntries.length > rebuildLimit) {
    // Test helpers should not make verification time scale with a developer's accumulated local telemetry.
    // Large stores keep their existing aggregate summary and can be rebuilt by metric-writing code later.
    return;
  }

  fs.rmSync(sessionsSummaryPath(repoRoot), { force: true });
  for (const entry of remainingSessionEntries) {
    const summaryPath = path.join(root, entry.name, "summary.json");
    if (!fs.existsSync(summaryPath)) {
      continue;
    }
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
      refreshProjectMetricSummaryFromSession(repoRoot, summary.metricSessionKey ?? summary.sessionKey ?? entry.name);
    } catch {
      // Test cleanup should not fail the suite when ignored telemetry is malformed.
    }
  }
}
