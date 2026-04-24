import fs from "node:fs";
import path from "node:path";
import { discoverProjectFiles } from "./discover";
import { extractFile } from "./extract";
import { toModelFacingPayload } from "./payload/model-facing";
import { assessPayloadReadiness } from "./payload/readiness";

const IGNORE = new Set([".git", "node_modules", "dist", ".omx", ".fooks"]);
const CODEX_TS_JS_BETA_EXTENSIONS = new Set([".ts", ".js"]);

export type SetupEligibleSourceKind = "react-component" | "codex-ts-js-beta";

export type SetupEligibleSources = {
  reactComponentFiles: string[];
  codexTsJsBetaFiles: string[];
  sampleFile: string | null;
  sampleKind: SetupEligibleSourceKind | null;
};

function walkProjectFiles(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkProjectFiles(fullPath, out);
      continue;
    }
    out.push(fullPath);
  }
}

function isStrongCodexTsJsBetaCandidate(filePath: string, cwd: string): boolean {
  if (!CODEX_TS_JS_BETA_EXTENSIONS.has(path.extname(filePath).toLowerCase())) return false;

  const extracted = extractFile(filePath);
  if (extracted.language !== "ts" && extracted.language !== "js") return false;

  const payload = toModelFacingPayload(extracted, cwd);
  return assessPayloadReadiness(extracted, payload).ready;
}

export function discoverSetupEligibleSources(cwd = process.cwd()): SetupEligibleSources {
  const reactComponentFiles = discoverProjectFiles(cwd)
    .filter((item) => item.kind === "component")
    .map((item) => item.filePath)
    .sort();

  const allFiles: string[] = [];
  walkProjectFiles(cwd, allFiles);
  const codexTsJsBetaFiles = allFiles
    .filter((filePath) => isStrongCodexTsJsBetaCandidate(filePath, cwd))
    .sort();

  if (reactComponentFiles.length > 0) {
    return {
      reactComponentFiles,
      codexTsJsBetaFiles,
      sampleFile: reactComponentFiles[0],
      sampleKind: "react-component",
    };
  }

  if (codexTsJsBetaFiles.length > 0) {
    return {
      reactComponentFiles,
      codexTsJsBetaFiles,
      sampleFile: codexTsJsBetaFiles[0],
      sampleKind: "codex-ts-js-beta",
    };
  }

  return {
    reactComponentFiles,
    codexTsJsBetaFiles,
    sampleFile: null,
    sampleKind: null,
  };
}
