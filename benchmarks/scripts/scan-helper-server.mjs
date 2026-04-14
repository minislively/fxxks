import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const require = createRequire(import.meta.url);

const { ensureProjectDataDirs } = require(path.join(repoRoot, "dist", "core", "paths.js"));
const { scanProject } = require(path.join(repoRoot, "dist", "core", "scan.js"));

const socketPath = process.argv[2];

if (!socketPath) {
  throw new Error("scan-helper-server requires a socket path argument");
}

fs.rmSync(socketPath, { force: true });

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function respond(socket, payload) {
  socket.end(`${JSON.stringify(payload)}\n`);
}

const server = net.createServer((socket) => {
  let raw = "";
  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    raw += chunk;
    if (!raw.includes("\n")) {
      return;
    }

    let request;
    try {
      request = JSON.parse(raw.trim());
    } catch (error) {
      respond(socket, { ok: false, error: error instanceof Error ? error.message : String(error) });
      return;
    }

    try {
      switch (request?.command) {
        case "ping":
          respond(socket, { ok: true });
          return;
        case "scan": {
          const cwd = typeof request.cwd === "string" ? request.cwd : process.cwd();
          const requestStartedAt = performance.now();
          const ensureStartedAt = performance.now();
          ensureProjectDataDirs(cwd);
          const helperEnsureProjectDataDirsMs = round(performance.now() - ensureStartedAt);
          const scanStartedAt = performance.now();
          const result = scanProject(cwd);
          const helperScanMs = round(performance.now() - scanStartedAt);
          respond(socket, {
            ok: true,
            result,
            commandPathBreakdown: {
              helperRequestMs: round(performance.now() - requestStartedAt),
              helperEnsureProjectDataDirsMs,
              helperScanMs,
            },
          });
          return;
        }
        case "shutdown":
          respond(socket, { ok: true });
          server.close(() => {
            fs.rmSync(socketPath, { force: true });
            process.exit(0);
          });
          return;
        default:
          respond(socket, { ok: false, error: `Unknown helper command: ${request?.command ?? "<none>"}` });
      }
    } catch (error) {
      respond(socket, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
});

server.listen(socketPath);

process.on("SIGTERM", () => {
  server.close(() => {
    fs.rmSync(socketPath, { force: true });
    process.exit(0);
  });
});
