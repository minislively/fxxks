import path from "node:path";
import { performance } from "node:perf_hooks";
import { discoverProjectFilesWithStats } from "./discover";
import { hashText } from "./hash";
import { isSafeProjectFilePath } from "./paths";
import { readCachedExtraction, readScanIndex, writeCachedExtraction, writeScanIndex } from "./cache";
import type { IndexEntry, ScanObservability, ScanResult } from "./schema";
import fs from "node:fs";

let extractSourceModule: typeof import("./extract") | undefined;

function getExtractSource(): typeof import("./extract")["extractSource"] {
  extractSourceModule ??= require("./extract.js") as typeof import("./extract");
  return extractSourceModule.extractSource;
}

function isMissingPathError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      ((error as NodeJS.ErrnoException).code === "ENOENT" || (error as NodeJS.ErrnoException).code === "ENOTDIR"),
  );
}

export function scanProject(cwd = process.cwd()): ScanResult {
  const startedAt = performance.now();
  const discoveryStartedAt = performance.now();
  const { targets, stats: discoveryStats } = discoverProjectFilesWithStats(cwd);
  const discoveryMs = performance.now() - discoveryStartedAt;
  const existingIndex = readScanIndex(cwd);
  const existingEntries = new Map((existingIndex?.files ?? []).map((entry) => [entry.filePath, entry]));
  const files: IndexEntry[] = [];
  let reusedCacheEntries = 0;
  let refreshedEntries = 0;
  let statMs = 0;
  let fileReadMs = 0;
  let hashMs = 0;
  let cacheReadMs = 0;
  let extractMs = 0;
  let cacheWriteMs = 0;
  let indexWriteMs = 0;
  let fileStatCount = 0;
  let fileReadCount = 0;
  let metadataReuseCount = 0;
  let extractionCacheHits = 0;
  let extractionCacheMisses = 0;
  let reparsedFileCount = 0;
  const slowFiles: ScanObservability["slowFiles"] = [];

  const pushSlowFile = (entry: ScanObservability["slowFiles"][number]): void => {
    slowFiles.push(entry);
    slowFiles.sort((left, right) => right.totalMs - left.totalMs);
    if (slowFiles.length > 5) {
      slowFiles.length = 5;
    }
  };

  for (const target of targets) {
    const startedTargetAt = performance.now();
    const relativePath = path.relative(cwd, target.filePath);
    if (!isSafeProjectFilePath(target.filePath, cwd)) {
      continue;
    }
    const statStartedAt = performance.now();
    let stat: fs.Stats;
    try {
      stat = fs.statSync(target.filePath);
    } catch (error) {
      if (isMissingPathError(error)) {
        continue;
      }
      throw error;
    }
    statMs += performance.now() - statStartedAt;
    fileStatCount += 1;

    const existing = existingEntries.get(relativePath);
    const canReuseMetadata =
      existing &&
      typeof existing.modifiedAtMs === "number" &&
      typeof existing.fileSizeBytes === "number" &&
      existing.modifiedAtMs === stat.mtimeMs &&
      existing.fileSizeBytes === stat.size;

    if (canReuseMetadata) {
      reusedCacheEntries += 1;
      metadataReuseCount += 1;
      files.push(existing);
      pushSlowFile({
        filePath: relativePath,
        kind: target.kind,
        action: "reused",
        totalMs: Number((performance.now() - startedTargetAt).toFixed(2)),
      });
      continue;
    }

    const readStartedAt = performance.now();
    let text: string;
    try {
      text = fs.readFileSync(target.filePath, "utf8");
    } catch (error) {
      if (isMissingPathError(error)) {
        continue;
      }
      throw error;
    }
    fileReadMs += performance.now() - readStartedAt;
    fileReadCount += 1;

    const hashStartedAt = performance.now();
    const hash = hashText(text);
    hashMs += performance.now() - hashStartedAt;

    const cacheReadStartedAt = performance.now();
    const cached = readCachedExtraction(hash, cwd);
    cacheReadMs += performance.now() - cacheReadStartedAt;

    const extracted = cached
      ? cached
      : (() => {
          const extractSource = getExtractSource();
          const extractStartedAt = performance.now();
          const value = extractSource(target.filePath, text);
          extractMs += performance.now() - extractStartedAt;
          reparsedFileCount += 1;
          return value;
        })();

    if (cached) {
      reusedCacheEntries += 1;
      extractionCacheHits += 1;
    } else {
      refreshedEntries += 1;
      extractionCacheMisses += 1;
      const cacheWriteStartedAt = performance.now();
      writeCachedExtraction(extracted, cwd);
      cacheWriteMs += performance.now() - cacheWriteStartedAt;
    }

    files.push({
      filePath: relativePath,
      fileHash: extracted.fileHash,
      fileSizeBytes: stat.size,
      modifiedAtMs: stat.mtimeMs,
      componentName: extracted.componentName,
      exports: extracted.exports,
      propsSummary: extracted.contract?.propsSummary,
      hooks: extracted.behavior?.hooks ?? [],
      styleSystem: extracted.style?.system ?? "unknown",
      mode: extracted.mode,
      complexityScore: extracted.meta.complexityScore,
      decideReason: extracted.meta.decideReason,
      decideConfidence: extracted.meta.decideConfidence,
      kind: target.kind,
    });

    pushSlowFile({
      filePath: relativePath,
      kind: target.kind,
      action: cached ? "reused" : "refreshed",
      totalMs: Number((performance.now() - startedTargetAt).toFixed(2)),
    });
  }

  const indexWriteStartedAt = performance.now();
  const result: ScanResult = {
    projectRoot: cwd,
    scannedAt: new Date().toISOString(),
    files,
    reusedCacheEntries,
    refreshedEntries,
    observability: {
      timingsMs: {
        discovery: Number(discoveryMs.toFixed(2)),
        stat: Number(statMs.toFixed(2)),
        fileRead: Number(fileReadMs.toFixed(2)),
        hash: Number(hashMs.toFixed(2)),
        cacheRead: Number(cacheReadMs.toFixed(2)),
        extract: Number(extractMs.toFixed(2)),
        cacheWrite: Number(cacheWriteMs.toFixed(2)),
        indexWrite: 0,
        total: 0,
      },
      counters: {
        fileStatCount,
        fileReadCount,
        metadataReuseCount,
        extractionCacheHits,
        extractionCacheMisses,
        reparsedFileCount,
      },
      discovery: discoveryStats,
      slowFiles,
    },
  };
  writeScanIndex(result, cwd);
  indexWriteMs += performance.now() - indexWriteStartedAt;
  if (result.observability) {
    result.observability.timingsMs.indexWrite = Number(indexWriteMs.toFixed(2));
    result.observability.timingsMs.total = Number((performance.now() - startedAt).toFixed(2));
  }
  return result;
}
