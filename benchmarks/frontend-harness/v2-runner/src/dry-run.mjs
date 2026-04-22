#!/usr/bin/env node
/**
 * Layer 2 Frontend Task Benchmark - Dry Run Command
 *
 * Executes sample selection without running actual benchmarks.
 * Outputs sample-selection-dry-run.json for verification.
 */

import { writeFileSync } from 'fs';
import { resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { ManifestLoader } from './manifest-loader.mjs';
import { BucketClassifier, DEFAULT_BUCKETS } from './bucket-classifier.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const EDIT_GUIDANCE_EVIDENCE_CLAIM_BOUNDARY =
  'local/dry-run edit targeting evidence only; not provider billing/cost proof and not LSP semantic safety';
const WITH_GUIDANCE_LOCALIZATION_STEPS = Object.freeze([
  'read-model-payload',
  'verify-sourceFingerprint',
  'select-patchTarget',
]);
const WITHOUT_GUIDANCE_LOCALIZATION_STEPS = Object.freeze([
  'read-source-or-search',
  'locate-edit-anchor-manually',
]);

function computeSeed(repoName, bucketId, globalSeed) {
  const hash = createHash('sha256');
  hash.update(`${repoName}:${bucketId}:${globalSeed}`);
  return hash.digest('hex').substring(0, 16);
}

function seededRandom(seed) {
  let value = parseInt(seed.substring(0, 8), 16);
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function diversityRank(files) {
  // Rank by confidence * variety signals
  return files.map(f => {
    const hookSignal = f.signals.find(s => s.name === 'hookCount')?.value || 0;
    const formSignal = f.signals.find(s => s.name === 'formSignals')?.value || 0;
    const condSignal = f.signals.find(s => s.name === 'conditionalComplexity')?.value || 0;
    const styleSignal = f.signals.find(s => s.name === 'styleSignals')?.value || 0;
    
    // Diversity score: combination of different signals
    const diversity = (hookSignal > 0 ? 1 : 0) + 
                     (formSignal > 0 ? 1 : 0) + 
                     (condSignal > 5 ? 1 : 0) + 
                     (styleSignal > 0 ? 1 : 0);
    
    return {
      ...f,
      diversityScore: diversity * f.confidence
    };
  }).sort((a, b) => b.diversityScore - a.diversityScore);
}

function selectSamples(files, targetSize, seed) {
  if (files.length <= targetSize) {
    return files.map((f, idx) => ({ ...f, selectionRank: idx + 1 }));
  }
  
  // Diversity-first ranking
  const ranked = diversityRank(files);
  
  // Deterministic selection using seed for tie-breaking
  const rng = seededRandom(seed);
  const selected = [];
  const remaining = [...ranked];
  
  while (selected.length < targetSize && remaining.length > 0) {
    // Pick top by diversity, use seed for randomness within tiers
    const tierSize = Math.ceil(remaining.length / (targetSize - selected.length));
    const tier = remaining.splice(0, tierSize);
    
    const pickIdx = Math.floor(rng() * tier.length);
    selected.push({
      ...tier[pickIdx],
      selectionRank: selected.length + 1
    });
  }
  
  return selected;
}

function normalizePatchTargetsCount(value) {
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function buildEditGuidanceEvidenceVariant(editGuidanceEnabled, patchTargetsCount) {
  const normalizedPatchTargetsCount = editGuidanceEnabled ? normalizePatchTargetsCount(patchTargetsCount) : 0;

  return {
    editGuidanceEnabled,
    patchTargetsCount: normalizedPatchTargetsCount,
    freshnessChecked: editGuidanceEnabled && normalizedPatchTargetsCount > 0,
    targetLocalizationSteps: editGuidanceEnabled
      ? [...WITH_GUIDANCE_LOCALIZATION_STEPS]
      : [...WITHOUT_GUIDANCE_LOCALIZATION_STEPS],
    claimBoundary: EDIT_GUIDANCE_EVIDENCE_CLAIM_BOUNDARY,
  };
}

export function buildEditGuidanceEvidencePair(options = {}) {
  const targetFile = options.targetFile || 'unresolved-frontend-target.tsx';
  const componentName = options.componentName || 'UnresolvedComponent';
  const patchTargetsCount = normalizePatchTargetsCount(options.patchTargetsCount ?? 1) || 1;

  return {
    schemaVersion: 'fooks-edit-guidance-evidence.v1',
    pairedTarget: {
      filePath: targetFile,
      componentName,
    },
    comparisonInvariant: 'with-guidance and without-guidance variants must use this same target file and component',
    withGuidance: buildEditGuidanceEvidenceVariant(true, patchTargetsCount),
    withoutGuidance: buildEditGuidanceEvidenceVariant(false, 0),
  };
}

export class DryRunCommand {
  constructor(manifestPath, reposBaseDir) {
    this.loader = new ManifestLoader(manifestPath, reposBaseDir);
    this.buckets = DEFAULT_BUCKETS;
  }

  async execute(repoName, options = {}) {
    const manifest = this.loader.load();
    const validation = this.loader.validate();
    
    if (!validation.valid) {
      throw new Error(`Manifest invalid: ${validation.errors.join(', ')}`);
    }

    const repo = this.loader.getRepo(repoName);
    if (!repo) {
      throw new Error(`Repo not found: ${repoName}. Available: ${manifest.repos.map(r => r.name).join(', ')}`);
    }

    // Classify all files
    const classifier = new BucketClassifier(repo, this.buckets, manifest);
    const bucketMap = classifier.classifyAll();
    
    // Select samples per bucket
    const bucketResults = {};
    let totalSelected = 0;
    let totalTarget = 0;
    let criticalDeficits = 0;

    for (const [bucketId, data] of bucketMap) {
      const bucket = this.buckets.find(b => b.id === bucketId);
      const targetSize = repo.bucketLimits?.[bucketId] || bucket?.targetSampleSize || 0;
      
      if (targetSize === 0) continue;
      
      const seed = computeSeed(repoName, bucketId, manifest.seed || 'v2:default');
      const selected = selectSamples(data.files, targetSize, seed);
      
      const deficit = Math.max(0, targetSize - selected.length);
      const deficitRatio = targetSize > 0 ? deficit / targetSize : 0;
      
      if (deficitRatio > 0.5) criticalDeficits++;
      
      totalSelected += selected.length;
      totalTarget += targetSize;
      
      bucketResults[bucketId] = {
        name: bucket?.name || bucketId,
        targetSize,
        selectedCount: selected.length,
        deficit,
        deficitRatio: Math.round(deficitRatio * 100) / 100,
        status: deficitRatio === 0 ? 'complete' : 
                deficitRatio < 0.3 ? 'undersampled' : 
                deficitRatio < 0.5 ? 'high-risk' : 'excluded',
        seed,
        selectedFiles: selected.map(f => ({
          path: relative(repo.localPath, f.filePath),
          sourceRoot: f.sourceRoot,
          bytes: f.rawBytes,
          confidence: Math.round(f.confidence * 100) + '%',
          rank: f.selectionRank,
          signals: f.signals.reduce((acc, s) => {
            acc[s.name] = s.value;
            return acc;
          }, {})
        }))
      };
    }

    const selectedFiles = Object.values(bucketResults).flatMap(bucket => bucket.selectedFiles);
    const editGuidanceTarget = options.editGuidanceTarget || {};
    const editGuidanceEvidence = options.editGuidanceEvidence
      ? buildEditGuidanceEvidencePair({
          targetFile: editGuidanceTarget.filePath || selectedFiles[0]?.path,
          componentName: editGuidanceTarget.componentName,
          patchTargetsCount: options.editGuidancePatchTargetsCount,
        })
      : undefined;

    const report = {
      schemaVersion: 'fooks-benchmark.v2-dry-run',
      timestamp: new Date().toISOString(),
      repo: repoName,
      revision: repo.revision,
      globalSeed: manifest.seed || 'v2:default',
      summary: {
        totalBuckets: Object.keys(bucketResults).length,
        completeBuckets: Object.values(bucketResults).filter(b => b.status === 'complete').length,
        undersampledBuckets: Object.values(bucketResults).filter(b => b.status === 'undersampled').length,
        excludedBuckets: Object.values(bucketResults).filter(b => b.status === 'excluded').length,
        totalSelected,
        totalTarget,
        coverageRatio: totalTarget > 0 ? Math.round((totalSelected / totalTarget) * 100) / 100 : 0
      },
      buckets: bucketResults,
      discovery: classifier.lastDiscovery,
      ...(editGuidanceEvidence ? { editGuidanceEvidence } : {}),
      coverageStatus: criticalDeficits > 0 ? 'insufficient' : 
                      Object.values(bucketResults).some(b => b.status === 'undersampled') ? 'partial' : 'full'
    };

    // Output
    const outputPath = options.output || resolve(__dirname, `../../../reports/dry-run-${repoName}-${Date.now()}.json`);
    writeFileSync(outputPath, JSON.stringify(report, null, 2));
    
    return { report, outputPath, exitCode: criticalDeficits > 0 ? 1 : 0 };
  }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const repoName = process.argv[2];
  const outputFlag = process.argv.indexOf('--output');
  const outputPath = outputFlag > -1 ? process.argv[outputFlag + 1] : null;
  
  if (!repoName) {
    console.error('Usage: node dry-run.mjs <repo-name> [--output path]');
    console.error('Example: node dry-run.mjs formbricks --output ./dry-run-result.json');
    process.exit(1);
  }

  const cmd = new DryRunCommand();
  
  cmd.execute(repoName, { output: outputPath })
    .then(({ report, outputPath, exitCode }) => {
      console.log(`\nDry run complete for ${repoName}`);
      console.log(`Coverage: ${report.summary.totalSelected}/${report.summary.totalTarget} files (${Math.round(report.summary.coverageRatio * 100)}%)`);
      console.log(`Buckets: ${report.summary.completeBuckets} complete, ${report.summary.undersampledBuckets} undersampled, ${report.summary.excludedBuckets} excluded`);
      console.log(`Status: ${report.coverageStatus}`);
      console.log(`\nOutput: ${outputPath}`);
      
      // Summary table
      console.log('\n--- Bucket Summary ---');
      for (const [id, bucket] of Object.entries(report.buckets)) {
        const statusIcon = bucket.status === 'complete' ? '✓' : 
                          bucket.status === 'undersampled' ? '~' : 
                          bucket.status === 'excluded' ? '✗' : '?';
        console.log(`${statusIcon} ${id}: ${bucket.selectedCount}/${bucket.targetSize} ${bucket.status}`);
      }
      
      process.exit(exitCode);
    })
    .catch(err => {
      console.error('Fatal:', err.message);
      process.exit(1);
    });
}
