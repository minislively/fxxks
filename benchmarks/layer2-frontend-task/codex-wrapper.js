const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseCodexRuntimeUsage } = require('./runtime-token-metrics');

/**
 * Codex CLI Wrapper
 *
 * Uses the current `codex exec` interface and captures a structured artifact
 * without requiring the configured gateway path that previously returned 502.
 */
class CodexWrapper {
  constructor(options = {}) {
    this.model = options.model || process.env.CODEX_MODEL || 'gpt-5.4-mini';
    this.timeoutMs = Number(options.timeoutMs || process.env.CODEX_TIMEOUT_MS || 300000);
    this.command = options.command || 'codex';
  }

  /**
   * Codex 실행
   * @param {string} context - 컨텍스트 (vanilla: 전체 파일, fooks: 추출된 payload)
   * @param {string} taskPrompt - 작업 지시문
   * @returns {Promise<Object>} 실행 결과
   */
  async run(context, taskPrompt) {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const fullPrompt = this.buildPrompt(context, taskPrompt);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fooks-codex-r4-'));
    const lastMessagePath = path.join(tempDir, 'last-message.txt');

    return new Promise((resolve, reject) => {
      const args = [
        'exec',
        '--ephemeral',
        '--skip-git-repo-check',
        '--sandbox',
        'read-only',
        '-C',
        tempDir,
        '-m',
        this.model,
        '-o',
        lastMessagePath,
        '-',
      ];

      console.log(`[CodexWrapper] Executing: ${this.command} ${args.slice(0, -1).join(' ')} -`);

      const codex = spawn(this.command, args, {
        env: { ...process.env },
        timeout: this.timeoutMs,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      codex.stdin.write(fullPrompt);
      codex.stdin.end();

      let stdout = '';
      let stderr = '';

      codex.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });

      codex.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });

      codex.on('close', (exitCode, signal) => {
        const latencyMs = Date.now() - startTime;
        const lastMessage = fs.existsSync(lastMessagePath)
          ? fs.readFileSync(lastMessagePath, 'utf8')
          : '';
        const runtimeUsage = parseCodexRuntimeUsage(stdout, stderr, lastMessage);

        fs.rmSync(tempDir, { recursive: true, force: true });

        resolve({
          exitCode,
          signal,
          success: exitCode === 0,
          stdout,
          stderr,
          lastMessage,
          runtimeUsage,
          latencyMs,
          timestamp,
          metadata: {
            model: this.model,
            timeoutMs: this.timeoutMs,
            promptLength: fullPrompt.length,
            promptTokens: Math.ceil(fullPrompt.length / 3.5),
          },
        });
      });

      codex.on('error', (error) => {
        fs.rmSync(tempDir, { recursive: true, force: true });
        reject({
          exitCode: -1,
          success: false,
          error: error.message,
          latencyMs: Date.now() - startTime,
          timestamp,
        });
      });
    });
  }

  buildPrompt(context, taskPrompt) {
    return `# Task: ${taskPrompt}

## Context (File Content or Extracted Structure):
${context}

## Instructions:
1. Refactor the code into modular components as specified
2. Maintain all existing functionality
3. Ensure no circular dependencies
4. Keep each file under 200 lines
5. Add proper barrel exports
6. Use only the provided context; do not inspect the filesystem or target paths

## Output:
Provide the proposed file tree and concise code skeleton for each new file. Do not edit files.`;
  }
}

module.exports = CodexWrapper;
