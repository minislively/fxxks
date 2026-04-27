import fs from "node:fs";
import path from "node:path";
import { cacheFilePath, ensureProjectDataDirs, indexPath } from "./paths";
import type { ExtractionResult, ScanResult } from "./schema";

export function readCachedExtraction(hash: string, cwd = process.cwd()): ExtractionResult | null {
  const file = cacheFilePath(hash, cwd);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as ExtractionResult;
  } catch {
    return null;
  }
}

export function writeCachedExtraction(result: ExtractionResult, cwd = process.cwd()): void {
  ensureProjectDataDirs(cwd);
  const file = cacheFilePath(result.fileHash, cwd);
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
}

export function writeScanIndex(result: ScanResult, cwd = process.cwd()): void {
  ensureProjectDataDirs(cwd);
  const persistedResult: ScanResult = {
    ...result,
    observability: undefined,
  };
  fs.writeFileSync(indexPath(cwd), JSON.stringify(persistedResult, null, 2));
}

export function readScanIndex(cwd = process.cwd()): ScanResult | null {
  const file = indexPath(cwd);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as ScanResult;
  } catch {
    return null;
  }
}

export function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}
