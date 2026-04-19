import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Cache health monitoring dashboard
 * Provides real-time visibility into cache state and corruption events
 */
export class CacheMonitor {
  private cacheDir: string;
  private metrics: CacheMetrics;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    this.metrics = this.loadMetrics();
  }

  /**
   * Generate cache health report
   */
  healthReport(): CacheHealthReport {
    const indexPath = join(this.cacheDir, "index.json");
    const backupPath = join(this.cacheDir, ".backups", "index.json.bak");
    const indexExists = existsSync(indexPath);

    let indexValid = false;
    let entryCount = 0;
    if (indexExists) {
      const result = this.readIndexHealth(indexPath);
      indexValid = result.valid;
      entryCount = result.entryCount;
    }

    const backupAvailable = existsSync(backupPath) && this.readIndexHealth(backupPath).valid;
    const corruptionEvents = this.metrics.corruptionEvents;

    return {
      status: this.resolveHealthStatus({ indexExists, indexValid, corruptionEvents }),
      indexExists,
      indexValid,
      entryCount,
      corruptionEvents,
      backupAvailable,
      lastCheck: new Date().toISOString(),
    };
  }

  private readIndexHealth(indexPath: string): { valid: boolean; entryCount: number } {
    try {
      const parsed = JSON.parse(readFileSync(indexPath, "utf8")) as unknown;
      return this.indexStats(parsed);
    } catch {
      return { valid: false, entryCount: 0 };
    }
  }

  private indexStats(data: unknown): { valid: boolean; entryCount: number } {
    // Support both "files" array (scan index) and "entries" object (cache index)
    if (
      typeof data === "object" &&
      data !== null &&
      "files" in data &&
      Array.isArray((data as { files: unknown }).files)
    ) {
      return { valid: true, entryCount: (data as { files: unknown[] }).files.length };
    }

    if (
      typeof data === "object" &&
      data !== null &&
      "entries" in data &&
      typeof (data as { entries: unknown }).entries === "object" &&
      (data as { entries: unknown }).entries !== null
    ) {
      return { valid: true, entryCount: Object.keys((data as { entries: Record<string, unknown> }).entries).length };
    }

    return { valid: false, entryCount: 0 };
  }

  /**
   * Record corruption event for metrics
   */
  recordCorruption(): void {
    this.metrics.corruptionEvents++;
    this.metrics.lastCorruption = new Date().toISOString();
    this.saveMetrics();
  }

  /**
   * Get cache efficiency stats
   */
  efficiencyStats(): EfficiencyStats {
    const report = this.healthReport();

    return {
      hitRate: this.calculateHitRate(report),
      entryCount: report.entryCount,
      healthStatus: report.status,
      recommendation: this.generateRecommendation(report),
    };
  }

  private calculateHitRate(report: CacheHealthReport): number | null {
    if (report.status === "empty") {
      return null;
    }
    return report.indexValid ? 1.0 : 0.0;
  }

  private resolveHealthStatus(
    report: Pick<CacheHealthReport, "indexExists" | "indexValid" | "corruptionEvents">,
  ): CacheHealthStatus {
    if (!report.indexExists) {
      return "empty";
    }
    if (!report.indexValid) {
      return "corrupted";
    }
    return report.corruptionEvents > 0 ? "recovered" : "healthy";
  }

  private generateRecommendation(report: CacheHealthReport): string {
    if (report.status === "empty") {
      return "Initialize cache with first scan";
    }
    if (report.status === "corrupted" && report.backupAvailable) {
      return "Cache index is corrupted; valid backup available for recovery";
    }
    if (report.status === "corrupted" && report.corruptionEvents > 3) {
      return "Consider cache reset - multiple corruption events detected";
    }
    if (report.status === "corrupted") {
      return "Cache index is corrupted; rerun scan to regenerate";
    }
    if (report.status === "recovered") {
      return "Cache operating normally after recovery";
    }
    return "Cache operating normally";
  }

  private loadMetrics(): CacheMetrics {
    const metricsPath = join(this.cacheDir, ".metrics.json");
    if (!existsSync(metricsPath)) {
      return { corruptionEvents: 0, lastCorruption: null };
    }

    try {
      const content = readFileSync(metricsPath, "utf8");
      return JSON.parse(content);
    } catch {
      return { corruptionEvents: 0, lastCorruption: null };
    }
  }

  private saveMetrics(): void {
    const metricsPath = join(this.cacheDir, ".metrics.json");
    mkdirSync(this.cacheDir, { recursive: true });
    writeFileSync(metricsPath, JSON.stringify(this.metrics, null, 2));
  }
}

type CacheHealthStatus = "empty" | "healthy" | "recovered" | "corrupted";

interface CacheHealthReport {
  status: CacheHealthStatus;
  indexExists: boolean;
  indexValid: boolean;
  entryCount: number;
  corruptionEvents: number;
  backupAvailable: boolean;
  lastCheck: string;
}

interface EfficiencyStats {
  hitRate: number | null;
  entryCount: number;
  healthStatus: CacheHealthStatus;
  recommendation: string;
}

interface CacheMetrics {
  corruptionEvents: number;
  lastCorruption: string | null;
}
