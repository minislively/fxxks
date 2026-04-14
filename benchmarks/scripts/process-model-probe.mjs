import { loadFixtureSet, runProcessModelProbeSuite, writeResultArtifacts, printSummaryLines, processModelProbeSummary } from "./lib.mjs";

export async function main() {
  const fixtureSet = loadFixtureSet();
  const runId = new Date().toISOString();
  const report = {
    runId,
    fixtureSetVersion: fixtureSet.version,
    ...(await runProcessModelProbeSuite()),
  };
  const artifacts = writeResultArtifacts("process-model-probe.json", report, runId);
  printSummaryLines(processModelProbeSummary(report, artifacts.latestPath));
  console.log(JSON.stringify({ ...report, artifacts }, null, 2));
}

await main();
