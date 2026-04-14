import { runAllSuites, writeResultArtifacts, printSummaryLines, relativeToRepo, mergeHarnessBreakdown, formatOutsideScanBreakdown, formatDispatchSubBreakdown, formatHarnessBreakdown } from "./lib.mjs";

export async function main() {
  const { runId, envelope } = await runAllSuites();
  const firstArtifacts = writeResultArtifacts("benchmark.json", envelope, runId);
  envelope.suites.scanCache.harnessBreakdown = mergeHarnessBreakdown(
    envelope.suites.scanCache.harnessBreakdown,
    firstArtifacts.harnessBreakdown,
  );
  const artifacts = writeResultArtifacts("benchmark.json", envelope, runId);
  printSummaryLines([
    `fooks benchmark | all suites | latest: ${relativeToRepo(artifacts.latestPath)}`,
    `- gates passed: ${envelope.gates.passed}`,
    `- scan cold/warm/partial(single): ${envelope.suites.scanCache.runs.cold.avgMs}/${envelope.suites.scanCache.runs.warm.avgMs}/${envelope.suites.scanCache.runs.partialSingle.avgMs}ms`,
    `- warm runtime split: cli ${envelope.suites.scanCache.runs.warm.runtimeBreakdown.cliWallMs}ms / scan ${envelope.suites.scanCache.runs.warm.runtimeBreakdown.scanCoreMs}ms / outside-scan ${envelope.suites.scanCache.runs.warm.runtimeBreakdown.outsideScanMs}ms`,
    `- warm outside-scan breakdown: ${formatOutsideScanBreakdown(envelope.suites.scanCache.runs.warm)}`,
    `- warm dispatch sub-breakdown: ${formatDispatchSubBreakdown(envelope.suites.scanCache.runs.warm)}`,
    `- scan harness overhead: ${formatHarnessBreakdown(envelope.suites.scanCache.harnessBreakdown)}`,
    `- process-model probe current/launcher/direct warm: ${envelope.suites.processModelProbe.runs.currentCliWarm.avgMs}/${envelope.suites.processModelProbe.runs.launcherToHelperWarm.avgMs}/${envelope.suites.processModelProbe.runs.directHelperWarm.avgMs}ms`,
    `- helper startup avg: ${envelope.suites.processModelProbe.helperStartupAvgMs}ms`,
    `- extract fixtures: ${envelope.suites.extract.length}`,
    `- preservation fixtures: ${envelope.suites.preservation.fixtures.length}`,
    `- mode decision fixtures: ${envelope.suites.modeDecision.fixtures.length}`,
  ]);
  console.log(JSON.stringify({ ...envelope, artifacts }, null, 2));
}

await main();
