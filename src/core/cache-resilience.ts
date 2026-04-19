import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

/**
 * Cache resilience layer - prevents unrecoverable crashes from corrupted cache
 * P0 fix: corrupted .fooks/index.json causes manual deletion
 */
export class CacheResilience {
  private cacheDir: string;
  private backupDir: string;
  private maxRetries: number;

  constructor(cacheDir: string, maxRetries = 3) {
    this.cacheDir = cacheDir;
    this.backupDir = join(cacheDir, ".backups");
    this.maxRetries = maxRetries;
  }

  /**
   * Safely read cache index with fallback to backup or regeneration
   */
  readIndexSafe(): CacheIndex | null {
    const indexPath = join(this.cacheDir, "index.json");
    
    // Try primary index
    const result = this.tryReadIndex(indexPath);
    if (result.valid) return result.data;
    
    // Try backup
    const backupResult = this.tryReadBackup();
    if (backupResult.valid && backupResult.data) {
      this.restoreFromBackup(backupResult.data);
      return backupResult.data;
    }
    
    // Final fallback: return empty index (regeneration will happen)
    console.warn("[cache] Corrupted cache detected, regenerating...");
    return null;
  }

  private tryReadIndex(path: string): ReadResult {
    if (!existsSync(path)) return { valid: false, data: null };
    
    try {
      const content = readFileSync(path, "utf8");
      const parsed = JSON.parse(content);
      
      // Validate structure
      if (this.isValidIndex(parsed)) {
        return { valid: true, data: parsed };
      }
      return { valid: false, data: null };
    } catch (e) {
      return { valid: false, data: null, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  private tryReadBackup(): ReadResult {
    // Find most recent valid backup
    const backupPath = join(this.backupDir, "index.json.bak");
    const result = this.tryReadIndex(backupPath);
    if (!result.valid || !result.data) {
      return { valid: false, data: null };
    }
    return result;
  }

  private isValidIndex(data: unknown): boolean {
    return (
      typeof data === "object" &&
      data !== null &&
      "version" in data &&
      typeof (data as CacheIndex).version === "string" &&
      "entries" in data &&
      typeof (data as CacheIndex).entries === "object"
    );
  }

  private restoreFromBackup(data: CacheIndex): void {
    const indexPath = join(this.cacheDir, "index.json");
    writeFileSync(indexPath, JSON.stringify(data, null, 2));
    console.log("[cache] Restored from backup");
  }

  /**
   * Write cache index with atomic write + backup
   */
  writeIndexSafe(index: CacheIndex): void {
    const indexPath = join(this.cacheDir, "index.json");
    const tempPath = `${indexPath}.tmp`;
    
    // Atomic write: temp → rename
    writeFileSync(tempPath, JSON.stringify(index, null, 2));
    
    // Backup current before replace
    if (existsSync(indexPath)) {
      this.createBackup();
    }
    
    // Atomic rename
    const { renameSync } = require("node:fs");
    renameSync(tempPath, indexPath);
  }

  private createBackup(): void {
    try {
      const indexPath = join(this.cacheDir, "index.json");
      const backupPath = join(this.backupDir, "index.json.bak");
      
      const content = readFileSync(indexPath, "utf8");
      mkdirSync(this.backupDir, { recursive: true });
      writeFileSync(backupPath, content);
    } catch (e) {
      // Silent fail on backup - primary write is more important
    }
  }
}

interface CacheIndex {
  version: string;
  entries: Record<string, CacheEntry>;
}

interface CacheEntry {
  hash: string;
  timestamp: number;
  path: string;
}

interface ReadResult {
  valid: boolean;
  data: CacheIndex | null;
  error?: Error;
}
