#!/usr/bin/env node
/**
 * Fooks Frontend Benchmark Runner
 * Compares vanilla Codex vs fooks-enabled Codex on simple frontend tasks
 */

import { execSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BASE_DIR = resolve(__dirname, '..');
const REPOS_DIR = resolve(process.env.FOOKS_TEST_REPOS_DIR ?? join(BASE_DIR, '..', '..', '..', 'fooks-test-repos'));
const FOOKS_CLI = resolve(process.env.FOOKS_CLI ?? join(BASE_DIR, '..', '..', 'dist', 'cli', 'index.js'));

// Load task definitions
const tasks = JSON.parse(
  readFileSync(join(BASE_DIR, 'tasks', 'task-definitions.json'), 'utf8')
);

// Test repos
const REPOS = {
  'shadcn-ui': join(REPOS_DIR, 'ui'),
  'cal.com': join(REPOS_DIR, 'cal.com'),
  'documenso': join(REPOS_DIR, 'documenso'),
  'formbricks': join(REPOS_DIR, 'formbricks'),
  'nextjs': join(REPOS_DIR, 'nextjs'),
  'tailwindcss': join(REPOS_DIR, 'tailwindcss')
};

/**
 * Create worktree for testing
 */
function createWorktree(repoName, taskId, variant) {
  const timestamp = Date.now();
  const branchName = `benchmark-${repoName}-${taskId}-${variant}-${timestamp}`;
  const worktreePath = join(REPOS_DIR, `.worktrees`, branchName);
  
  const repoPath = REPOS[repoName];
  
  try {
    // Create worktree
    execSync(`git worktree add -B ${branchName} ${worktreePath}`, {
      cwd: repoPath,
      stdio: 'pipe'
    });
    
    return { success: true, path: worktreePath, branch: branchName };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Remove worktree
 */
function removeWorktree(worktreePath, branchName) {
  try {
    execSync(`git worktree remove -f ${worktreePath}`, { stdio: 'pipe' });
    execSync(`git branch -D ${branchName}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file stats (token estimation)
 */
function getFileStats(worktreePath) {
  try {
    const files = execSync('git diff --name-only', {
      cwd: worktreePath,
      encoding: 'utf8'
    }).trim().split('\n').filter(Boolean);
    
    let totalBytes = 0;
    for (const file of files) {
      try {
        const content = readFileSync(join(worktreePath, file), 'utf8');
        totalBytes += Buffer.byteLength(content, 'utf8');
      } catch {}
    }
    
    return { filesModified: files.length, totalBytes };
  } catch {
    return { filesModified: 0, totalBytes: 0 };
  }
}

/**
 * Run vanilla Codex
 */
async function runVanillaCodex(worktreePath, task) {
  const startTime = Date.now();
  
  try {
    // Run codex exec
    const result = execSync(
      `codex exec --full-auto "${task.prompt} Focus on minimal changes. Report what files you modified."`,
      {
        cwd: worktreePath,
        encoding: 'utf8',
        timeout: 300000, // 5 minutes
        env: {
          ...process.env,
          // Disable fooks for vanilla
          FOOKS_DISABLE: '1'
        }
      }
    );
    
    const duration = Date.now() - startTime;
    const stats = getFileStats(worktreePath);
    
    return {
      success: true,
      duration,
      ...stats,
      output: result
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: error.message
    };
  }
}

/**
 * Run fooks-enabled Codex
 */
async function runFooksCodex(worktreePath, task) {
  const startTime = Date.now();
  
  try {
    // Initialize fooks
    execSync(`node ${FOOKS_CLI} init`, {
      cwd: worktreePath,
      stdio: 'pipe'
    });
    
    // Run fooks scan
    execSync(`node ${FOOKS_CLI} scan`, {
      cwd: worktreePath,
      stdio: 'pipe'
    });
    
    // Run codex with fooks
    const result = execSync(
      `codex exec --full-auto "${task.prompt} Focus on minimal changes. Report what files you modified."`,
      {
        cwd: worktreePath,
        encoding: 'utf8',
        timeout: 300000,
        env: {
          ...process.env,
          // Enable fooks
          FOOKS_ACTIVE_ACCOUNT: 'minislively',
          FOOKS_CODEX_HOME: resolve(worktreePath, '.fooks')
        }
      }
    );
    
    const duration = Date.now() - startTime;
    const stats = getFileStats(worktreePath);
    
    return {
      success: true,
      duration,
      ...stats,
      output: result
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: error.message
    };
  }
}

/**
 * Run single benchmark
 */
async function runBenchmark(repoName, task, variant) {
  console.log(`\n[${variant}] ${task.id} on ${repoName}: ${task.name}`);
  
  // Create worktree
  const worktree = createWorktree(repoName, task.id, variant);
  if (!worktree.success) {
    console.log(`  Failed to create worktree: ${worktree.error}`);
    return null;
  }
  
  console.log(`  Worktree: ${worktree.path}`);
  
  // Run test
  const result = variant === 'vanilla' 
    ? await runVanillaCodex(worktree.path, task)
    : await runFooksCodex(worktree.path, task);
  
  // Cleanup
  removeWorktree(worktree.path, worktree.branch);
  
  // Log results
  if (result.success) {
    console.log(`  ✓ Duration: ${result.duration}ms`);
    console.log(`  ✓ Files modified: ${result.filesModified}`);
    console.log(`  ✓ Estimated tokens: ~${Math.round(result.totalBytes / 4)}`);
  } else {
    console.log(`  ✗ Failed: ${result.error}`);
  }
  
  return {
    repo: repoName,
    task: task.id,
    variant,
    ...result
  };
}

/**
 * Main benchmark runner
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Fooks Frontend Benchmark');
  console.log('='.repeat(60));
  
  const results = [];
  
  // Run each task on each applicable repo
  for (const task of tasks.tasks) {
    console.log(`\n${'-'.repeat(60)}`);
    console.log(`Task: ${task.id} - ${task.name} (${task.difficulty})`);
    console.log(`${'-'.repeat(60)}`);
    
    for (const repoName of task.targetRepos.slice(0, 2)) { // Limit to 2 repos per task
      // Vanilla Codex
      const vanillaResult = await runBenchmark(repoName, task, 'vanilla');
      if (vanillaResult) results.push(vanillaResult);
      
      // Wait between runs
      await new Promise(r => setTimeout(r, 2000));
      
      // Fooks Codex
      const fooksResult = await runBenchmark(repoName, task, 'fooks');
      if (fooksResult) results.push(fooksResult);
      
      // Wait between tasks
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  
  // Generate report
  console.log('\n' + '='.repeat(60));
  console.log('Generating Report...');
  console.log('='.repeat(60));
  
  generateReport(results);
}

/**
 * Generate comparison report
 */
function generateReport(results) {
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {},
    details: results
  };
  
  // Calculate averages by variant
  const vanillaResults = results.filter(r => r.variant === 'vanilla' && r.success);
  const fooksResults = results.filter(r => r.variant === 'fooks' && r.success);
  
  report.summary = {
    vanilla: {
      tasksRun: vanillaResults.length,
      avgDuration: vanillaResults.reduce((a, r) => a + r.duration, 0) / vanillaResults.length || 0,
      avgFilesModified: vanillaResults.reduce((a, r) => a + r.filesModified, 0) / vanillaResults.length || 0,
      avgTokens: vanillaResults.reduce((a, r) => a + r.totalBytes / 4, 0) / vanillaResults.length || 0,
      successRate: vanillaResults.length / results.filter(r => r.variant === 'vanilla').length
    },
    fooks: {
      tasksRun: fooksResults.length,
      avgDuration: fooksResults.reduce((a, r) => a + r.duration, 0) / fooksResults.length || 0,
      avgFilesModified: fooksResults.reduce((a, r) => a + r.filesModified, 0) / fooksResults.length || 0,
      avgTokens: fooksResults.reduce((a, r) => a + r.totalBytes / 4, 0) / fooksResults.length || 0,
      successRate: fooksResults.length / results.filter(r => r.variant === 'fooks').length
    }
  };
  
  // Save report
  const reportPath = join(BASE_DIR, 'reports', `benchmark-${Date.now()}.json`);
  mkdirSync(join(BASE_DIR, 'reports'), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Print summary
  console.log('\n## Summary\n');
  console.log('| Metric | Vanilla | Fooks | Improvement |');
  console.log('|--------|---------|-------|-------------|');
  console.log(`| Avg Duration | ${report.summary.vanilla.avgDuration.toFixed(0)}ms | ${report.summary.fooks.avgDuration.toFixed(0)}ms | ${((1 - report.summary.fooks.avgDuration / report.summary.vanilla.avgDuration) * 100).toFixed(1)}% |`);
  console.log(`| Avg Tokens | ${report.summary.vanilla.avgTokens.toFixed(0)} | ${report.summary.fooks.avgTokens.toFixed(0)} | ${((1 - report.summary.fooks.avgTokens / report.summary.vanilla.avgTokens) * 100).toFixed(1)}% |`);
  console.log(`| Success Rate | ${(report.summary.vanilla.successRate * 100).toFixed(0)}% | ${(report.summary.fooks.successRate * 100).toFixed(0)}% | - |`);
  
  console.log(`\nReport saved to: ${reportPath}`);
}

// Run
main().catch(console.error);
