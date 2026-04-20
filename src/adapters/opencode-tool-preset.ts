import fs from "node:fs";
import path from "node:path";

const TOOL_RELATIVE_PATH = path.join(".opencode", "tools", "fooks_extract.ts");
const TOOL_NAME = "fooks_extract";

export interface OpenCodeToolPresetResult {
  command: "install opencode-tool";
  runtime: "opencode";
  artifactKind: "custom-tool";
  artifactPath: string;
  created: boolean;
  modified: boolean;
  toolName: typeof TOOL_NAME;
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

export function installOpenCodeToolPreset(
  cwd = process.cwd(),
  displayCliName = "fooks",
): OpenCodeToolPresetResult {
  const artifactPath = path.join(cwd, TOOL_RELATIVE_PATH);
  const artifactDir = path.dirname(artifactPath);
  const content = renderOpenCodeTool(displayCliName);
  const created = !fs.existsSync(artifactPath);
  const previous = created ? null : fs.readFileSync(artifactPath, "utf8");
  const modified = previous !== content;

  fs.mkdirSync(artifactDir, { recursive: true });
  if (modified) {
    fs.writeFileSync(artifactPath, content, "utf8");
  }

  return {
    command: "install opencode-tool",
    runtime: "opencode",
    artifactKind: "custom-tool",
    artifactPath,
    created,
    modified,
    toolName: TOOL_NAME,
    mode: "manual/semi-automatic",
    nextSteps: [
      "Open opencode in this project and ask it to call fooks_extract for a .tsx/.jsx file when you want a fooks model-facing payload.",
      "This custom tool is manual/semi-automatic; it does not intercept opencode read calls or prove automatic runtime token savings.",
    ],
  };
}
