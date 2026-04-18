/**
 * Layer 2 Frontend Task Benchmark - Deterministic Selector
 *
 * Seed-based deterministic sampling from classified buckets.
 * Based on: TAXONOMY_AND_METRICS_FINAL.md sampling rules.
 */

import { createHash } from 'crypto';

/**
 * Deterministic random generator using seed
 */
export class SeededRandom {
  constructor(seed) {
    this.seed = this.hashSeed(seed);
  }

  hashSeed(seed) {
    const hash = createHash('sha256').update(String(seed)).digest('hex');
    return parseInt(hash.slice(0, 16), 16);
  }

  /**
   * Linear congruential generator
   */
  next() {
    // LCG parameters: a=1664525, c=1013904223, m=2^32
    this.seed = (1664525 * this.seed + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  /**
   * Fisher-Yates shuffle with seed
   */
  shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

/**
 * Sample selection with diversity ranking
 */
export class DeterministicSelector {
  constructor(seed, repoName, bucketId) {
    // Seed format: repoRevision:bucketName:fooks-v2
    this.seed = `${seed}:${repoName}:${bucketId}`;
    this.rng = new SeededRandom(this.seed);
  }

  /**
   * Calculate diversity score for file classification
   * Higher score = more diverse/representative
   */
  calculateDiversityScore(file) {
    const signals = file.signals || [];
    let score = 0;

    // Size diversity (prefer mid-range files)
    const bytes = file.rawBytes || 0;
    if (bytes >= 500 && bytes <= 3000) {
      score += 10;
    } else if (bytes < 500) {
      score += 5;
    } else {
      score += 3;
    }

    // Confidence diversity (high confidence preferred)
    const confidence = file.confidence || 0;
    score += confidence * 20;

    // Signal diversity bonus
    const hookCount = signals.find(s => s.name === 'hookCount')?.value || 0;
    const formSignals = signals.find(s => s.name === 'formSignals')?.value || 0;
    const conditionalCount = signals.find(s => s.name === 'conditionalComplexity')?.value || 0;

    if (hookCount > 0) score += 5;
    if (formSignals > 0) score += 5;
    if (conditionalCount > 5) score += 3;

    return score;
  }

  /**
   * Select samples from classified files
   * @param {Array} files - Array of FileClassification
   * @param {number} targetSize - Number of samples to select
   * @returns {Array} Selected file paths
   */
  select(files, targetSize) {
    if (!files || files.length === 0) {
      return [];
    }

    if (files.length <= targetSize) {
      // Return all if insufficient files
      return files.map(f => f.filePath);
    }

    // Calculate diversity scores
    const scored = files.map(file => ({
      file,
      diversityScore: this.calculateDiversityScore(file)
    }));

    // Rank by diversity score (descending)
    scored.sort((a, b) => b.diversityScore - a.diversityScore);

    // Take top candidates (3x target for reservoir sampling pool)
    const poolSize = Math.min(scored.length, targetSize * 3);
    const pool = scored.slice(0, poolSize).map(s => s.file);

    // Deterministic shuffle of pool
    const shuffled = this.rng.shuffle(pool);

    // Select targetSize samples
    return shuffled.slice(0, targetSize).map(f => f.filePath);
  }

  /**
   * Select with metadata for reporting
   */
  selectWithMetadata(files, targetSize) {
    const selected = this.select(files, targetSize);
    
    return {
      seed: this.seed,
      availableFiles: files.length,
      targetSize,
      selectedCount: selected.length,
      deficit: Math.max(0, targetSize - selected.length),
      selectedFiles: selected.map(path => {
        const file = files.find(f => f.filePath === path);
        return {
          path,
          bucketId: file?.bucketId,
          confidence: file?.confidence,
          rawBytes: file?.rawBytes
        };
      })
    };
  }
}

/**
 * Select samples from all buckets
 */
export function selectAllBuckets(bucketMap, manifestSeed, repoName) {
  const selections = new Map();

  for (const [bucketId, bucketData] of bucketMap) {
    const selector = new DeterministicSelector(manifestSeed, repoName, bucketId);
    const targetSize = bucketData.targetSize;
    const files = bucketData.files;

    selections.set(bucketId, selector.selectWithMetadata(files, targetSize));
  }

  return selections;
}

/**
 * Export selection report
 */
export function exportSelectionReport(selections) {
  const report = {
    timestamp: new Date().toISOString(),
    totalBuckets: selections.size,
    buckets: {}
  };

  let totalSelected = 0;
  let totalTarget = 0;

  for (const [bucketId, selection] of selections) {
    report.buckets[bucketId] = {
      seed: selection.seed,
      availableFiles: selection.availableFiles,
      targetSize: selection.targetSize,
      selectedCount: selection.selectedCount,
      deficit: selection.deficit,
      status: selection.deficit === 0 ? 'complete' : 
              selection.deficit / selection.targetSize < 0.3 ? 'undersampled' : 'excluded',
      selectedFiles: selection.selectedFiles
    };

    totalSelected += selection.selectedCount;
    totalTarget += selection.targetSize;
  }

  report.summary = {
    totalSelected,
    totalTarget,
    overallDeficit: Math.max(0, totalTarget - totalSelected),
    coverageRatio: totalTarget > 0 ? (totalSelected / totalTarget) : 0
  };

  return report;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('DeterministicSelector module loaded');
  console.log('Usage: import { DeterministicSelector, selectAllBuckets } from "./deterministic-selector.mjs"');
}
