import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  evaluateReactWebDecisionHandoffBenchmark,
  evaluateReactWebDecisionStopBenchmark,
} = require(path.join(process.cwd(), "dist", "core", "react-web-decision-handoff-benchmark.js"));

export {
  evaluateReactWebDecisionHandoffBenchmark,
  evaluateReactWebDecisionStopBenchmark,
};
