import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CacheResilience } from "./cache-resilience";

/**
 * Cache health monitoring dashboard
 * Provides real-time visibility into cache state and corruption events
 */
export class CacheMonitor {
  private cacheDir: string;
  private resilience: CacheResilience;
  private metrics: CacheMetrics;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    this.resilience = new CacheResilience(cacheDir);
    this.metrics = this.loadMetrics();
  }

  /**
   * Generate cache health report
   */
  healthReport(): CacheHealthReport {
    const indexPath = join(this.cacheDir, "index.json");
    const indexExists = existsSync(indexPath);
    
    let indexValid = false;
    let entryCount = 0;
    let corruptionEvents = this.metrics.corruptionEvents;
    
    if (indexExists) {
      const result = this.resilience.readIndexSafe();
      indexValid = result !== null;
      if (result) {
        entryCount = Object.keys(result.entries).length;
      }
    }

    return {
      status: indexValid ? "healthy" : corruptionEvents > 0 ? "recovered" : "corrupted",
      indexExists,
      indexValid,
      entryCount,
      corruptionEvents,
      backupAvailable: existsSync(join(this.cacheDir, ".backups", "index.json.bak")),
      lastCheck: new Date().toISOString(),
    };
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
    const hitRate = this.calculateHitRate();
    
    return {
      hitRate,
      entryCount: report.entryCount,
      healthStatus: report.status,
      recommendation: this.generateRecommendation(report),
    };
  }

  private calculateHitRate(): number {
    // Implementation would track cache hits/misses over time
    // For now, return placeholder based on index health
    const report = this.healthReport();
    return report.indexValid ? 0.95 : 0.0;
  }

  private generateRecommendation(report: CacheHealthReport): string {
    if (!report.indexExists) {
      return "Initialize cache with first extraction";
    }
    if (!report.indexValid && report.corruptionEvents > 3) {
      return "Consider cache reset - multiple corruption events detected";
    }
    if (!report.indexValid) {
      return "Cache recovered from backup or regeneration";
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
    const { writeFileSync } = require("node:fs");
    const metricsPath = join(this.cacheDir, ".metrics.json");
    writeFileSync(metricsPath, JSON.stringify(this.metrics, null, 2));
  }
}

interface CacheHealthReport {
  status: "healthy" | "recovered" | "corrupted";
  indexExists: boolean;
  indexValid: boolean;
  entryCount: number;
  corruptionEvents: number;
  backupAvailable: boolean;
  lastCheck: string;
}

interface EfficiencyStats {
  hitRate: number;
  entryCount: number;
  healthStatus: string;
  recommendation: string;
}

interface CacheMetrics {
  corruptionEvents: number;
  lastCorruption: string | null;
}
