'use strict';

/**
 * Parse Codex CLI runtime token telemetry from stdout/stderr text.
 *
 * This is CLI-reported runtime usage only. It is not provider usage/billing-token telemetry,
 * not a provider cost source, and not sufficient for public billing-token claims.
 */
function parseCodexRuntimeTokens(...chunks) {
  const usage = parseCodexRuntimeUsage(...chunks);
  return usage.totalTokens;
}

/**
 * Parse the strongest structured Codex CLI runtime-token telemetry available.
 *
 * `totalTokens` is the only comparable runtime-token aggregate used by the
 * repeated L1 gate. `inputTokens` and `outputTokens` are retained when the
 * CLI prints them, but they are optional because older/terser Codex output may only
 * include "tokens used".
 */
function parseCodexRuntimeUsage(...chunks) {
  const text = chunks.filter((chunk) => typeof chunk === 'string' && chunk.length > 0).join('\n');
  const empty = {
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    source: null,
    claimBoundary: 'Codex CLI runtime-reported tokens are not provider usage/billing tokens, invoices, dashboards, or charged costs.',
  };
  if (!text) return empty;

  const inputTokens = lastNumber([
    /(?:input|prompt)\s+tokens\s*:?\s*([0-9][0-9,]*)/gi,
    /(?:input|prompt)_tokens["']?\s*[:=]\s*([0-9][0-9,]*)/gi,
  ], text);
  const outputTokens = lastNumber([
    /(?:output|completion)\s+tokens\s*:?\s*([0-9][0-9,]*)/gi,
    /(?:output|completion)_tokens["']?\s*[:=]\s*([0-9][0-9,]*)/gi,
  ], text);
  const explicitTotalTokens = lastNumber([
    /tokens\s+used\s*:?\s*\n\s*([0-9][0-9,]*)/gi,
    /tokens\s+used\s*:?\s*([0-9][0-9,]*)/gi,
    /total\s+tokens\s*:?\s*([0-9][0-9,]*)/gi,
    /total_tokens["']?\s*[:=]\s*([0-9][0-9,]*)/gi,
  ], text);

  const totalTokens = explicitTotalTokens !== null
    ? explicitTotalTokens
    : inputTokens !== null && outputTokens !== null
      ? inputTokens + outputTokens
      : null;

  return {
    ...empty,
    inputTokens,
    outputTokens,
    totalTokens,
    source: totalTokens === null ? null : 'codex-cli-output',
  };
}

/**
 * Parse Anthropic API runtime token usage from an API response object.
 *
 * Accepts either a raw API response object or text chunks (for compatibility).
 * When given an object, reads usage.input_tokens and usage.output_tokens directly.
 * When given text chunks, attempts to parse JSON and extract usage.
 */
function parseClaudeRuntimeUsage(...chunks) {
  const empty = {
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    source: null,
    claimBoundary: 'Anthropic API usage fields are not provider usage/billing tokens, invoices, dashboards, or charged costs.',
  };

  // If the first chunk is an object with usage, read directly
  const first = chunks[0];
  if (first && typeof first === 'object' && first.usage) {
    const inputTokens = Number.isFinite(first.usage.input_tokens) ? first.usage.input_tokens : null;
    const outputTokens = Number.isFinite(first.usage.output_tokens) ? first.usage.output_tokens : null;
    const totalTokens = inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null;
    return {
      ...empty,
      inputTokens,
      outputTokens,
      totalTokens,
      source: totalTokens === null ? null : 'anthropic-api-usage-object',
    };
  }

  // Fallback: join text chunks and try to find usage in JSON
  const text = chunks.filter((chunk) => typeof chunk === 'string' && chunk.length > 0).join('\n');
  if (!text) return empty;

  try {
    const parsed = JSON.parse(text);
    if (parsed.usage) {
      const inputTokens = Number.isFinite(parsed.usage.input_tokens) ? parsed.usage.input_tokens : null;
      const outputTokens = Number.isFinite(parsed.usage.output_tokens) ? parsed.usage.output_tokens : null;
      const totalTokens = inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null;
      return {
        ...empty,
        inputTokens,
        outputTokens,
        totalTokens,
        source: totalTokens === null ? null : 'anthropic-api-json',
      };
    }
  } catch {
    // Not JSON, try regex fallback
  }

  const inputTokens = lastNumber([
    /"input_tokens"\s*:\s*([0-9]+)/gi,
    /input[_\s]tokens["']?\s*[:=]\s*([0-9][0-9,]*)/gi,
  ], text);
  const outputTokens = lastNumber([
    /"output_tokens"\s*:\s*([0-9]+)/gi,
    /output[_\s]tokens["']?\s*[:=]\s*([0-9][0-9,]*)/gi,
  ], text);
  const totalTokens = inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null;

  return {
    ...empty,
    inputTokens,
    outputTokens,
    totalTokens,
    source: totalTokens === null ? null : 'anthropic-api-regex',
  };
}

function lastNumber(patterns, text) {
  const candidates = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = Number.parseInt(match[1].replace(/,/g, ''), 10);
      if (Number.isFinite(value)) candidates.push(value);
    }
  }
  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

module.exports = { parseCodexRuntimeTokens, parseCodexRuntimeUsage, parseClaudeRuntimeUsage };
