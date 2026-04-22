import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { BucketClassifier, DEFAULT_BUCKETS, _test } from '../benchmarks/frontend-harness/v2-runner/src/bucket-classifier.mjs';
import {
  EDIT_GUIDANCE_EVIDENCE_CLAIM_BOUNDARY,
  DryRunCommand,
  buildEditGuidanceEvidencePair,
} from '../benchmarks/frontend-harness/v2-runner/src/dry-run.mjs';

function writeFile(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf-8');
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'fooks-v2-runner-'));
  const reposBaseDir = join(root, 'repos');
  const repoPath = join(reposBaseDir, 'fixture');
  mkdirSync(repoPath, { recursive: true });

  const reactComponent = `
    import React from 'react';
    export function Button() { return <button className="px-2">Save</button>; }
  `;

  writeFile(join(repoPath, 'apps/web/components/Button.tsx'), reactComponent);
  writeFile(join(repoPath, 'apps/admin/widgets/Card.tsx'), reactComponent);
  writeFile(join(repoPath, 'packages/ui/components/Dialog.tsx'), reactComponent);
  writeFile(join(repoPath, 'apps/web/components/react-evidence.ts'), `
    import type { ReactNode } from 'react';
    export function Label({ children }: { children: ReactNode }) { return children; }
  `);

  writeFile(join(repoPath, 'apps/api/Route.tsx'), reactComponent);
  writeFile(join(repoPath, 'apps/web/api/Route.tsx'), reactComponent);
  writeFile(join(repoPath, 'apps/web/app/api/Route.tsx'), reactComponent);
  writeFile(join(repoPath, 'apps/web/pages/api/Route.tsx'), reactComponent);
  writeFile(join(repoPath, 'apps/web/components/Button.test.tsx'), reactComponent);
  writeFile(join(repoPath, 'apps/web/components/Widget.spec.tsx'), reactComponent);
  writeFile(join(repoPath, 'apps/web/components/Generated.generated.tsx'), reactComponent);
  writeFile(join(repoPath, 'apps/web/components/Local.stories.tsx'), reactComponent);
  writeFile(join(repoPath, 'apps/web/components/Story.story.tsx'), reactComponent);
  writeFile(join(repoPath, 'apps/web/components/math.ts'), 'export function add(a: number, b: number) { return a + b; }');
  writeFile(join(repoPath, 'apps/web/components/ButtonConfig.ts'), 'export const ButtonConfig = { size: "sm" };');
  writeFile(join(repoPath, 'apps/web/components/FormatCurrency.ts'), 'export function FormatCurrency(value: number) { return `$${value}`; }');
  writeFile(join(repoPath, 'apps/web/components/docs.ts'), 'export const docs = "React.createElement is mentioned in documentation";');
  writeFile(join(repoPath, 'apps/web/components/Legacy.jsx'), 'export function Legacy() { return <div />; }');
  writeFile(join(repoPath, 'apps/web/components/plain.js'), 'export const value = 1;');

  const manifest = {
    version: 'v2-test',
    seed: 'fixture-seed',
    discoveryGlobs: ['**/*.tsx', '**/*.ts'],
    excludeGlobs: [
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/*.generated.{ts,tsx}',
      '**/*.stories.{ts,tsx}',
      '**/*.story.{ts,tsx}',
      '**/test/**',
      '**/playwright/**',
      '**/app/api/**',
      '**/pages/api/**'
    ],
    countRule: {
      includeNonReact: false,
      countReactPatterns: ['JSXElement', 'JSXFragment', 'React']
    },
    repos: [{
      name: 'fixture',
      revision: 'fixture-revision',
      sourceRoots: ['apps/web/', 'apps/*/widgets/', 'packages/*/components'],
      excludedPaths: ['apps/web/api/', '*.stories.tsx'],
      bucketLimits: {
        'tiny-raw': 2,
        'simple-presentational': 2,
        'style-heavy': 1
      }
    }]
  };

  const manifestPath = join(root, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  return { root, repoPath, reposBaseDir, manifest, manifestPath };
}

test('v2 runner bounded matcher supports current manifest path patterns', () => {
  assert.equal(_test.matchesGlob('apps/web/components/Button.tsx', '**/*.tsx'), true);
  assert.equal(_test.matchesGlob('apps/web/components/Button.test.tsx', '**/*.test.{ts,tsx}'), true);
  assert.equal(_test.matchesGlob('apps/web/components/Local.stories.tsx', '*.stories.tsx'), true);
  assert.equal(_test.matchesGlob('apps/web/components/Legacy.jsx', '**/*.tsx'), false);
  assert.equal(_test.sourceRootFor('apps/admin/widgets/Card.tsx', ['apps/*/widgets/']), 'apps/*/widgets/');
  assert.equal(_test.sourceRootFor('packages/ui/components/Dialog.tsx', ['packages/*/components']), 'packages/*/components');
  assert.equal(_test.matchesPathPattern('apps/web/api/Route.tsx', 'apps/web/api/'), true);
});

test('BucketClassifier enforces discovery globs, source roots, excludes, and React source suitability', () => {
  const fixture = createFixture();
  try {
    const repo = { ...fixture.manifest.repos[0], localPath: fixture.repoPath };
    const classifier = new BucketClassifier(repo, DEFAULT_BUCKETS, fixture.manifest);
    const files = classifier.discoverFiles().map(path => _test.normalizePath(path.replace(`${fixture.repoPath}/`, ''))).sort();

    assert.deepEqual(files, [
      'apps/admin/widgets/Card.tsx',
      'apps/web/components/Button.tsx',
      'apps/web/components/react-evidence.ts',
      'packages/ui/components/Dialog.tsx'
    ]);

    assert.equal(classifier.lastDiscovery.candidateCount, 17);
    assert.equal(classifier.lastDiscovery.includedCount, 4);
    assert.equal(classifier.lastDiscovery.excludedCounts.discoveryGlobMismatch, 2);
    assert.equal(classifier.lastDiscovery.excludedCounts.outsideSourceRoots, 1);
    assert.equal(classifier.lastDiscovery.excludedCounts.repoExcludedPath, 2);
    assert.equal(classifier.lastDiscovery.excludedCounts.globalExclude, 6);
    assert.equal(classifier.lastDiscovery.excludedCounts.nonReactSource, 4);

    assert.equal(classifier.lastDiscovery.examples.outsideSourceRoots[0].path, 'apps/api/Route.tsx');
    assert.equal(
      classifier.lastDiscovery.examples.repoExcludedPath.some(example => example.path === 'apps/web/components/Local.stories.tsx'),
      true
    );
    assert.equal(
      classifier.lastDiscovery.examples.globalExclude.some(example => example.path === 'apps/web/components/Button.test.tsx'),
      true
    );
    assert.equal(
      classifier.lastDiscovery.examples.nonReactSource.some(example => example.path === 'apps/web/components/math.ts'),
      true
    );
    assert.equal(
      classifier.lastDiscovery.examples.nonReactSource.some(example => example.path === 'apps/web/components/ButtonConfig.ts'),
      true
    );
    assert.equal(
      classifier.lastDiscovery.examples.nonReactSource.some(example => example.path === 'apps/web/components/FormatCurrency.ts'),
      true
    );
    assert.equal(
      classifier.lastDiscovery.examples.nonReactSource.some(example => example.path === 'apps/web/components/docs.ts'),
      true
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('DryRunCommand reports additive discovery metadata and source-root traceability', async () => {
  const fixture = createFixture();
  try {
    const outputPath = join(fixture.root, 'dry-run.json');
    const command = new DryRunCommand(fixture.manifestPath, fixture.reposBaseDir);
    const { report, exitCode } = await command.execute('fixture', { output: outputPath });
    const written = JSON.parse(readFileSync(outputPath, 'utf-8'));

    for (const field of ['schemaVersion', 'timestamp', 'repo', 'revision', 'globalSeed', 'summary', 'buckets', 'coverageStatus']) {
      assert.ok(Object.hasOwn(written, field), `expected top-level field ${field}`);
    }

    assert.equal(report.discovery.candidateCount, 17);
    assert.equal(report.discovery.includedCount, 4);
    assert.ok(report.discovery.excludedCounts.outsideSourceRoots > 0);
    assert.ok(report.discovery.excludedCounts.repoExcludedPath > 0);
    assert.ok(report.discovery.excludedCounts.globalExclude > 0);
    assert.ok(report.discovery.excludedCounts.nonReactSource > 0);

    const selectedFiles = Object.values(report.buckets).flatMap(bucket => bucket.selectedFiles);
    assert.ok(selectedFiles.length > 0);
    assert.equal(selectedFiles.every(file => typeof file.sourceRoot === 'string' && file.sourceRoot.length > 0), true);
    assert.equal(selectedFiles.some(file => file.path.endsWith('.jsx') || file.path.endsWith('.js')), false);
    assert.equal(selectedFiles.some(file => file.path.includes('/api/') || file.path.endsWith('.test.tsx')), false);
    assert.equal(selectedFiles.some(file => file.path.endsWith('ButtonConfig.ts') || file.path.endsWith('FormatCurrency.ts') || file.path.endsWith('docs.ts')), false);

    assert.equal(report.coverageStatus, 'insufficient');
    assert.equal(exitCode, 1);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('edit guidance evidence pair keeps variants matched and claim-bounded', () => {
  const evidence = buildEditGuidanceEvidencePair({
    targetFile: 'apps/web/components/Button.tsx',
    componentName: 'Button',
    patchTargetsCount: 2
  });

  assert.equal(evidence.schemaVersion, 'fooks-edit-guidance-evidence.v1');
  assert.deepEqual(evidence.pairedTarget, {
    filePath: 'apps/web/components/Button.tsx',
    componentName: 'Button'
  });
  assert.match(evidence.comparisonInvariant, /same target file and component/);

  assert.equal(evidence.withGuidance.editGuidanceEnabled, true);
  assert.equal(evidence.withGuidance.patchTargetsCount, 2);
  assert.equal(evidence.withGuidance.freshnessChecked, true);
  assert.deepEqual(evidence.withGuidance.targetLocalizationSteps, [
    'read-model-payload',
    'verify-sourceFingerprint',
    'select-patchTarget'
  ]);

  assert.equal(evidence.withoutGuidance.editGuidanceEnabled, false);
  assert.equal(evidence.withoutGuidance.patchTargetsCount, 0);
  assert.equal(evidence.withoutGuidance.freshnessChecked, false);
  assert.deepEqual(evidence.withoutGuidance.targetLocalizationSteps, [
    'read-source-or-search',
    'locate-edit-anchor-manually'
  ]);

  for (const variant of [evidence.withGuidance, evidence.withoutGuidance]) {
    assert.equal(variant.claimBoundary, EDIT_GUIDANCE_EVIDENCE_CLAIM_BOUNDARY);
    assert.match(variant.claimBoundary, /not provider billing\/cost proof/);
    assert.match(variant.claimBoundary, /not LSP semantic safety/);
    assert.equal(
      variant.targetLocalizationSteps.every(step => typeof step === 'string' && step.length > 0),
      true
    );
  }
});

test('DryRunCommand can attach opt-in edit guidance evidence without changing default reports', async () => {
  const fixture = createFixture();
  try {
    const defaultOutputPath = join(fixture.root, 'dry-run-default.json');
    const evidenceOutputPath = join(fixture.root, 'dry-run-evidence.json');
    const command = new DryRunCommand(fixture.manifestPath, fixture.reposBaseDir);

    const defaultRun = await command.execute('fixture', { output: defaultOutputPath });
    assert.equal(Object.hasOwn(defaultRun.report, 'editGuidanceEvidence'), false);

    const evidenceRun = await command.execute('fixture', {
      output: evidenceOutputPath,
      editGuidanceEvidence: true,
      editGuidanceTarget: {
        filePath: 'apps/web/components/Button.tsx',
        componentName: 'Button'
      },
      editGuidancePatchTargetsCount: 1
    });
    const written = JSON.parse(readFileSync(evidenceOutputPath, 'utf-8'));
    const evidence = written.editGuidanceEvidence;

    assert.equal(evidence.withGuidance.editGuidanceEnabled, true);
    assert.equal(evidence.withoutGuidance.editGuidanceEnabled, false);
    assert.deepEqual(evidence.pairedTarget, {
      filePath: 'apps/web/components/Button.tsx',
      componentName: 'Button'
    });
    assert.deepEqual(evidenceRun.report.editGuidanceEvidence, evidence);
    assert.equal(Array.isArray(evidence.withGuidance.targetLocalizationSteps), true);
    assert.equal(Array.isArray(evidence.withoutGuidance.targetLocalizationSteps), true);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
