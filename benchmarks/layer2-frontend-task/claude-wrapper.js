/**
 * Claude API Wrapper
 *
 * Calls the Anthropic Messages API directly using native fetch.
 * Mirrors the CodexWrapper interface for paired benchmark parity.
 */
class ClaudeWrapper {
  constructor(options = {}) {
    this.model = options.model || process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
    this.timeoutMs = Number(options.timeoutMs || process.env.CLAUDE_TIMEOUT_MS || 300000);
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.apiUrl = options.apiUrl || process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages';
  }

  /**
   * Claude 실행
   * @param {string} context - 컨텍스트 (vanilla: 전체 파일, fooks: 추출된 payload)
   * @param {string} taskPrompt - 작업 지시문
   * @returns {Promise<Object>} 실행 결과
   */
  async run(context, taskPrompt) {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const fullPrompt = this.buildPrompt(context, taskPrompt);

    if (!this.apiKey) {
      return {
        exitCode: -1,
        success: false,
        error: 'ANTHROPIC_API_KEY is not set',
        latencyMs: Date.now() - startTime,
        timestamp,
        stdout: '',
        stderr: 'ANTHROPIC_API_KEY is not set',
        lastMessage: '',
        runtimeUsage: {
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          source: null,
          claimBoundary: 'Anthropic API usage is not provider usage/billing-token telemetry.',
        },
        metadata: {
          model: this.model,
          timeoutMs: this.timeoutMs,
          promptLength: fullPrompt.length,
          promptTokens: Math.ceil(fullPrompt.length / 3.5),
        },
      };
    }

    let responseText = '';
    let usage = { input_tokens: null, output_tokens: null };
    let response;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      response = await fetch(this.apiUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4096,
          messages: [
            { role: 'user', content: fullPrompt },
          ],
        }),
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        const errorBody = JSON.stringify(data, null, 2);
        return {
          exitCode: response.status,
          success: false,
          error: `Anthropic API error: ${response.status} ${response.statusText}`,
          latencyMs: Date.now() - startTime,
          timestamp,
          stdout: '',
          stderr: errorBody,
          lastMessage: '',
          runtimeUsage: {
            inputTokens: null,
            outputTokens: null,
            totalTokens: null,
            source: null,
            claimBoundary: 'Anthropic API usage is not provider usage/billing-token telemetry.',
          },
          metadata: {
            model: this.model,
            timeoutMs: this.timeoutMs,
            promptLength: fullPrompt.length,
            promptTokens: Math.ceil(fullPrompt.length / 3.5),
          },
        };
      }

      responseText = data.content?.[0]?.text || '';
      usage = data.usage || { input_tokens: null, output_tokens: null };

      return {
        exitCode: 0,
        success: true,
        stdout: responseText,
        stderr: '',
        lastMessage: responseText,
        latencyMs: Date.now() - startTime,
        timestamp,
        runtimeUsage: {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          totalTokens: usage.input_tokens !== null && usage.output_tokens !== null
            ? usage.input_tokens + usage.output_tokens
            : null,
          source: 'anthropic-api-usage-field',
          claimBoundary: 'Anthropic API usage fields are not provider usage/billing tokens, invoices, dashboards, or charged costs.',
        },
        metadata: {
          model: this.model,
          timeoutMs: this.timeoutMs,
          promptLength: fullPrompt.length,
          promptTokens: Math.ceil(fullPrompt.length / 3.5),
        },
      };
    } catch (error) {
      return {
        exitCode: -1,
        success: false,
        error: error.message,
        latencyMs: Date.now() - startTime,
        timestamp,
        stdout: '',
        stderr: error.message,
        lastMessage: '',
        runtimeUsage: {
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          source: null,
          claimBoundary: 'Anthropic API usage is not provider usage/billing-token telemetry.',
        },
        metadata: {
          model: this.model,
          timeoutMs: this.timeoutMs,
          promptLength: fullPrompt.length,
          promptTokens: Math.ceil(fullPrompt.length / 3.5),
        },
      };
    }
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

module.exports = ClaudeWrapper;
