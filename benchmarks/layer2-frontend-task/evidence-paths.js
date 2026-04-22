'use strict';

const fs = require('fs');
const path = require('path');

const FOOKS_DIR = '.fooks';
const EVIDENCE_DIR = 'evidence';

function sanitizeRunId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'run';
}

function timestampRunId(prefix = 'run', date = new Date()) {
  const stamp = date.toISOString().replace(/[:.]/g, '-');
  return sanitizeRunId(`${prefix}-${stamp}`);
}

function evidenceDir({ cwd = process.cwd(), tier, runId } = {}) {
  if (!tier) throw new Error('Missing evidence tier');
  const safeRunId = sanitizeRunId(runId || timestampRunId(tier));
  return path.join(cwd, FOOKS_DIR, EVIDENCE_DIR, sanitizeRunId(tier), safeRunId);
}

function ensureEvidenceDir(options = {}) {
  const dir = evidenceDir(options);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function evidencePaths({ cwd = process.cwd(), tier, runId, jsonName = 'evidence.json', markdownName = 'evidence.md' } = {}) {
  const dir = evidenceDir({ cwd, tier, runId });
  return {
    dir,
    runId: path.basename(dir),
    json: path.join(dir, jsonName),
    markdown: path.join(dir, markdownName),
  };
}

module.exports = {
  FOOKS_DIR,
  EVIDENCE_DIR,
  sanitizeRunId,
  timestampRunId,
  evidenceDir,
  ensureEvidenceDir,
  evidencePaths,
};
