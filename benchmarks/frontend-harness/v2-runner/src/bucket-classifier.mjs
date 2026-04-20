/**
 * Layer 2 Frontend Task Benchmark - Bucket Classifier
 * Classifies frontend files into taxonomy buckets.
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, relative } from 'path';
import { ManifestLoader } from './manifest-loader.mjs';

// Taxonomy buckets from TAXONOMY_AND_METRICS_FINAL.md
export const DEFAULT_BUCKETS = [
  { id: 'tiny-raw', name: 'Tiny Raw', targetSampleSize: 20, deficitThresholdPct: 30 },
  { id: 'simple-presentational', name: 'Simple Presentational', targetSampleSize: 30, deficitThresholdPct: 30 },
  { id: 'form-heavy', name: 'Form Heavy', targetSampleSize: 25, deficitThresholdPct: 30 },
  { id: 'hook-heavy', name: 'Hook Heavy', targetSampleSize: 25, deficitThresholdPct: 30 },
  { id: 'conditional-heavy', name: 'Conditional Heavy', targetSampleSize: 20, deficitThresholdPct: 30 },
  { id: 'style-heavy', name: 'Style Heavy', targetSampleSize: 20, deficitThresholdPct: 30 },
  { id: 'large-mixed', name: 'Large Mixed', targetSampleSize: 15, deficitThresholdPct: 30 },
  { id: 'real-edit-task', name: 'Real Edit Task', targetSampleSize: 30, deficitThresholdPct: 30 }
];

// Glob pattern matching with brace expansion support
function matchesGlob(filePath, pattern) {
  // If pattern doesn't contain /, match against basename only
  if (!pattern.includes('/')) {
    const basename = filePath.split('/').pop();
    return matchesGlobPattern(basename, pattern);
  }
  // Otherwise match against full path
  return matchesGlobPattern(filePath, pattern);
}

function matchesGlobPattern(str, pattern) {
  // Handle brace expansion: {ts,tsx} -> (ts|tsx)
  let regexPattern = pattern;

  // Handle brace expansion first
  regexPattern = regexPattern.replace(/\{([^}]+)\}/g, (match, content) => {
    const options = content.split(',').map(s => s.trim());
    return `(${options.join('|')})`;
  });

  // Escape remaining dots
  regexPattern = regexPattern.replace(/\./g, '\\.');

  // Convert glob wildcards to regex
  // ** matches any number of directory levels (including /)
  regexPattern = regexPattern.replace(/\*\*/g, '<<<DOUBLESTAR>>>');
  // * matches any chars except /
  regexPattern = regexPattern.replace(/\*/g, '[^/]*');
  // Restore ** as .*
  regexPattern = regexPattern.replace(/<<<DOUBLESTAR>>>/g, '.*');

  // Anchor to match full string
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(str);
}

// Find which source root a path belongs to
function sourceRootFor(filePath, roots) {
  for (const root of roots) {
    // Convert root pattern to regex prefix match
    let regexPattern = root;
    regexPattern = regexPattern.replace(/\*\*/g, '.*');
    regexPattern = regexPattern.replace(/\*/g, '[^/]+');
    const regex = new RegExp(`^${regexPattern}`);
    if (regex.test(filePath)) return root;
  }
  return null;
}

// Check if path matches a directory prefix pattern
function matchesPathPattern(filePath, pattern) {
  return filePath.startsWith(pattern);
}

// Normalize path separators
function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/\/+/g, '/');
}

// Check if file has React evidence (JSX or React imports)
function hasReactEvidence(content) {
  // Check for JSX patterns
  if (/<[A-Z][a-zA-Z]*/.test(content)) return true;
  if (/<[a-z]+[^>]*>/.test(content) && content.includes('return')) return true;
  // Check for React imports
  if (/import\s+.*React/.test(content)) return true;
  if (/from\s+['"]react['"]/.test(content)) return true;
  if (/ReactNode|React\.FC|React\.Component/.test(content)) return true;
  return false;
}

// Walk directory and collect all files
function walkDir(dir, baseDir = dir) {
  const files = [];

  function walk(currentDir) {
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = resolve(currentDir, entry.name);
      const relPath = relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        // Skip base excludes
        if (['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(entry.name)) {
          continue;
        }
        walk(fullPath);
      } else if (entry.isFile() && /\.(tsx|ts|jsx|js)$/.test(entry.name)) {
        files.push(relPath.replace(/\\/g, '/'));
      }
    }
  }

  walk(dir);
  return files;
}

export class BucketClassifier {
  constructor(repo, buckets = DEFAULT_BUCKETS, manifest = null) {
    this.repo = repo;
    this.buckets = buckets;
    this.manifest = manifest;
    this.lastDiscovery = null;
  }

  discoverFiles() {
    const repoPath = resolve(this.repo.localPath);
    const discoveryGlobs = this.manifest?.discoveryGlobs || ['**/*.tsx', '**/*.ts'];
    const globalExcludeGlobs = this.manifest?.excludeGlobs || [];
    const repoExcludePatterns = this.repo?.excludedPaths || [];
    const sourceRoots = this.repo?.sourceRoots || [];
    const includeNonReact = this.manifest?.countRule?.includeNonReact ?? false;

    // Get all candidate files
    const allFiles = walkDir(repoPath);
    const candidates = [];
    const excluded = {
      discoveryGlobMismatch: [],
      outsideSourceRoots: [],
      repoExcludedPath: [],
      globalExclude: [],
      nonReactSource: []
    };

    for (const filePath of allFiles) {
      let included = true;
      let reason = null;

      // Check 1: Must match discovery globs
      const matchesDiscovery = discoveryGlobs.some(glob => matchesGlob(filePath, glob));
      if (!matchesDiscovery) {
        included = false;
        reason = 'discoveryGlobMismatch';
      }

      // Check 2: Must be within source roots (if defined)
      if (included && sourceRoots.length > 0) {
        const inSourceRoot = sourceRoots.some(root => sourceRootFor(filePath, [root]));
        if (!inSourceRoot) {
          included = false;
          reason = 'outsideSourceRoots';
        }
      }

      // Check 3: Must not match repo excluded paths
      if (included && repoExcludePatterns.length > 0) {
        const matchesRepoExclude = repoExcludePatterns.some(pattern => {
          // If pattern ends with /, treat as directory prefix
          if (pattern.endsWith('/')) {
            return filePath.startsWith(pattern);
          }
          // Otherwise treat as glob
          return matchesGlob(filePath, pattern);
        });
        if (matchesRepoExclude) {
          included = false;
          reason = 'repoExcludedPath';
        }
      }

      // Check 4: Must not match global excludes
      if (included && globalExcludeGlobs.length > 0) {
        const matchesGlobalExclude = globalExcludeGlobs.some(glob => matchesGlob(filePath, glob));
        if (matchesGlobalExclude) {
          included = false;
          reason = 'globalExclude';
        }
      }

      // Check 5: Must have React evidence (unless includeNonReact is true)
      if (included && !includeNonReact) {
        const fullPath = resolve(repoPath, filePath);
        try {
          const content = readFileSync(fullPath, 'utf-8');
          if (!hasReactEvidence(content)) {
            included = false;
            reason = 'nonReactSource';
          }
        } catch {
          included = false;
          reason = 'nonReactSource';
        }
      }

      if (included) {
        candidates.push(filePath);
      } else if (reason) {
        excluded[reason].push({ path: filePath, reason });
      }
    }

    // Store discovery metadata
    // candidateCount = files matching discoveryGlobs (not allFiles)
    const discoveryMatches = allFiles.filter(f => discoveryGlobs.some(g => matchesGlob(f, g)));
    this.lastDiscovery = {
      candidateCount: discoveryMatches.length,
      includedCount: candidates.length,
      excludedCounts: {
        discoveryGlobMismatch: excluded.discoveryGlobMismatch.length,
        outsideSourceRoots: excluded.outsideSourceRoots.length,
        repoExcludedPath: excluded.repoExcludedPath.length,
        globalExclude: excluded.globalExclude.length,
        nonReactSource: excluded.nonReactSource.length
      },
      examples: excluded
    };

    // Return full paths
    return candidates.map(f => resolve(repoPath, f));
  }

  classifyFile(filePath) {
    const content = readFileSync(filePath, 'utf-8');
    const rawBytes = Buffer.byteLength(content, 'utf-8');
    const signals = [];

    signals.push({ name: 'rawBytes', value: rawBytes, weight: rawBytes < 500 ? 0.4 : 0.2 });

    const hookCount = (content.match(/use[A-Z][a-zA-Z]+/g) || []).length;
    signals.push({ name: 'hookCount', value: hookCount, weight: hookCount > 0 ? 0.5 : 0.1 });

    const formSignals = ['<input', '<select', '<textarea', 'useForm', 'onSubmit', 'register(']
      .filter(p => content.includes(p)).length;
    signals.push({ name: 'formSignals', value: formSignals, weight: formSignals > 0 ? 0.4 : 0.05 });

    const conditionalCount = (content.match(/if\s*\(|\?\s*:|&&|\|\|/g) || []).length;
    signals.push({ name: 'conditionalComplexity', value: conditionalCount,
      weight: conditionalCount > 5 ? 0.3 : 0.05 });

    const styleSignals = ['className=', 'styled', 'css`', 'tw`', 'tailwind']
      .filter(p => content.includes(p)).length;
    signals.push({ name: 'styleSignals', value: styleSignals, weight: styleSignals > 0 ? 0.25 : 0.05 });

    const bucketId = this.determineBucket(signals, rawBytes, content);
    const confidence = this.calculateConfidence(signals);

    // Determine source root for this file
    const relPath = relative(this.repo.localPath, filePath).replace(/\\/g, '/');
    const sourceRoots = this.repo?.sourceRoots || [];
    const sourceRoot = sourceRootFor(relPath, sourceRoots);

    return { filePath, bucketId, confidence, signals, rawBytes, mode: 'raw', sourceRoot };
  }

  determineBucket(signals, rawBytes, content) {
    const hookCount = signals.find(s => s.name === 'hookCount')?.value || 0;
    const formSignals = signals.find(s => s.name === 'formSignals')?.value || 0;
    const conditionalCount = signals.find(s => s.name === 'conditionalComplexity')?.value || 0;
    const styleSignals = signals.find(s => s.name === 'styleSignals')?.value || 0;

    if (rawBytes < 500 && hookCount === 0) return 'tiny-raw';
    if (hookCount >= 3) return 'hook-heavy';
    if (formSignals >= 2) return 'form-heavy';
    if (conditionalCount >= 8) return 'conditional-heavy';
    if (styleSignals >= 2 && hookCount === 0) return 'style-heavy';
    if (rawBytes > 1500 && (hookCount > 0 || formSignals > 0)) return 'large-mixed';

    return 'simple-presentational';
  }

  calculateConfidence(signals) {
    const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
    if (totalWeight === 0) return 0.5;
    const dominant = signals.reduce((max, s) => s.weight > max.weight ? s : max, signals[0]);
    return Math.min(0.95, (dominant.weight / totalWeight) + 0.2);
  }

  classifyAll() {
    const files = this.discoverFiles();
    console.log(`Discovered ${files.length} files in ${this.repo.name}`);

    const classified = files.map(f => this.classifyFile(f));
    const bucketMap = new Map();

    for (const bucket of this.buckets) {
      const targetSize = bucket.targetSampleSize;
      const bucketFiles = classified.filter(f => f.bucketId === bucket.id);
      const deficit = Math.max(0, targetSize - bucketFiles.length);

      bucketMap.set(bucket.id, {
        bucketId: bucket.id,
        files: bucketFiles,
        deficit,
        deficitRatio: targetSize > 0 ? deficit / targetSize : 0,
        targetSize
      });
    }

    return bucketMap;
  }

  exportReport(bucketMap) {
    const report = {
      repo: this.repo.name,
      timestamp: new Date().toISOString(),
      totalFiles: 0,
      buckets: {}
    };

    for (const [bucketId, data] of bucketMap) {
      const bucket = this.buckets.find(b => b.id === bucketId);
      report.totalFiles += data.files.length;
      report.buckets[bucketId] = {
        name: bucket?.name || bucketId,
        totalFiles: data.files.length,
        targetSize: data.targetSize,
        deficit: data.deficit,
        deficitRatio: Math.round(data.deficitRatio * 100) + '%',
        status: data.deficitRatio === 0 ? 'complete' :
                data.deficitRatio < 0.3 ? 'undersampled' : 'excluded',
        topFiles: data.files
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 3)
          .map(f => ({
            path: relative(this.repo.localPath, f.filePath),
            confidence: Math.round(f.confidence * 100) + '%',
            bytes: f.rawBytes
          }))
      };
    }

    return report;
  }
}

// Test exports
export const _test = {
  matchesGlob,
  sourceRootFor,
  matchesPathPattern,
  normalizePath
};

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const repoName = process.argv[2] || 'formbricks';
  const loader = new ManifestLoader();

  try {
    const manifest = loader.load();
    const validation = loader.validate();
    if (!validation.valid) {
      console.error('Manifest invalid:', validation.errors);
      process.exit(1);
    }

    const repo = loader.getRepo(repoName);
    if (!repo) {
      console.error(`Repo not found: ${repoName}`);
      console.log('Available:', loader.load().repos.map(r => r.name).join(', '));
      process.exit(1);
    }

    const classifier = new BucketClassifier(repo, DEFAULT_BUCKETS, manifest);
    console.log(`\nClassifying ${repoName}...`);
    const bucketMap = classifier.classifyAll();
    const report = classifier.exportReport(bucketMap);

    console.log('\n--- Report ---');
    console.log(JSON.stringify(report, null, 2));

  } catch (err) {
    console.error('Fatal:', err.message);
    process.exit(1);
  }
}
