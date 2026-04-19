/**
 * Layer 2 Frontend Task Benchmark - Bucket Classifier
 * Classifies frontend files into taxonomy buckets.
 */

import { readFileSync, readdirSync } from 'fs';
import { extname, resolve, relative } from 'path';
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

const DEFAULT_PRUNED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage']);
const MAX_EXAMPLES_PER_REASON = 5;

function normalizePath(path) {
  return String(path)
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

function stripTrailingSlash(path) {
  return normalizePath(path).replace(/\/+$/, '');
}

function pathBasename(path) {
  return normalizePath(path).split('/').pop() || '';
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function expandBracePattern(pattern) {
  const match = pattern.match(/\{([^{}]+)\}/);
  if (!match) return [pattern];

  const [token, body] = match;
  return body.split(',').flatMap(part => expandBracePattern(pattern.replace(token, part)));
}

function globToRegExp(pattern) {
  const normalized = normalizePath(pattern);
  let source = '^';

  for (let idx = 0; idx < normalized.length; idx++) {
    const char = normalized[idx];
    const next = normalized[idx + 1];

    if (char === '*') {
      if (next === '*') {
        const afterGlobstar = normalized[idx + 2];
        if (afterGlobstar === '/') {
          source += '(?:.*/)?';
          idx += 2;
        } else {
          source += '.*';
          idx += 1;
        }
      } else {
        source += '[^/]*';
      }
      continue;
    }

    if (char === '?') {
      source += '[^/]';
      continue;
    }

    source += escapeRegExp(char);
  }

  source += '$';
  return new RegExp(source);
}

function matchesGlob(path, pattern) {
  const normalizedPath = normalizePath(path);
  const normalizedPattern = normalizePath(pattern);

  if (!normalizedPattern) return false;

  const basenameOnly = !normalizedPattern.includes('/');
  const pathToMatch = basenameOnly ? pathBasename(normalizedPath) : normalizedPath;

  return expandBracePattern(normalizedPattern).some(expanded => globToRegExp(expanded).test(pathToMatch));
}

function matchesDirectoryPattern(path, pattern) {
  const normalizedPath = normalizePath(path);
  const normalizedPattern = normalizePath(pattern);
  const barePattern = stripTrailingSlash(normalizedPattern);

  if (!barePattern) return false;

  if (!/[?*{}]/.test(barePattern)) {
    return normalizedPath === barePattern || normalizedPath.startsWith(`${barePattern}/`);
  }

  return expandBracePattern(`${barePattern}/**`).some(expanded => globToRegExp(expanded).test(normalizedPath));
}

function matchesPathPattern(path, pattern) {
  const normalizedPattern = normalizePath(pattern);
  if (!normalizedPattern) return false;

  if (normalizedPattern.endsWith('/')) {
    return matchesDirectoryPattern(path, normalizedPattern);
  }

  if (!normalizedPattern.includes('/') && /[*?{}]/.test(normalizedPattern)) {
    return matchesGlob(path, normalizedPattern);
  }

  if (!/[?*{}]/.test(normalizedPattern)) {
    const normalizedPath = normalizePath(path);
    return normalizedPath === normalizedPattern || normalizedPath.startsWith(`${normalizedPattern}/`);
  }

  return matchesGlob(path, normalizedPattern) || matchesDirectoryPattern(path, normalizedPattern);
}

function firstMatchingPattern(path, patterns = [], matcher = matchesPathPattern) {
  return patterns.find(pattern => matcher(path, pattern));
}

function matchesAnyGlob(path, patterns = []) {
  return Boolean(firstMatchingPattern(path, patterns, matchesGlob));
}

function sourceRootFor(path, sourceRoots = []) {
  return firstMatchingPattern(path, sourceRoots, matchesDirectoryPattern) || null;
}

function createDiscoveryStats(repo, manifest) {
  return {
    repo: repo.name,
    sourceRoots: repo.sourceRoots || [],
    discoveryGlobs: manifest?.discoveryGlobs || [],
    traversedFileCount: 0,
    candidateCount: 0,
    includedCount: 0,
    prunedDirectoryCount: 0,
    excludedCounts: {},
    examples: {
      included: []
    },
    diagnostics: []
  };
}

function pushBoundedExample(examples, key, example) {
  if (!examples[key]) examples[key] = [];
  if (examples[key].length < MAX_EXAMPLES_PER_REASON) examples[key].push(example);
}

function recordExclusion(stats, reason, relativePath, details = {}) {
  stats.excludedCounts[reason] = (stats.excludedCounts[reason] || 0) + 1;
  pushBoundedExample(stats.examples, reason, { path: relativePath, ...details });
}

function stripStringLiterals(content) {
  return content.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, '');
}

function hasReactEvidence(content) {
  const sourceWithoutComments = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  const hasReactImport = [
    /import\s+(?:type\s+)?[^;]+from\s+['"]react['"]/,
    /import\s+React\b/,
    /import\s+['"]react['"]/
  ].some(pattern => pattern.test(sourceWithoutComments));
  if (hasReactImport) return true;

  const sourceWithoutCommentsOrStrings = stripStringLiterals(sourceWithoutComments);
  return [
    /React\./,
    /\bJSX\.Element\b/
  ].some(pattern => pattern.test(sourceWithoutCommentsOrStrings));
}

function isSourceSuitable(filePath, content, manifest) {
  if (manifest?.countRule?.includeNonReact !== false) return true;

  const extension = extname(filePath);
  if (extension === '.tsx') return true;
  if (extension === '.ts') return hasReactEvidence(content);
  return false;
}

function walkDir(dir, onFile, stats) {
  function walk(currentDir) {
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = resolve(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (DEFAULT_PRUNED_DIRS.has(entry.name)) {
          stats.prunedDirectoryCount += 1;
          continue;
        }
        walk(fullPath);
      } else if (entry.isFile()) {
        stats.traversedFileCount += 1;
        onFile(fullPath);
      }
    }
  }

  walk(dir);
}

export class BucketClassifier {
  constructor(repo, buckets = DEFAULT_BUCKETS, manifest = null) {
    this.repo = repo;
    this.buckets = buckets;
    this.manifest = manifest;
    this.lastDiscovery = null;
    this.discoveryByPath = new Map();
  }

  discoverFiles() {
    const repoPath = resolve(this.repo.localPath);
    const discoveryGlobs = this.manifest?.discoveryGlobs || ['**/*.tsx', '**/*.ts'];
    const globalExcludes = this.manifest?.excludeGlobs || [];
    const repoExcludes = this.repo.excludedPaths || [];
    const sourceRoots = this.repo.sourceRoots || [];
    const stats = createDiscoveryStats(this.repo, this.manifest);
    const files = [];
    this.discoveryByPath = new Map();

    walkDir(repoPath, fullPath => {
      const relativePath = normalizePath(relative(repoPath, fullPath));

      if (!matchesAnyGlob(relativePath, discoveryGlobs)) {
        recordExclusion(stats, 'discoveryGlobMismatch', relativePath);
        return;
      }

      stats.candidateCount += 1;

      const sourceRoot = sourceRootFor(relativePath, sourceRoots);
      if (sourceRoots.length > 0 && !sourceRoot) {
        recordExclusion(stats, 'outsideSourceRoots', relativePath);
        return;
      }

      const repoExclude = firstMatchingPattern(relativePath, repoExcludes, matchesPathPattern);
      if (repoExclude) {
        recordExclusion(stats, 'repoExcludedPath', relativePath, { pattern: repoExclude });
        return;
      }

      const globalExclude = firstMatchingPattern(relativePath, globalExcludes, matchesPathPattern);
      if (globalExclude) {
        recordExclusion(stats, 'globalExclude', relativePath, { pattern: globalExclude });
        return;
      }

      let content;
      try {
        content = readFileSync(fullPath, 'utf-8');
      } catch (err) {
        recordExclusion(stats, 'readError', relativePath, { message: err.message });
        return;
      }

      if (!isSourceSuitable(relativePath, content, this.manifest)) {
        recordExclusion(stats, 'nonReactSource', relativePath);
        return;
      }

      const metadata = { relativePath, sourceRoot, inclusionReason: 'included' };
      this.discoveryByPath.set(fullPath, metadata);
      files.push(fullPath);
      stats.includedCount += 1;
      pushBoundedExample(stats.examples, 'included', metadata);
    }, stats);

    this.lastDiscovery = stats;
    return [...new Set(files)];
  }

  classifyFile(filePath) {
    const content = readFileSync(filePath, 'utf-8');
    const rawBytes = Buffer.byteLength(content, 'utf-8');
    const signals = [];
    const discoveryMetadata = this.discoveryByPath.get(filePath) || {
      relativePath: normalizePath(relative(this.repo.localPath, filePath)),
      sourceRoot: sourceRootFor(relative(this.repo.localPath, filePath), this.repo.sourceRoots || [])
    };

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

    return {
      filePath,
      bucketId,
      confidence,
      signals,
      rawBytes,
      mode: 'raw',
      relativePath: discoveryMetadata.relativePath,
      sourceRoot: discoveryMetadata.sourceRoot
    };
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
    console.log(`Discovered ${files.length} eligible files in ${this.repo.name}`);

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
      discovery: this.lastDiscovery,
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
            sourceRoot: f.sourceRoot,
            confidence: Math.round(f.confidence * 100) + '%',
            bytes: f.rawBytes
          }))
      };
    }

    return report;
  }
}

export const _test = {
  normalizePath,
  expandBracePattern,
  matchesGlob,
  matchesPathPattern,
  matchesDirectoryPattern,
  sourceRootFor,
  hasReactEvidence,
  isSourceSuitable
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
