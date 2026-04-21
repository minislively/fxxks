import fs from "node:fs";
import path from "node:path";
import { adapterDir } from "../core/paths";
import { runtimeManifestPath } from "./shared";

type ClaudeStatusState = "handoff-ready" | "blocked";

type FileStatus = {
  path: string;
  exists: boolean;
  valid?: boolean;
  blocker?: string;
};

type ClaudeManifestStatus = {
  home: string;
  path: string;
  homeExists: boolean;
  exists: boolean;
  valid?: boolean;
  runtimeMatches?: boolean;
  projectRootMatches?: boolean;
  blocker?: string;
};

export type ClaudeRuntimeStatus = {
  runtime: "claude";
  state: ClaudeStatusState;
  mode: "manual-shared-handoff";
  ready: boolean;
  blockers: string[];
  adapter: {
    installed: boolean;
    directory: string;
    adapterJson: FileStatus;
    contextTemplate: FileStatus;
  };
  manifest: ClaudeManifestStatus;
  nextSteps: string[];
  notes: string[];
};

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function adapterJsonStatus(filePath: string): FileStatus {
  if (!fs.existsSync(filePath)) {
    return { path: filePath, exists: false, blocker: "Claude adapter metadata is missing" };
  }

  try {
    const parsed = readJson(filePath) as { runtime?: unknown };
    if (parsed.runtime !== "claude") {
      return { path: filePath, exists: true, valid: false, blocker: "Claude adapter metadata has an unexpected runtime" };
    }
    return { path: filePath, exists: true, valid: true };
  } catch (error) {
    return {
      path: filePath,
      exists: true,
      valid: false,
      blocker: `Claude adapter metadata is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function contextTemplateStatus(filePath: string): FileStatus {
  if (!fs.existsSync(filePath)) {
    return { path: filePath, exists: false, blocker: "Claude context template is missing" };
  }
  return { path: filePath, exists: true, valid: true };
}

function manifestStatus(cwd: string): ClaudeManifestStatus {
  const { home, manifestPath } = runtimeManifestPath("claude", cwd);
  const homeExists = fs.existsSync(home);
  if (!homeExists) {
    return {
      home,
      path: manifestPath,
      homeExists,
      exists: false,
      blocker: "Claude runtime home not detected",
    };
  }

  if (!fs.existsSync(manifestPath)) {
    return {
      home,
      path: manifestPath,
      homeExists,
      exists: false,
      blocker: "Claude runtime manifest is missing",
    };
  }

  try {
    const parsed = readJson(manifestPath) as { runtime?: unknown; projectRoot?: unknown };
    const runtimeMatches = parsed.runtime === "claude";
    const projectRootMatches = parsed.projectRoot === cwd;
    const valid = runtimeMatches && projectRootMatches;
    return {
      home,
      path: manifestPath,
      homeExists,
      exists: true,
      valid,
      runtimeMatches,
      projectRootMatches,
      blocker: valid ? undefined : "Claude runtime manifest does not match this project",
    };
  } catch (error) {
    return {
      home,
      path: manifestPath,
      homeExists,
      exists: true,
      valid: false,
      blocker: `Claude runtime manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function blockersFrom(...items: Array<FileStatus | ClaudeManifestStatus>): string[] {
  return items.flatMap((item) => (item.blocker ? [item.blocker] : []));
}

export function readClaudeRuntimeStatus(cwd = process.cwd()): ClaudeRuntimeStatus {
  const directory = adapterDir("claude", cwd);
  const adapterJson = adapterJsonStatus(path.join(directory, "adapter.json"));
  const contextTemplate = contextTemplateStatus(path.join(directory, "context-template.md"));
  const manifest = manifestStatus(cwd);
  const blockers = blockersFrom(adapterJson, contextTemplate, manifest);
  const ready = blockers.length === 0;

  return {
    runtime: "claude",
    state: ready ? "handoff-ready" : "blocked",
    mode: "manual-shared-handoff",
    ready,
    blockers,
    adapter: {
      installed: adapterJson.valid === true && contextTemplate.valid === true,
      directory,
      adapterJson,
      contextTemplate,
    },
    manifest,
    nextSteps: ready
      ? [
          "Use fooks extract <file> --model-payload or the generated Claude handoff artifacts when sharing reduced context with Claude.",
          "Do not describe this as Claude prompt interception or automatic Claude token savings.",
        ]
      : [
          "Run fooks attach claude or fooks setup after ensuring the Claude runtime home exists.",
          "Use fooks extract <file> --model-payload for explicit manual handoff until Claude status becomes handoff-ready.",
        ],
    notes: [
      "Claude automatic hooks are not enabled by fooks.",
      "Claude status is a read-only handoff-artifact health check, not a runtime interception or token-savings claim.",
    ],
  };
}
