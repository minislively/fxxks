import fs from "node:fs";
import path from "node:path";

const IGNORE = new Set([".git", "node_modules", "dist", ".omx", ".fooks"]);
const COMPONENT_EXTS = new Set([".tsx", ".jsx"]);

export type FileTarget = {
  filePath: string;
  kind: "component" | "linked-ts";
};

export type DiscoveryStats = {
  directoriesVisited: number;
  filesVisited: number;
  componentFileCount: number;
  linkedTsCount: number;
  importProbeCount: number;
  importResolveCacheHits: number;
};

export type DiscoveryResult = {
  targets: FileTarget[];
  stats: DiscoveryStats;
};

function walk(dir: string, out: string[], stats: DiscoveryStats): void {
  stats.directoriesVisited += 1;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out, stats);
      continue;
    }
    stats.filesVisited += 1;
    out.push(full);
  }
}

function readText(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function resolveRelativeImport(
  fromFile: string,
  specifier: string,
  existingFiles: ReadonlySet<string>,
  resolutionCache: Map<string, string | null>,
  stats: DiscoveryStats,
): string | null {
  const base = path.resolve(path.dirname(fromFile), specifier);
  if (resolutionCache.has(base)) {
    stats.importResolveCacheHits += 1;
    return resolutionCache.get(base) ?? null;
  }
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.jsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.jsx"),
  ];
  for (const candidate of candidates) {
    stats.importProbeCount += 1;
    if (existingFiles.has(candidate)) {
      resolutionCache.set(base, candidate);
      return candidate;
    }
  }
  resolutionCache.set(base, null);
  return null;
}

type RelativeImport = {
  resolved: string;
  isTypeOnly: boolean;
};

function relativeImports(
  filePath: string,
  existingFiles: ReadonlySet<string>,
  resolutionCache: Map<string, string | null>,
  stats: DiscoveryStats,
): RelativeImport[] {
  const text = readText(filePath);
  const matches = text.matchAll(/import\s+(type\s+)?(?:[\s\S]*?)from\s+["'](\.[^"']+)["']|import\s+["'](\.[^"']+)["']/g);
  const imports = new Map<string, RelativeImport>();
  for (const match of matches) {
    const specifier = match[2] ?? match[3];
    if (!specifier) continue;
    const resolved = resolveRelativeImport(filePath, specifier, existingFiles, resolutionCache, stats);
    if (resolved) {
      imports.set(resolved, {
        resolved,
        isTypeOnly: Boolean(match[1]),
      });
    }
  }
  return [...imports.values()];
}

function isQualifyingLinkedTs(filePath: string, componentFile: string, isTypeOnly: boolean): boolean {
  if (path.dirname(filePath) !== path.dirname(componentFile)) {
    return false;
  }
  if (isTypeOnly) return true;
  const base = path.basename(filePath).toLowerCase();
  const componentStem = path.basename(componentFile, path.extname(componentFile)).toLowerCase();
  const isNamedContractFile =
    base.endsWith(".types.ts") ||
    base.endsWith(".props.ts") ||
    base.endsWith(".interface.ts") ||
    base.endsWith(".interfaces.ts") ||
    base.endsWith(".config.ts");
  const isComponentScopedUtility =
    (base.endsWith(".util.ts") || base.endsWith(".utils.ts") || base.endsWith(".helper.ts") || base.endsWith(".helpers.ts")) &&
    base.startsWith(componentStem);

  return isNamedContractFile || isComponentScopedUtility;
}

export function discoverProjectFilesWithStats(cwd = process.cwd()): DiscoveryResult {
  const allFiles: string[] = [];
  const stats: DiscoveryStats = {
    directoriesVisited: 0,
    filesVisited: 0,
    componentFileCount: 0,
    linkedTsCount: 0,
    importProbeCount: 0,
    importResolveCacheHits: 0,
  };
  walk(cwd, allFiles, stats);
  const existingFiles = new Set(allFiles);
  const resolutionCache = new Map<string, string | null>();
  const componentFiles = allFiles.filter((file) => COMPONENT_EXTS.has(path.extname(file)));
  stats.componentFileCount = componentFiles.length;
  const linkedTs = new Set<string>();

  for (const componentFile of componentFiles) {
    for (const imported of relativeImports(componentFile, existingFiles, resolutionCache, stats)) {
      if (path.extname(imported.resolved) === ".ts" && isQualifyingLinkedTs(imported.resolved, componentFile, imported.isTypeOnly)) {
        linkedTs.add(imported.resolved);
      }
    }
  }

  stats.linkedTsCount = linkedTs.size;

  return {
    targets: [
      ...componentFiles.sort().map((filePath) => ({ filePath, kind: "component" as const })),
      ...[...linkedTs].sort().map((filePath) => ({ filePath, kind: "linked-ts" as const })),
    ],
    stats,
  };
}

export function discoverProjectFiles(cwd = process.cwd()): FileTarget[] {
  return discoverProjectFilesWithStats(cwd).targets;
}

// Simple keyword-based relevance discovery for task prompts
export function discoverRelevantFiles(
  prompt: string,
  allFiles: FileTarget[],
): string[] {
  // Extract keywords from prompt (component names, file hints)
  const keywords = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["add", "the", "fix", "update", "to", "for", "with", "from"].includes(w));

  // Score files by keyword matches
  const scored = allFiles.map((target) => {
    const fileName = path.basename(target.filePath).toLowerCase();
    const fileDir = path.dirname(target.filePath).toLowerCase();
    
    let score = 0;
    for (const kw of keywords) {
      if (fileName.includes(kw)) score += 10;
      if (fileDir.includes(kw)) score += 5;
    }
    
    // Prefer component files
    if (target.kind === "component") score += 3;
    
    return { filePath: target.filePath, score };
  });

  // Return top 5 files with score > 0
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => s.filePath);
}
