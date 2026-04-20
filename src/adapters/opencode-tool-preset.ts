import fs from "node:fs";
import path from "node:path";

const TOOL_RELATIVE_PATH = path.join(".opencode", "tools", "fooks_extract.ts");
const COMMAND_RELATIVE_PATH = path.join(".opencode", "commands", "fooks-extract.md");
const TOOL_NAME = "fooks_extract";
const COMMAND_NAME = "fooks-extract";

export interface OpenCodeToolPresetResult {
  command: "install opencode-tool";
  runtime: "opencode";
  artifactKind: "custom-tool";
  artifactPath: string;
  commandPath: string;
  created: boolean;
  modified: boolean;
  toolCreated: boolean;
  toolModified: boolean;
  commandCreated: boolean;
  commandModified: boolean;
  toolName: typeof TOOL_NAME;
  commandName: typeof COMMAND_NAME;
  mode: "manual/semi-automatic";
  nextSteps: string[];
}

function renderOpenCodeTool(displayCliName: string): string {
  const cliName = JSON.stringify(displayCliName);

  return `import { tool } from "@opencode-ai/plugin"
import { execFile } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const FOOKS_COMMAND = ${cliName}
const MAX_BUFFER_BYTES = 10 * 1024 * 1024
const SUPPORTED_EXTENSIONS = new Set([".tsx", ".jsx"])

function assertInsideBase(baseDir: string, requestedPath: string): void {
  const relative = path.relative(baseDir, requestedPath)
  if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
    throw new Error("fooks_extract only reads files inside the current opencode project/worktree")
  }
}

type SafeResolvedPath = {
  baseDir: string
  filePath: string
}

async function resolveSafeFilePath(filePath: string, baseDir: string | undefined): Promise<SafeResolvedPath> {
  if (!baseDir || !baseDir.trim()) {
    throw new Error("fooks_extract could not determine the current opencode project directory")
  }
  if (!filePath || !filePath.trim()) {
    throw new Error("fooks_extract requires a filePath")
  }
  if (filePath.includes("\\0")) {
    throw new Error("fooks_extract rejects NUL bytes in filePath")
  }

  const resolvedBase = path.resolve(baseDir)
  const requested = path.resolve(resolvedBase, filePath)
  assertInsideBase(resolvedBase, requested)

  const ext = path.extname(requested).toLowerCase()
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error("fooks_extract currently supports .tsx and .jsx files only")
  }

  const [realBase, realRequested] = await Promise.all([
    fs.realpath(resolvedBase),
    fs.realpath(requested),
  ])
  assertInsideBase(realBase, realRequested)

  return { baseDir: realBase, filePath: realRequested }
}

export default tool({
  description:
    "fooks_extract returns a fooks model-facing payload for a React TSX/JSX file. " +
    "This is manual/semi-automatic support for opencode; it does not intercept read calls or claim automatic token savings.",
  args: {
    filePath: tool.schema.string().describe("Project-relative .tsx or .jsx file to extract with fooks"),
  },
  async execute(args, context) {
    const baseDir = context.worktree || context.directory
    const resolved = await resolveSafeFilePath(args.filePath, baseDir)
    const { stdout } = await execFileAsync(
      FOOKS_COMMAND,
      ["extract", resolved.filePath, "--model-payload"],
      { cwd: resolved.baseDir, encoding: "utf8", maxBuffer: MAX_BUFFER_BYTES },
    )

    return stdout.trim()
  },
})
`;
}

function renderOpenCodeCommand(): string {
  return `---
description: Explicitly steer opencode to fooks_extract for a React TSX/JSX file
---

Call the \`fooks_extract\` custom tool with \`filePath\` set to \`$ARGUMENTS\`.

Use this when the user wants a fooks model-facing payload for a project-relative \`.tsx\` or \`.jsx\` file. If \`$ARGUMENTS\` is empty, ask for a project-relative TSX/JSX file path before calling the tool.

After the tool returns, summarize the payload and continue from that reduced context. This command is explicit tool-selection steering, not automatic opencode \`read\` interception. Do not claim automatic opencode read interception or runtime-token savings. If the tool reports that the file is unsupported or outside the project, explain the error and ask for a supported in-project file.
`;
}

function writeGeneratedArtifact(filePath: string, content: string): { created: boolean; modified: boolean } {
  const created = !fs.existsSync(filePath);
  const previous = created ? null : fs.readFileSync(filePath, "utf8");
  const modified = previous !== content;

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (modified) {
    fs.writeFileSync(filePath, content, "utf8");
  }

  return { created, modified };
}

export function installOpenCodeToolPreset(
  cwd = process.cwd(),
  displayCliName = "fooks",
): OpenCodeToolPresetResult {
  const artifactPath = path.join(cwd, TOOL_RELATIVE_PATH);
  const commandPath = path.join(cwd, COMMAND_RELATIVE_PATH);
  const toolArtifact = writeGeneratedArtifact(artifactPath, renderOpenCodeTool(displayCliName));
  const commandArtifact = writeGeneratedArtifact(commandPath, renderOpenCodeCommand());

  return {
    command: "install opencode-tool",
    runtime: "opencode",
    artifactKind: "custom-tool",
    artifactPath,
    commandPath,
    created: toolArtifact.created || commandArtifact.created,
    modified: toolArtifact.modified || commandArtifact.modified,
    toolCreated: toolArtifact.created,
    toolModified: toolArtifact.modified,
    commandCreated: commandArtifact.created,
    commandModified: commandArtifact.modified,
    toolName: TOOL_NAME,
    commandName: COMMAND_NAME,
    mode: "manual/semi-automatic",
    nextSteps: [
      "Open opencode in this project and run /fooks-extract path/to/File.tsx when you want a fooks model-facing payload.",
      "The /fooks-extract command is explicit tool-selection steering toward fooks_extract; it does not replace normal read behavior.",
      "This custom tool and command are manual/semi-automatic; they do not prove automatic opencode runtime token savings.",
    ],
  };
}
