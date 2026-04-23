export type GitPorcelainStatusCode =
  | " "
  | "M"
  | "A"
  | "D"
  | "R"
  | "C"
  | "T"
  | "U"
  | "?"
  | "!";

export type WorktreeChangeKind =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "copied"
  | "type-changed"
  | "untracked"
  | "ignored"
  | "unmerged"
  | "unknown";

export type WorktreeStatusEntry = {
  path: string;
  originalPath?: string;
  indexStatus: GitPorcelainStatusCode;
  worktreeStatus: GitPorcelainStatusCode;
  kind: WorktreeChangeKind;
  tracked: boolean;
  conflicted: boolean;
  raw: string;
};

export type WorktreeStatusSummary = {
  clean: boolean;
  entries: WorktreeStatusEntry[];
  changedPaths: string[];
  trackedPaths: string[];
  untrackedPaths: string[];
  ignoredPaths: string[];
  conflictedPaths: string[];
};

export type ParseWorktreeStatusOptions = {
  nulTerminated?: boolean;
};

const CONFLICT_STATUS_PAIRS = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

function normalizeStatusCode(value: string | undefined): GitPorcelainStatusCode {
  switch (value) {
    case " ":
    case "M":
    case "A":
    case "D":
    case "R":
    case "C":
    case "T":
    case "U":
    case "?":
    case "!":
      return value;
    default:
      return " ";
  }
}

function classifyEntry(indexStatus: GitPorcelainStatusCode, worktreeStatus: GitPorcelainStatusCode): WorktreeChangeKind {
  const pair = `${indexStatus}${worktreeStatus}`;
  if (CONFLICT_STATUS_PAIRS.has(pair) || indexStatus === "U" || worktreeStatus === "U") {
    return "unmerged";
  }
  if (pair === "??") return "untracked";
  if (pair === "!!") return "ignored";
  if (indexStatus === "R" || worktreeStatus === "R") return "renamed";
  if (indexStatus === "C" || worktreeStatus === "C") return "copied";
  if (indexStatus === "T" || worktreeStatus === "T") return "type-changed";
  if (indexStatus === "A" || worktreeStatus === "A") return "added";
  if (indexStatus === "D" || worktreeStatus === "D") return "deleted";
  if (indexStatus === "M" || worktreeStatus === "M") return "modified";
  return "unknown";
}

function parsePorcelainLine(line: string): WorktreeStatusEntry | undefined {
  if (!line) return undefined;
  const indexStatus = normalizeStatusCode(line[0]);
  const worktreeStatus = normalizeStatusCode(line[1]);
  const pathSpec = line.slice(3);
  if (!pathSpec) return undefined;

  let filePath = pathSpec;
  let originalPath: string | undefined;
  const renameSeparator = " -> ";
  const separatorIndex = pathSpec.indexOf(renameSeparator);
  if (separatorIndex >= 0) {
    originalPath = pathSpec.slice(0, separatorIndex);
    filePath = pathSpec.slice(separatorIndex + renameSeparator.length);
  }

  const kind = classifyEntry(indexStatus, worktreeStatus);
  return {
    path: filePath,
    originalPath,
    indexStatus,
    worktreeStatus,
    kind,
    tracked: kind !== "untracked" && kind !== "ignored",
    conflicted: kind === "unmerged",
    raw: line,
  };
}

function parseNulTerminatedPorcelain(output: string): WorktreeStatusEntry[] {
  const fields = output.split("\0").filter((field) => field.length > 0);
  const entries: WorktreeStatusEntry[] = [];

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    const entry = parsePorcelainLine(field);
    if (!entry) continue;

    if ((entry.indexStatus === "R" || entry.indexStatus === "C") && index + 1 < fields.length) {
      entry.originalPath = fields[index + 1];
      entry.raw = `${field}\0${fields[index + 1]}`;
      index += 1;
    }

    entries.push(entry);
  }

  return entries;
}

export function parseWorktreeStatus(output: string, options: ParseWorktreeStatusOptions = {}): WorktreeStatusEntry[] {
  if (!output.trim()) return [];
  if (options.nulTerminated || output.includes("\0")) {
    return parseNulTerminatedPorcelain(output);
  }
  return output
    .split(/\r?\n/)
    .map((line) => parsePorcelainLine(line))
    .filter((entry): entry is WorktreeStatusEntry => Boolean(entry));
}

export function summarizeWorktreeStatus(entries: WorktreeStatusEntry[]): WorktreeStatusSummary {
  const changedEntries = entries.filter((entry) => entry.kind !== "ignored");
  return {
    clean: changedEntries.length === 0,
    entries,
    changedPaths: changedEntries.map((entry) => entry.path),
    trackedPaths: changedEntries.filter((entry) => entry.tracked).map((entry) => entry.path),
    untrackedPaths: entries.filter((entry) => entry.kind === "untracked").map((entry) => entry.path),
    ignoredPaths: entries.filter((entry) => entry.kind === "ignored").map((entry) => entry.path),
    conflictedPaths: entries.filter((entry) => entry.conflicted).map((entry) => entry.path),
  };
}

export function parseAndSummarizeWorktreeStatus(
  output: string,
  options: ParseWorktreeStatusOptions = {},
): WorktreeStatusSummary {
  return summarizeWorktreeStatus(parseWorktreeStatus(output, options));
}
