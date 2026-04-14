import fs from "node:fs";
import net from "node:net";
import { performance } from "node:perf_hooks";

const socketPath = process.argv[2];
const cwd = process.argv[3] ?? process.cwd();

if (!socketPath) {
  throw new Error("scan-helper-client requires <socketPath> <cwd?>");
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function maybeWriteBenchTiming(breakdown) {
  const timingPath = process.env.FOOKS_BENCH_TIMING_PATH?.trim();
  if (!timingPath) {
    return;
  }

  try {
    fs.writeFileSync(
      timingPath,
      JSON.stringify(
        {
          schemaVersion: 1,
          command: "scan-helper-client",
          commandPathBreakdown: breakdown,
        },
        null,
        2,
      ),
    );
  } catch {
    // Benchmark-only transport failures must never change probe behavior.
  }
}

function requestHelper(socketPathValue, payload) {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const socket = net.createConnection(socketPathValue);
    let raw = "";
    let connectMs = 0;
    let settled = false;
    const finish = (callback) => (value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };

    socket.setEncoding("utf8");
    socket.on("connect", () => {
      connectMs = round(performance.now() - startedAt);
      socket.write(`${JSON.stringify(payload)}\n`);
    });
    socket.on("data", (chunk) => {
      raw += chunk;
      if (!raw.includes("\n")) {
        return;
      }
      socket.end();
      try {
        finish(resolve)({
          response: JSON.parse(raw.trim()),
          helperConnectMs: connectMs,
          helperRpcMs: round(performance.now() - startedAt),
        });
      } catch (error) {
        finish(reject)(error);
      }
    });
    socket.on("error", finish(reject));
    socket.on("end", () => {
      if (!raw.trim()) {
        finish(reject)(new Error("Helper closed without a payload"));
      }
    });
  });
}

const commandStartedAt = performance.now();
const { response, helperConnectMs, helperRpcMs } = await requestHelper(socketPath, { command: "scan", cwd });

if (!response?.ok) {
  throw new Error(response?.error ?? "Helper request failed");
}

const commandDispatchMs = round(performance.now() - commandStartedAt);
const commandDispatchResidualMs = round(Math.max(0, commandDispatchMs - helperRpcMs));
const serializeStartedAt = performance.now();
const serialized = JSON.stringify(response.result, null, 2);
const resultSerializeMs = round(performance.now() - serializeStartedAt);
const stdoutStartedAt = performance.now();
process.stdout.write(`${serialized}\n`);
const stdoutWriteMs = round(performance.now() - stdoutStartedAt);

maybeWriteBenchTiming({
  commandDispatchMs,
  helperConnectMs,
  helperRpcMs,
  commandDispatchResidualMs,
  resultSerializeMs,
  stdoutWriteMs,
});
