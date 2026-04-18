/**
 * Layer 2 Frontend Task Benchmark - Manifest Loader
 * Loads and validates manifest.json for deterministic benchmark execution.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class ManifestLoader {
  constructor(manifestPath = '../../../../docs/benchmarks/v2/manifest.json', reposBaseDir = null) {
    this.manifestPath = resolve(__dirname, manifestPath);
    this.reposBaseDir = reposBaseDir || resolve(homedir(), 'Workspace/fooks-test-repos');
    this.manifest = null;
  }

  load() {
    const content = readFileSync(this.manifestPath, 'utf-8');
    this.manifest = JSON.parse(content);
    
    // Enrich repo metadata with localPath
    for (const repo of this.manifest.repos || []) {
      if (!repo.localPath) {
        repo.localPath = resolve(this.reposBaseDir, repo.name);
      }
    }
    
    return this.manifest;
  }

  validate() {
    if (!this.manifest) this.load();

    const errors = [];
    const warnings = [];

    if (!this.manifest.version?.startsWith('v2')) {
      warnings.push(`Unexpected version: ${this.manifest.version}`);
    }

    if (!this.manifest.repos?.length) errors.push('No repos defined');
    
    for (const repo of this.manifest.repos || []) {
      if (!repo.revision) errors.push(`Repo ${repo.name}: missing revision`);
      if (!repo.localPath) errors.push(`Repo ${repo.name}: missing localPath`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  getRepo(name) {
    if (!this.manifest) this.load();
    return this.manifest.repos.find(r => r.name === name);
  }

  getComparativeRepos() {
    if (!this.manifest) this.load();
    return this.manifest.repos.filter(r => r.comparativeGating);
  }
}
